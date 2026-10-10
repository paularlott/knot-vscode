import * as vscode from 'vscode';
import type { ConnectedServer } from '../serverStore';
import type { FileBucketInfo } from '../api/types';
import { KnotHttpError } from '../api/client';

/** The URI scheme of file storage: knotfs://<server id>/<bucket>/<path>. */
export const SCHEME = 'knotfs';

export interface ParsedUri {
    serverId: string;
    /** The bucket's full name, or undefined at the root. */
    bucket?: string;
    /** The path within the bucket, without a trailing slash; '' for the bucket itself. */
    key: string;
}

export function makeUri(serverId: string, bucket?: string, key = ''): vscode.Uri {
    const path = bucket ? '/' + bucket + (key ? '/' + key : '') : '/';
    return vscode.Uri.from({ scheme: SCHEME, authority: serverId, path });
}

export function parseUri(uri: vscode.Uri): ParsedUri {
    const parts = uri.path.split('/').filter((p) => p !== '');
    return { serverId: uri.authority, bucket: parts[0], key: parts.slice(1).join('/') };
}

const BUCKET_TTL_MS = 10_000;
const STAT_TTL_MS = 2_000;
const DELETE_CONCURRENCY = 8;
/** How many listed folders are kept to be compared when the server reports a change. */
const MAX_LISTED = 200;

type Listing = Map<string, { type: vscode.FileType; etag?: string }>;

interface CachedStat {
    at: number;
    stat?: vscode.FileStat;
}

/**
 * File storage as a VS Code file system: buckets are the folders at the root,
 * and a bucket's files appear under them. Folders inside a bucket are only
 * key prefixes on the server, so an empty one exists here until it is
 * refreshed away.
 */
export class KnotFileSystem implements vscode.FileSystemProvider {
    private readonly emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile = this.emitter.event;

    private readonly buckets = new Map<string, { at: number; list: FileBucketInfo[] }>();
    private readonly stats = new Map<string, CachedStat>();
    /** Folders made here that hold nothing yet, by uri string. */
    private readonly pendingDirs = new Set<string>();
    /** What was last listed of each folder, by uri string, oldest first. */
    private readonly listed = new Map<string, Listing>();
    /** Files read, by uri string, with the ETag of the version read. */
    private readonly opened = new Map<string, string>();
    /** Where each bucket's change feed was read to, by "<server id>/<bucket>". */
    private readonly cursors = new Map<string, string>();
    /** A sync in progress per server, and whether another is wanted after it. */
    private readonly syncing = new Map<string, { all: boolean; ids: Set<string> } | null>();

    constructor(private readonly getConn: (serverId: string) => Promise<ConnectedServer | undefined>) {}

    watch(): vscode.Disposable {
        // Changes made elsewhere are reported by sync(), from the server's
        // event stream or a refresh.
        return new vscode.Disposable(() => undefined);
    }

    // ---- reads ----

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        const cached = this.stats.get(uri.toString());
        if (cached && Date.now() - cached.at < STAT_TTL_MS) {
            if (cached.stat) {
                return cached.stat;
            }
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        try {
            const stat = await this.statUncached(uri);
            this.stats.set(uri.toString(), { at: Date.now(), stat });
            return stat;
        } catch (err) {
            if (err instanceof vscode.FileSystemError && err.code === 'FileNotFound') {
                this.stats.set(uri.toString(), { at: Date.now() });
            }
            throw this.mapError(err, uri);
        }
    }

