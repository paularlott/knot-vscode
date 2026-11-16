import * as vscode from 'vscode';
import * as path from 'path';

const STORAGE_KEY = 'knot.projectFolders';

/**
 * The folder "Open in VSCode" opens in each space, kept on this machine only.
 * Keyed by server and space ID so a renamed space keeps its folder. Paths are
 * stored as the user typed them (e.g. `~/testing-project`) and resolved
 * against the space's home folder when opening. `~` means the user chose the
 * home folder; no entry means they haven't been asked yet.
 */
export class ProjectFolders {
    constructor(private readonly state: vscode.Memento) {}

    private all(): Record<string, string> {
        return this.state.get<Record<string, string>>(STORAGE_KEY, {});
    }

    private key(serverId: string, spaceId: string): string {
        return `${serverId}/${spaceId}`;
    }

    get(serverId: string, spaceId: string): string | undefined {
        return this.all()[this.key(serverId, spaceId)];
    }

    /** Set the folder for a space; undefined forgets it, so the next open asks again. */
    async set(serverId: string, spaceId: string, folder: string | undefined): Promise<void> {
        const next = { ...this.all() };
        const k = this.key(serverId, spaceId);
        if (folder) {
            next[k] = folder;
        } else {
            delete next[k];
        }
        await this.state.update(STORAGE_KEY, next);
    }

    /** Forget every space's folder on a server. */
    async clearServer(serverId: string): Promise<void> {
        const prefix = `${serverId}/`;
        const all = this.all();
        const next = Object.fromEntries(Object.entries(all).filter(([k]) => !k.startsWith(prefix)));
        if (Object.keys(next).length !== Object.keys(all).length) {
            await this.state.update(STORAGE_KEY, next);
        }
    }
}

/** Tidy a folder as typed: trim, drop trailing slashes, turn a bare `~/` into `~`. */
export function normalizeProjectFolder(input: string): string {
    let folder = input.trim();
    if (!folder) {
        return '';
    }
    folder = path.posix.normalize(folder);
    if (folder.length > 1) {
        folder = folder.replace(/\/+$/, '');
    }
    return folder;
}

/**
 * Resolve a stored folder to an absolute path in the space: `~` and relative
 * paths are taken from the user's home folder, absolute paths are used as-is.
 */
export function resolveProjectFolder(folder: string | undefined, home: string): string {
    if (!folder || folder === '~') {
        return home;
    }
    if (folder.startsWith('/')) {
        return folder;
    }
    const rel = folder.startsWith('~/') ? folder.slice(2) : folder;
    return path.posix.join(home, rel);
}
