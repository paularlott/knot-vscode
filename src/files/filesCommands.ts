import * as vscode from 'vscode';
import * as fsp from 'fs/promises';
import * as nodePath from 'path';
import type { ServerStore } from '../serverStore';
import { serverLabel } from '../serverStore';
import { describeError } from '../session';
import type { FilesTreeProvider } from './filesTreeProvider';
import { BucketNode, EntryNode } from './filesTreeProvider';
import type { KnotFileSystem } from './knotFileSystem';
import { moveEntry } from './filesMove';
import { makeUri } from './knotFileSystem';

type Node = BucketNode | EntryNode;

function uriOf(node: Node): vscode.Uri {
    return node instanceof BucketNode
        ? makeUri(node.serverId, node.bucket.name)
        : makeUri(node.serverId, node.bucket, node.key);
}

/** The key prefix a new item goes under: the folder it is made in, or the bucket's root. */
function prefixOf(node: Node): string {
    return node instanceof BucketNode ? '' : node.key + '/';
}

/** Whether name is a usable relative path: no empty parts, no dot parts, not rooted. */
function validRelativePath(name: string): string | undefined {
    const parts = name.split('/');
    if (!name.trim()) {
        return 'Enter a name';
    }
    if (name.startsWith('/') || name.endsWith('/') || parts.some((p) => p === '' || p === '.' || p === '..')) {
        return 'Enter a relative path such as notes.txt or app/settings.toml';
    }
    return undefined;
}

async function exists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

/** Every file under a local folder, with its path relative to the folder. */
async function walk(dir: string, rel = ''): Promise<{ abs: string; rel: string }[]> {
    const out: { abs: string; rel: string }[] = [];
    for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
        const abs = nodePath.join(dir, entry.name);
        const r = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            out.push(...(await walk(abs, r)));
        } else if (entry.isFile()) {
            out.push({ abs, rel: r });
        }
    }
    return out;
}