    private async statUncached(uri: vscode.Uri): Promise<vscode.FileStat> {
        const { serverId, bucket, key } = parseUri(uri);
        const conn = await this.conn(serverId);
        if (!bucket) {
            return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
        }
        const info = await this.bucket(conn, bucket, uri);
        const permissions = info.access === 'read' ? vscode.FilePermission.Readonly : undefined;
        if (!key) {
            return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0, permissions };
        }
        const file = await conn.client.statFile(bucket, key);
        if (file) {
            return { type: vscode.FileType.File, ctime: file.mtime, mtime: file.mtime, size: file.size, permissions };
        }
        if (this.pendingDirs.has(uri.toString())) {
            return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0, permissions };
        }
        const page = await conn.client.listFileObjects(bucket, key + '/', '/');
        if (page.objects.length > 0 || page.prefixes.length > 0) {
            return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0, permissions };
        }
        throw vscode.FileSystemError.FileNotFound(uri);
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        try {
            const listing = await this.listDirectory(uri);
            this.remember(uri, listing);
            return [...listing.entries()].map(([name, e]) => [name, e.type]);
        } catch (err) {
            throw this.mapError(err, uri);
        }
    }

    private async listDirectory(uri: vscode.Uri): Promise<Listing> {
        const { serverId, bucket, key } = parseUri(uri);
        const conn = await this.conn(serverId);
        const out: Listing = new Map();
        if (!bucket) {
            for (const b of await this.bucketList(conn, true)) {
                out.set(b.name, { type: vscode.FileType.Directory });
            }
            return out;
        }
        await this.bucket(conn, bucket, uri);

        const prefix = key ? key + '/' : '';
        let after = '';
        for (;;) {
            const page = await conn.client.listFileObjects(bucket, prefix, '/', after);
            for (const p of page.prefixes ?? []) {
                const name = p.slice(prefix.length).replace(/\/+$/, '');
                if (name) {
                    out.set(name, { type: vscode.FileType.Directory });
                }
            }
            for (const o of page.objects ?? []) {
                const name = o.key.slice(prefix.length);
                // A key ending in a slash is a folder marker, not a file.
                if (name && !name.includes('/')) {
                    out.set(name, { type: vscode.FileType.File, etag: o.etag });
                }
            }
            if (!page.is_truncated || !page.next) {
                break;
            }
            after = page.next;
        }
        for (const dir of this.pendingDirs) {
            const p = parseUri(vscode.Uri.parse(dir));
            if (p.serverId === serverId && p.bucket === bucket && p.key.startsWith(prefix)) {
                const rest = p.key.slice(prefix.length);
                if (rest && !rest.includes('/') && !out.has(rest)) {
                    out.set(rest, { type: vscode.FileType.Directory });
                }
            }
        }
        return out;
    }

    private remember(uri: vscode.Uri, listing: Listing): void {
        const k = uri.toString();
        this.listed.delete(k);
        this.listed.set(k, listing);
        while (this.listed.size > MAX_LISTED) {
            this.listed.delete(this.listed.keys().next().value as string);
        }
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        try {
            const { serverId, bucket, key } = parseUri(uri);
            if (!bucket || !key) {
                throw vscode.FileSystemError.FileIsADirectory(uri);
            }
            const conn = await this.conn(serverId);
            const { body, etag } = await conn.client.readFileContent(bucket, key);
            this.opened.set(uri.toString(), etag);
            return body;
        } catch (err) {
            throw this.mapError(err, uri);
        }
    }

    // ---- changes ----

    async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): Promise<void> {
        try {
            const { serverId, bucket, key } = parseUri(uri);
            if (!bucket || !key) {
                throw vscode.FileSystemError.NoPermissions(uri);
            }
            const conn = await this.conn(serverId);
            const info = await this.bucket(conn, bucket, uri);
            if (info.access === 'read') {
                throw vscode.FileSystemError.NoPermissions(`${uri.path} is read-only: the bucket is shared with you for reading`);
            }
            // Looked at afresh, so the write is made against what is there now.
            const existing = await conn.client.statFile(bucket, key);
            if (existing && !options.overwrite) {
                throw vscode.FileSystemError.FileExists(uri);
            }
            if (!existing && !options.create) {
                throw vscode.FileSystemError.FileNotFound(uri);
            }
            let etag: string;
            try {
                etag = await conn.client.writeFileContent(
                    bucket,
                    key,
                    Buffer.from(content),
                    existing ? { ifMatch: existing.etag } : { ifAbsent: true },
                );
            } catch (err) {
                if (err instanceof KnotHttpError && err.status === 412) {
                    throw vscode.FileSystemError.Unavailable(
                        `${uri.path} changed on the server while it was being saved: reopen it to see the changes`,
                    );
                }
                throw err;
            }
            this.forget(uri);
            // Known as written, so the change the server reports for it is not news.
            this.opened.set(uri.toString(), etag);
            const siblings = this.listed.get(parentOf(uri).toString());
            if (siblings && etag) {
                siblings.set(uri.path.slice(uri.path.lastIndexOf('/') + 1), { type: vscode.FileType.File, etag });
            }
            // Anything made as a folder here now exists for real.
            for (const dir of [...this.pendingDirs]) {
                if (uri.toString().startsWith(dir + '/')) {
                    this.pendingDirs.delete(dir);
                }
            }
            this.fire([
                { type: existing ? vscode.FileChangeType.Changed : vscode.FileChangeType.Created, uri },
                { type: vscode.FileChangeType.Changed, uri: parentOf(uri) },
            ]);
        } catch (err) {
            throw this.mapError(err, uri);
        }
    }

    async delete(uri: vscode.Uri): Promise<void> {
        try {
            const { serverId, bucket, key } = parseUri(uri);
            if (!bucket || !key) {
                throw vscode.FileSystemError.NoPermissions('Buckets are deleted from the Files page of the web interface');
            }
            const conn = await this.conn(serverId);
            const info = await this.bucket(conn, bucket, uri);
            if (info.access === 'read') {
                throw vscode.FileSystemError.NoPermissions(`${uri.path} is read-only: the bucket is shared with you for reading`);
            }

            let deleted = 0;
            // The file of that name, and, for a folder, everything under it.
            if (await conn.client.statFile(bucket, key)) {
                await conn.client.deleteFileObject(bucket, key);
                deleted++;
            }
            const keys: string[] = [];
            let after = '';
            for (;;) {
                const page = await conn.client.listFileObjects(bucket, key + '/', '', after);
                keys.push(...(page.objects ?? []).map((o) => o.key));
                if (!page.is_truncated || !page.next) {
                    break;
                }
                after = page.next;
            }
            for (let i = 0; i < keys.length; i += DELETE_CONCURRENCY) {
                await Promise.all(keys.slice(i, i + DELETE_CONCURRENCY).map((k) => conn.client.deleteFileObject(bucket, k)));
            }
            deleted += keys.length;

            const wasPending = this.pendingDirs.delete(uri.toString());
            for (const dir of [...this.pendingDirs]) {
                if (dir.startsWith(uri.toString() + '/')) {
                    this.pendingDirs.delete(dir);
                }
            }
            if (deleted === 0 && !wasPending) {
                throw vscode.FileSystemError.FileNotFound(uri);
            }
            this.forget(uri);
            this.forgetListings(uri);
            this.fire([
                { type: vscode.FileChangeType.Deleted, uri },
                { type: vscode.FileChangeType.Changed, uri: parentOf(uri) },
            ]);
        } catch (err) {
            throw this.mapError(err, uri);
        }
    }

    async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
        try {
            const from = parseUri(oldUri);
            const to = parseUri(newUri);
            if (!from.bucket || !from.key || !to.bucket || !to.key) {
                throw vscode.FileSystemError.NoPermissions('Buckets cannot be renamed here');
            }
            if (from.serverId !== to.serverId || from.bucket !== to.bucket) {
                throw vscode.FileSystemError.NoPermissions('Files can only be moved within a bucket');
            }
            const conn = await this.conn(from.serverId);
            const info = await this.bucket(conn, from.bucket, oldUri);
            if (info.access === 'read') {
                throw vscode.FileSystemError.NoPermissions(`${oldUri.path} is read-only: the bucket is shared with you for reading`);
            }

            if (this.pendingDirs.delete(oldUri.toString())) {
                // A folder that holds nothing yet moves without the server.
                this.pendingDirs.add(newUri.toString());
            } else {
                try {
                    await conn.client.moveFileObjects(from.bucket, from.key, to.key, options.overwrite);
                } catch (err) {
                    if (err instanceof KnotHttpError && err.status === 409) {
                        throw vscode.FileSystemError.FileExists(newUri);
                    }
                    throw err;
                }
            }
            this.forget(oldUri);
            this.forget(newUri);
            this.forgetListings(oldUri);
            this.forgetListings(newUri);
            this.fire([
                { type: vscode.FileChangeType.Deleted, uri: oldUri },
                { type: vscode.FileChangeType.Created, uri: newUri },
                { type: vscode.FileChangeType.Changed, uri: parentOf(oldUri) },
                { type: vscode.FileChangeType.Changed, uri: parentOf(newUri) },
            ]);
        } catch (err) {
            throw this.mapError(err, oldUri);
        }
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        try {
            const { serverId, bucket, key } = parseUri(uri);
            if (!bucket || !key) {
                throw vscode.FileSystemError.NoPermissions('Buckets are created from the Files page of the web interface');
            }
            const conn = await this.conn(serverId);
            const info = await this.bucket(conn, bucket, uri);
            if (info.access === 'read') {
                throw vscode.FileSystemError.NoPermissions(`${uri.path} is read-only: the bucket is shared with you for reading`);
            }
            // Folders are only key prefixes: this one exists once a file is written in it.
            this.pendingDirs.add(uri.toString());
            this.forget(uri);
            this.forgetListings(uri);
            this.fire([
                { type: vscode.FileChangeType.Created, uri },
                { type: vscode.FileChangeType.Changed, uri: parentOf(uri) },
            ]);
        } catch (err) {
            throw this.mapError(err, uri);
        }
    }

    /**
     * The keys a bucket's change feed reports changed since it was last read,
     * each with whether it was deleted; undefined when everything must be
     * looked at. A bucket without a cursor gets one from now on.
     */
    private async changedKeys(conn: ConnectedServer, bucket: string): Promise<Map<string, boolean> | undefined> {
        const id = conn.config.id + '/' + bucket;
        let cursor = this.cursors.get(id);
        if (!cursor) {
            try {
                this.cursors.set(id, (await conn.client.listFileChanges(bucket, 'now')).cursor);
            } catch {
                // A server without the feed: always look at everything.
            }
            return undefined;
        }
        const keys = new Map<string, boolean>();
        for (;;) {
            let page;
            try {
                page = await conn.client.listFileChanges(bucket, cursor);
            } catch {
                this.cursors.delete(id);
                return undefined;
            }
            if (page.reset) {
                this.cursors.delete(id);
                return this.changedKeys(conn, bucket);
            }
            for (const c of page.changes ?? []) {
                keys.set(c.key, !!c.deleted);
            }
            cursor = page.cursor;
            if (!page.more) {
                break;
            }
        }
        this.cursors.set(id, cursor);
        return keys;
    }

    // ---- helpers ----

    /** Forgets what is known of a path and of everything inside it, and of its parent. */
    private forget(uri: vscode.Uri): void {
        const s = uri.toString();
        const parent = parentOf(uri).toString();
        for (const k of [...this.stats.keys()]) {
            if (k === s || k.startsWith(s + '/') || k === parent) {
                this.stats.delete(k);
            }
        }
        this.buckets.delete(uri.authority);
    }

    /** Forgets the listings of a path and everything inside it, and of its parent: they are listed again when next read. */
    private forgetListings(uri: vscode.Uri): void {
        const s = uri.toString();
        const parent = parentOf(uri).toString();
        for (const k of [...this.listed.keys()]) {
            if (k === s || k.startsWith(s + '/') || k === parent) {
                this.listed.delete(k);
            }
        }
        for (const k of [...this.opened.keys()]) {
            if (k === s || k.startsWith(s + '/')) {
                this.opened.delete(k);
            }
        }
    }

    private fire(events: vscode.FileChangeEvent[]): void {
        this.emitter.fire(events);
    }

    /** Drops everything cached, for a manual refresh. */
    refresh(): void {
        this.stats.clear();
        this.buckets.clear();
        // The next sync looks at everything, not just what the feeds report.
        this.cursors.clear();
    }

    /**
     * Looks again at what has been listed and read from a server's buckets
     * (those with the given ids, or all of them) and reports what changed
     * there, so the Explorer and open editors follow changes made elsewhere.
     */
    async sync(serverId: string, bucketIds?: string[]): Promise<void> {
        // One sync at a time per server; what arrives meanwhile is gathered for the next.
        if (this.syncing.has(serverId)) {
            const next = this.syncing.get(serverId) ?? { all: false, ids: new Set<string>() };
            if (bucketIds && bucketIds.length > 0) {
                bucketIds.forEach((id) => next.ids.add(id));
            } else {
                next.all = true;
            }
            this.syncing.set(serverId, next);
            return;
        }
        this.syncing.set(serverId, null);
        try {
            await this.syncOnce(serverId, bucketIds && bucketIds.length > 0 ? new Set(bucketIds) : undefined);
        } catch {
            // the server is unreachable: the next change or poll tries again
        } finally {
            const next = this.syncing.get(serverId);
            this.syncing.delete(serverId);
            if (next) {
                void this.sync(serverId, next.all ? undefined : [...next.ids]);
            }
        }
    }

    private async syncOnce(serverId: string, ids: Set<string> | undefined): Promise<void> {
        const conn = await this.getConn(serverId);
        if (!conn || conn.filesEnabled === false) {
            return;
        }
        const prefix = makeUri(serverId).toString();
        for (const k of [...this.stats.keys()]) {
            if (k.startsWith(prefix)) {
                this.stats.delete(k);
            }
        }
        const buckets = await this.bucketList(conn, true);
        const names = new Set(buckets.map((b) => b.name));
        const affected = (bucket: string | undefined): boolean => {
            if (!bucket) {
                return true; // the root lists the buckets
            }
            if (!names.has(bucket)) {
                return true; // gone, or no longer shared
            }
            return !ids || buckets.some((b) => b.name === bucket && ids.has(b.id));
        };

        // What each bucket's change feed says changed: undefined to look at
        // everything (no cursor yet, or the feed could not be followed).
        const tracked = new Set<string>();
        for (const k of [...this.listed.keys(), ...this.opened.keys()]) {
            const { serverId: sid, bucket } = parseUri(vscode.Uri.parse(k));
            if (sid === serverId && bucket && names.has(bucket) && affected(bucket)) {
                tracked.add(bucket);
            }
        }
        const changed = new Map<string, Map<string, boolean> | undefined>();
        for (const bucket of tracked) {
            changed.set(bucket, await this.changedKeys(conn, bucket));
        }

        const events = new Map<string, vscode.FileChangeEvent>();
        const report = (type: vscode.FileChangeType, uri: vscode.Uri) => {
            events.set(uri.toString(), { type, uri });
        };

        for (const [k, before] of [...this.listed.entries()]) {
            const uri = vscode.Uri.parse(k);
            const { serverId: sid, bucket, key } = parseUri(uri);
            if (sid !== serverId || !affected(bucket)) {
                continue;
            }
            const keys = bucket ? changed.get(bucket) : undefined;
            if (keys && !folderChanged(key, keys, before)) {
                continue;
            }
            let after: Listing;
            try {
                after = await this.listDirectory(uri);
            } catch (err) {
                if (
                    (err instanceof vscode.FileSystemError && err.code === 'FileNotFound') ||
                    (err instanceof KnotHttpError && err.status === 404)
                ) {
                    // The folder or its bucket is gone.
                    this.listed.delete(k);
                    report(vscode.FileChangeType.Deleted, uri);
                    continue;
                }
                throw err;
            }
            if (!this.listed.has(k)) {
                continue; // forgotten meanwhile by a change made here
            }
            this.listed.set(k, after);
            const child = (name: string) => uri.with({ path: (uri.path === '/' ? '' : uri.path) + '/' + name });
            for (const [name, was] of before) {
                const now = after.get(name);
                if (!now || now.type !== was.type) {
                    report(vscode.FileChangeType.Deleted, child(name));
                } else if (now.etag !== was.etag) {
                    const changed = child(name);
                    report(vscode.FileChangeType.Changed, changed);
                    if (this.opened.has(changed.toString()) && now.etag) {
                        this.opened.set(changed.toString(), now.etag);
                    }
                }
            }
            for (const [name, now] of after) {
                const was = before.get(name);
                if (!was || was.type !== now.type) {
                    report(vscode.FileChangeType.Created, child(name));
                }
            }
        }

        // Files open in an editor whose folder has not been listed here.
        const open = new Set(vscode.workspace.textDocuments.map((d) => d.uri.toString()));
        for (const [k, etag] of [...this.opened.entries()]) {
            if (!open.has(k)) {
                this.opened.delete(k);
                continue;
            }
            const uri = vscode.Uri.parse(k);
            const { serverId: sid, bucket, key } = parseUri(uri);
            if (sid !== serverId || !bucket || !key || !affected(bucket) || events.has(k)) {
                continue;
            }
            const keys = changed.get(bucket);
            if (keys && !keys.has(key)) {
                continue;
            }
            const file = names.has(bucket) ? await conn.client.statFile(bucket, key) : undefined;
            if (!file) {
                this.opened.delete(k);
                report(vscode.FileChangeType.Deleted, uri);
            } else if (file.etag !== etag) {
                this.opened.set(k, file.etag);
                report(vscode.FileChangeType.Changed, uri);
            }
        }

        if (events.size > 0) {
            this.fire([...events.values()]);
        }
    }

    private async conn(serverId: string): Promise<ConnectedServer> {
        const conn = await this.getConn(serverId);
        if (!conn) {
            throw vscode.FileSystemError.Unavailable('The Knot server is not available');
        }
        if (conn.filesEnabled === false) {
            throw vscode.FileSystemError.Unavailable('File storage is not enabled on this server');
        }
        return conn;
    }

    private async bucketList(conn: ConnectedServer, fresh = false): Promise<FileBucketInfo[]> {
        const cached = this.buckets.get(conn.config.id);
        if (!fresh && cached && Date.now() - cached.at < BUCKET_TTL_MS) {
            return cached.list;
        }
        const list = (await conn.client.listFileBuckets()).buckets ?? [];
        this.buckets.set(conn.config.id, { at: Date.now(), list });
        return list;
    }

    private async bucket(conn: ConnectedServer, name: string, uri: vscode.Uri): Promise<FileBucketInfo> {
        const list = await this.bucketList(conn);
        const b = list.find((x) => x.name === name) ?? (await this.bucketList(conn, true)).find((x) => x.name === name);
        if (!b) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        return b;
    }

    private mapError(err: unknown, uri: vscode.Uri): Error {
        if (err instanceof vscode.FileSystemError) {
            return err;
        }
        if (err instanceof KnotHttpError) {
            switch (err.status) {
                case 404:
                    return vscode.FileSystemError.FileNotFound(uri);
                case 401:
                case 403:
                    return vscode.FileSystemError.NoPermissions(err.message);
                case 409:
                    return vscode.FileSystemError.FileExists(uri);
                case 413:
                    return vscode.FileSystemError.NoPermissions(`${err.message}: the file storage quota would be exceeded`);
                default:
                    return vscode.FileSystemError.Unavailable(err.message);
            }
        }
        return vscode.FileSystemError.Unavailable(err instanceof Error ? err.message : String(err));
    }
}

/**
 * Whether changes to keys can change the listing of the folder at key (''
 * for the bucket): a file in it changed, or a folder in it may have come or
 * gone.
 */
function folderChanged(key: string, keys: Map<string, boolean>, listing: Listing): boolean {
    const prefix = key ? key + '/' : '';
    for (const [k, deleted] of keys) {
        if (!k.startsWith(prefix) || k.length === prefix.length) {
            continue;
        }
        const rest = k.slice(prefix.length);
        const slash = rest.indexOf('/');
        if (slash === -1 || deleted || !listing.has(rest.slice(0, slash))) {
            return true;
        }
    }
    return false;
}

function parentOf(uri: vscode.Uri): vscode.Uri {
    const i = uri.path.lastIndexOf('/');
    return uri.with({ path: i <= 0 ? '/' : uri.path.slice(0, i) });
}
