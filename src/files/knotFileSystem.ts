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

    constructor(private readonly getConn: (serverId: string) => Promise<ConnectedServer | undefined>) {}

    watch(): vscode.Disposable {
        // Changes made elsewhere are seen on refresh.
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
            const { serverId, bucket, key } = parseUri(uri);
            const conn = await this.conn(serverId);
            if (!bucket) {
                const list = await this.bucketList(conn, true);
                return list.map((b) => [b.name, vscode.FileType.Directory]);
            }
            await this.bucket(conn, bucket, uri);

            const prefix = key ? key + '/' : '';
            const out = new Map<string, vscode.FileType>();
            let after = '';
            for (;;) {
                const page = await conn.client.listFileObjects(bucket, prefix, '/', after);
                for (const p of page.prefixes ?? []) {
                    const name = p.slice(prefix.length).replace(/\/+$/, '');
                    if (name) {
                        out.set(name, vscode.FileType.Directory);
                    }
                }
                for (const o of page.objects ?? []) {
                    const name = o.key.slice(prefix.length);
                    // A key ending in a slash is a folder marker, not a file.
                    if (name && !name.includes('/')) {
                        out.set(name, vscode.FileType.File);
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
                        out.set(rest, vscode.FileType.Directory);
                    }
                }
            }
            return [...out.entries()];
        } catch (err) {
            throw this.mapError(err, uri);
        }
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        try {
            const { serverId, bucket, key } = parseUri(uri);
            if (!bucket || !key) {
                throw vscode.FileSystemError.FileIsADirectory(uri);
            }
            const conn = await this.conn(serverId);
            return await conn.client.readFileContent(bucket, key);
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
            try {
                await conn.client.writeFileContent(
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
            this.fire([
                { type: vscode.FileChangeType.Created, uri },
                { type: vscode.FileChangeType.Changed, uri: parentOf(uri) },
            ]);
        } catch (err) {
            throw this.mapError(err, uri);
        }
    }

    // ---- helpers ----

    /** Forgets what is known of a path and of everything inside it, and of its parent. */
    private forget(uri: vscode.Uri): void {
        const s = uri.toString();
        for (const k of [...this.stats.keys()]) {
            if (k === s || k.startsWith(s + '/') || k === parentOf(uri).toString()) {
                this.stats.delete(k);
            }
        }
        this.buckets.delete(uri.authority);
    }

    private fire(events: vscode.FileChangeEvent[]): void {
        this.emitter.fire(events);
    }

    /** Drops everything cached, for a manual refresh. */
    refresh(): void {
        this.stats.clear();
        this.buckets.clear();
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

function parentOf(uri: vscode.Uri): vscode.Uri {
    const i = uri.path.lastIndexOf('/');
    return uri.with({ path: i <= 0 ? '/' : uri.path.slice(0, i) });
}