export function registerFilesCommands(store: ServerStore, tree: FilesTreeProvider, fs: KnotFileSystem): vscode.Disposable[] {
    const refresh = () => {
        fs.refresh();
        tree.refresh();
        // Editors and the Explorer follow what changed on the server.
        for (const s of store.list()) {
            void fs.sync(s.id);
        }
    };

    return [
        vscode.commands.registerCommand('knot.files.refresh', refresh),

        // Adds a bucket or folder to the workspace, where the Explorer browses and edits it.
        vscode.commands.registerCommand('knot.files.addToWorkspace', (node?: Node) => {
            if (!node) {
                return;
            }
            const config = store.get(node.serverId);
            const bucket = node instanceof BucketNode ? node.bucket.display_name || node.bucket.name : node.bucket;
            const path = node instanceof BucketNode ? '' : '/' + node.key;
            const name = `${config ? serverLabel(config) : 'Knot'}: ${bucket}${path}`;
            const added = vscode.workspace.updateWorkspaceFolders(
                vscode.workspace.workspaceFolders?.length ?? 0,
                0,
                { uri: uriOf(node), name },
            );
            if (!added) {
                void vscode.window.showWarningMessage('That folder is already in the workspace.');
            }
        }),

        // A new, empty file, given as a path and name. Folders exist once they hold a file, so a new
        // folder is made by naming a file in it.
        vscode.commands.registerCommand('knot.files.newFile', async (node?: Node) => {
            if (!node) {
                return;
            }
            const name = await vscode.window.showInputBox({
                title: 'New file',
                prompt: 'Path and file name; folders that don\'t exist are created with it, e.g. app/settings.toml',
                validateInput: validRelativePath,
            });
            if (!name) {
                return;
            }
            const key = prefixOf(node) + name.trim();
            const uri = makeUri(node.serverId, node instanceof BucketNode ? node.bucket.name : node.bucket, key);
            try {
                if (await exists(uri)) {
                    void vscode.window.showErrorMessage(`${key} already exists.`);
                    return;
                }
                await vscode.workspace.fs.writeFile(uri, new Uint8Array());
                refresh();
                await vscode.window.showTextDocument(uri);
            } catch (err) {
                void vscode.window.showErrorMessage(`Could not create the file: ${describeError(err)}`);
            }
        }),

        // Files and folders from this machine, folders with everything in them.
        vscode.commands.registerCommand('knot.files.upload', async (node?: Node) => {
            if (!node) {
                return;
            }
            const picked = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: true,
                canSelectMany: true,
                openLabel: 'Upload',
                title: 'Upload files and folders',
            });
            if (!picked || picked.length === 0) {
                return;
            }
            const bucket = node instanceof BucketNode ? node.bucket.name : node.bucket;
            const prefix = prefixOf(node);
            const items: { abs: string; key: string }[] = [];
            try {
                for (const uri of picked) {
                    const stat = await fsp.stat(uri.fsPath);
                    const base = nodePath.basename(uri.fsPath);
                    if (stat.isDirectory()) {
                        for (const f of await walk(uri.fsPath)) {
                            items.push({ abs: f.abs, key: `${prefix}${base}/${f.rel}` });
                        }
                    } else {
                        items.push({ abs: uri.fsPath, key: prefix + base });
                    }
                }
            } catch (err) {
                void vscode.window.showErrorMessage(`Could not read what was chosen: ${describeError(err)}`);
                return;
            }
            if (items.length === 0) {
                void vscode.window.showInformationMessage('There were no files to upload.');
                return;
            }

            const target = (key: string) => makeUri(node.serverId, bucket, key);
            const existing: string[] = [];
            for (const it of items) {
                if (await exists(target(it.key))) {
                    existing.push(it.key);
                }
            }
            let skip = new Set<string>();
            if (existing.length > 0) {
                const choice = await vscode.window.showWarningMessage(
                    `${existing.length} of the ${items.length} files already exist. Replace them?`,
                    { modal: true },
                    'Replace',
                    'Skip existing',
                );
                if (!choice) {
                    return;
                }
                if (choice === 'Skip existing') {
                    skip = new Set(existing);
                }
            }

            const todo = items.filter((it) => !skip.has(it.key));
            const failures: string[] = [];
            let done = 0;
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Uploading to file storage', cancellable: true },
                async (progress, cancel) => {
                    let next = 0;
                    const worker = async () => {
                        while (!cancel.isCancellationRequested) {
                            const it = todo[next++];
                            if (!it) {
                                return;
                            }
                            try {
                                await vscode.workspace.fs.writeFile(target(it.key), await fsp.readFile(it.abs));
                                done++;
                            } catch (err) {
                                failures.push(`${it.key}: ${describeError(err)}`);
                            }
                            progress.report({ message: `${done} of ${todo.length}`, increment: 100 / todo.length });
                        }
                    };
                    await Promise.all([worker(), worker(), worker(), worker()]);
                },
            );
            refresh();
            if (failures.length > 0) {
                void vscode.window.showErrorMessage(
                    `Uploaded ${done} of ${todo.length} files. ${failures.length} failed: ${failures.slice(0, 3).join('; ')}${failures.length > 3 ? '…' : ''}`,
                );
            } else {
                void vscode.window.showInformationMessage(`Uploaded ${done} ${done === 1 ? 'file' : 'files'}.`);
            }
        }),

        vscode.commands.registerCommand('knot.files.rename', async (node?: EntryNode) => {
            if (!node) {
                return;
            }
            const current = node.key.split('/').pop() ?? node.key;
            const next = await vscode.window.showInputBox({
                title: `Rename ${current}`,
                value: current,
                validateInput: (v) => (!v.trim() || v.includes('/') ? 'Enter a name without slashes' : undefined),
            });
            if (!next || next === current) {
                return;
            }
            const parent = node.key.includes('/') ? node.key.slice(0, node.key.lastIndexOf('/') + 1) : '';
            try {
                await vscode.workspace.fs.rename(uriOf(node), makeUri(node.serverId, node.bucket, parent + next.trim()), {
                    overwrite: false,
                });
                refresh();
            } catch (err) {
                void vscode.window.showErrorMessage(`Rename failed: ${describeError(err)}`);
            }
        }),

        // Move to another path in the bucket: a full new path, or a folder (ending in a slash) to move into.
        vscode.commands.registerCommand('knot.files.move', async (node?: EntryNode) => {
            if (!node) {
                return;
            }
            const name = node.key.split('/').pop() ?? node.key;
            const input = await vscode.window.showInputBox({
                title: `Move ${node.key}`,
                prompt: 'The new path in this bucket, or a folder ending in / to move it into (e.g. archive/)',
                value: node.key,
                valueSelection: [0, node.key.length],
                validateInput: (v) => {
                    const path = v.endsWith('/') ? v.slice(0, -1) : v;
                    return v === '/' ? undefined : validRelativePath(path);
                },
            });
            if (!input || input === node.key) {
                return;
            }
            // A folder to move into keeps the name; "/" is the bucket's top level.
            const dest = input.endsWith('/') ? `${input === '/' ? '' : input}${name}` : input;
            if (dest === node.key) {
                return;
            }
            if (dest.startsWith(node.key + '/')) {
                void vscode.window.showErrorMessage('A folder cannot be moved into itself.');
                return;
            }
            try {
                await moveEntry(node.serverId, node.bucket, node.key, dest);
                refresh();
            } catch (err) {
                void vscode.window.showErrorMessage(`Move failed: ${describeError(err)}`);
            }
        }),

        vscode.commands.registerCommand('knot.files.delete', async (node?: EntryNode) => {
            if (!node) {
                return;
            }
            const what = node.isDir ? `the folder ${node.key} and everything in it` : node.key;
            const choice = await vscode.window.showWarningMessage(`Delete ${what}?`, { modal: true }, 'Delete');
            if (choice !== 'Delete') {
                return;
            }
            try {
                await vscode.workspace.fs.delete(uriOf(node), { recursive: true });
                refresh();
            } catch (err) {
                void vscode.window.showErrorMessage(`Delete failed: ${describeError(err)}`);
            }
        }),
    ];
}
