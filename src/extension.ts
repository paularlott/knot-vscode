import * as vscode from 'vscode';
import * as path from 'path';
import { ServerStore } from './serverStore';
import type { ServerStatus, ServerView } from './provider/spacesTreeProvider';
import { SpacesTreeProvider } from './provider/spacesTreeProvider';
import { registerCommands } from './commands';
import { KnotFileSystem, SCHEME } from './files/knotFileSystem';
import { FilesTreeProvider } from './files/filesTreeProvider';
import { registerFilesCommands } from './files/filesCommands';
import { describeError, getAutoRefresh, getRefreshInterval } from './session';
import type { PoolInfo, SpaceInfo } from './api/types';
import type { KnotEvent } from './api/events';

// While a server's event stream is open its changes arrive as they happen, and
// polling only backs it up, this many times less often.
const LIVE_POLL_FACTOR = 4;
// Change events arriving together are acted on once.
const EVENT_SETTLE_MS = 300;
// A stream no longer needed is kept this long, so flicking between views
// does not reopen it each time.
const STREAM_LINGER_MS = 15_000;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Register knot.* library stubs with Pylance for IntelliSense
    const stubPath = path.join(context.extensionPath, 'stubs');
    const pythonConfig = vscode.workspace.getConfiguration('python.analysis');
    const existing = pythonConfig.get<string[]>('extraPaths', []);
    if (!existing.includes(stubPath)) {
        pythonConfig.update('extraPaths', [...existing, stubPath], vscode.ConfigurationTarget.Global);
    }

    const store = new ServerStore(context.secrets);
    context.subscriptions.push(store);
    const tree = new SpacesTreeProvider();

    const treeView = vscode.window.createTreeView('knot.spaces', {
        treeDataProvider: tree,
        showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    // File storage: a file system under knotfs:// and a view of it. Servers
    // without file storage are left out of the view and refuse the file system.
    const knotFs = new KnotFileSystem(async (id) => ensureConnected(id));
    const filesTree = new FilesTreeProvider(store, async (id) => ensureConnected(id));
    let filesView: vscode.TreeView<unknown> | undefined;
    // File storage must not take the rest of the extension with it: if the
    // window predates the Files view (an update was installed under a running
    // window), the view is not registered and creating it throws.
    try {
        filesView = vscode.window.createTreeView('knot.files', {
            treeDataProvider: filesTree,
            showCollapseAll: true,
            dragAndDropController: filesTree,
        });
        context.subscriptions.push(
            vscode.workspace.registerFileSystemProvider(SCHEME, knotFs, { isCaseSensitive: true }),
            filesView,
            knotFs.onDidChangeFile(() => filesTree.refresh()),
            ...registerFilesCommands(store, filesTree, knotFs),
        );
    } catch (err) {
        void vscode.window.showWarningMessage(
            `Knot: file storage is unavailable (${describeError(err)}). Reload the window to finish updating the extension.`,
            'Reload Window',
        ).then((choice) => {
            if (choice === 'Reload Window') {
                void vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        });
    }

    // Per-server runtime state.
    const status = new Map<string, ServerStatus>();
    const errors = new Map<string, string>();
    const spaces = new Map<string, SpaceInfo[]>();
    const pools = new Map<string, PoolInfo[]>();
    // When each server's spaces and files were last looked at.
    const spacesAt = new Map<string, number>();
    const filesAt = new Map<string, number>();

    function buildViews(): ServerView[] {
        return store.list().map((config) => {
            const conn = store.getConnection(config.id);
            const proto: 'https' | 'http' = config.address.startsWith('https://') ? 'https' : 'http';
            return {
                config,
                status: status.get(config.id) ?? 'disconnected',
                error: errors.get(config.id),
                spaces: spaces.get(config.id),
                pools: pools.get(config.id),
                version: conn?.version,
                wildcardDomain: conn?.wildcardDomain,
                proto,
            };
        });
    }

    function render(): void {
        tree.render(buildViews());
    }

    async function ensureConnected(id: string) {
        const existing = store.getConnection(id);
        if (existing) {
            return existing;
        }
        status.set(id, 'connecting');
        errors.delete(id);
        render();
        try {
            const conn = await store.connect(id);
            status.set(id, 'connected');
            render();
            // Now it is known whether the server has file storage.
            filesTree.refresh();
            updateActivity();
            return conn;
        } catch (err) {
            status.set(id, 'error');
            errors.set(id, describeError(err));
            render();
            return undefined;
        }
    }

    async function loadSpaces(id: string): Promise<void> {
        const conn = await ensureConnected(id);
        if (!conn) {
            return;
        }
        spacesAt.set(id, Date.now());
        try {
            const list = await conn.client.listSpaces(conn.user.user_id);
            spaces.set(id, (list.spaces ?? []).filter((s) => s.user_id === conn.user.user_id));
            const poolList = await conn.client.listPools();
            pools.set(id, poolList.pools ?? []);
        } catch (err) {
            spaces.set(id, []);
            pools.set(id, []);
            errors.set(id, describeError(err));
            status.set(id, 'error');
        }
        render();
    }

    async function reloadServer(id: string): Promise<void> {
        const conn = store.getConnection(id);
        if (!conn) {
            await loadSpaces(id);
            return;
        }
        spacesAt.set(id, Date.now());
        try {
            const list = await conn.client.listSpaces(conn.user.user_id);
            spaces.set(id, (list.spaces ?? []).filter((s) => s.user_id === conn.user.user_id));
            const poolList = await conn.client.listPools();
            pools.set(id, poolList.pools ?? []);
            if (status.get(id) === 'error') {
                status.set(id, 'connected');
                errors.delete(id);
            }
        } catch (err) {
            errors.set(id, describeError(err));
            status.set(id, 'error');
        }
        render();
    }

    async function reload(): Promise<void> {
        await Promise.all(store.list().map((s) => reloadServer(s.id)));
    }

    context.subscriptions.push(...registerCommands({ store, tree, reload, reloadServer, ensureConnected }));

    // Reconcile when servers are added / removed / edited.
    context.subscriptions.push(
        store.onDidChange(async () => {
            // Drop state for removed servers.
            const ids = new Set(store.list().map((s) => s.id));
            for (const id of [...status.keys(), ...spaces.keys()]) {
                if (!ids.has(id)) {
                    status.delete(id);
                    spaces.delete(id);
                    errors.delete(id);
                }
            }
            filesTree.refresh();
            updateActivity();
            // (Re)load any server we don't yet have data for.
            await Promise.all(
                store.list().map(async (s) => {
                    if (!status.has(s.id)) {
                        await loadSpaces(s.id);
                    }
                }),
            );
            render();
        }),
    );

    // ---- live updates: each server's event stream, backed up by polling ----

    const spacesSoon = new Map<string, NodeJS.Timeout>();
    function reloadSoon(id: string): void {
        if (spacesSoon.has(id)) {
            return;
        }
        spacesSoon.set(
            id,
            setTimeout(() => {
                spacesSoon.delete(id);
                void reloadServer(id);
            }, EVENT_SETTLE_MS),
        );
    }

    const filesSoon = new Map<string, { all: boolean; ids: Set<string>; timer: NodeJS.Timeout }>();
    function syncFilesSoon(id: string, bucketIds?: string[]): void {
        let pending = filesSoon.get(id);
        if (!pending) {
            const p = {
                all: false,
                ids: new Set<string>(),
                timer: setTimeout(() => {
                    filesSoon.delete(id);
                    void syncFiles(id, p.all ? undefined : [...p.ids]);
                }, EVENT_SETTLE_MS),
            };
            pending = p;
            filesSoon.set(id, p);
        }
        if (bucketIds && bucketIds.length > 0) {
            bucketIds.forEach((b) => pending.ids.add(b));
        } else {
            pending.all = true;
        }
    }

    async function syncFiles(id: string, bucketIds?: string[]): Promise<void> {
        filesAt.set(id, Date.now());
        filesTree.refresh();
        await knotFs.sync(id, bucketIds);
    }

    /** Whether a change to spaces or pools concerns what the Spaces view shows of a server. */
    function concernsSpaces(id: string, event: KnotEvent): boolean {
        if (event.type.startsWith('pool:')) {
            return true;
        }
        if (event.type !== 'space:changed' && event.type !== 'space:deleted' && event.type !== 'port-forward:changed') {
            return false;
        }
        const me = store.getConnection(id)?.user.user_id;
        const p = event.payload;
        return !p?.user_id || p.user_id === me || (p.previous_user_ids ?? []).includes(me ?? '');
    }

    // Servers whose stream dropped: changes may have been missed meanwhile.
    const dropped = new Set<string>();
    context.subscriptions.push(
        store.onEvent(({ serverId, event }) => {
            if (event.type === 'files:changed') {
                syncFilesSoon(serverId, event.payload?.bucket_ids);
            } else if (treeView.visible && concernsSpaces(serverId, event)) {
                reloadSoon(serverId);
            }
        }),
        store.onStreamState(({ serverId, connected }) => {
            if (!connected) {
                dropped.add(serverId);
            } else if (dropped.delete(serverId)) {
                if (treeView.visible) {
                    reloadSoon(serverId);
                }
                syncFilesSoon(serverId);
            }
        }),
        {
            dispose: () => {
                spacesSoon.forEach((t) => clearTimeout(t));
                filesSoon.forEach((p) => clearTimeout(p.timer));
            },
        },
    );

    // ---- what is on screen decides what is followed ----
    //
    // A server is followed (its event stream open, and polled as a backup)
    // while the Spaces view is visible, while the Files view is visible and it
    // has file storage, or while its files are in use: a bucket added to the
    // workspace or a file of it open in an editor. Otherwise nothing is
    // fetched; showing a view again catches up.

    /** Servers whose files are in use outside the Files view. */
    function filesInUse(): Set<string> {
        const ids = new Set<string>();
        for (const f of vscode.workspace.workspaceFolders ?? []) {
            if (f.uri.scheme === SCHEME) {
                ids.add(f.uri.authority);
            }
        }
        for (const e of vscode.window.visibleTextEditors) {
            if (e.document.uri.scheme === SCHEME) {
                ids.add(e.document.uri.authority);
            }
        }
        return ids;
    }

    function followsFiles(id: string, inUse: Set<string>): boolean {
        const conn = store.getConnection(id);
        return !!conn && conn.filesEnabled !== false && (!!filesView?.visible || inUse.has(id));
    }

    const lingering = new Map<string, NodeJS.Timeout>();
    function updateActivity(): void {
        const inUse = filesInUse();
        let any = false;
        for (const s of store.list()) {
            if (!store.getConnection(s.id)) {
                continue;
            }
            const wanted = treeView.visible || followsFiles(s.id, inUse);
            any ||= wanted;
            const pending = lingering.get(s.id);
            if (wanted) {
                if (pending) {
                    clearTimeout(pending);
                    lingering.delete(s.id);
                }
                store.setStreaming(s.id, true);
            } else if (!pending) {
                lingering.set(
                    s.id,
                    setTimeout(() => {
                        lingering.delete(s.id);
                        store.setStreaming(s.id, false);
                        // Closed on purpose: catching up is left to showing a view again.
                        dropped.delete(s.id);
                    }, STREAM_LINGER_MS),
                );
            }
        }
        if (any) {
            startPolling();
        } else {
            stopPolling();
        }
    }

    // Polling: each tick looks again at a server whose stream is down, and,
    // less often, at one whose stream is open, for what is being followed.
    let timer: NodeJS.Timeout | undefined;
    function poll(): void {
        const interval = getRefreshInterval() * 1000;
        const now = Date.now();
        const inUse = filesInUse();
        const due = (id: string, at: Map<string, number>) =>
            now - (at.get(id) ?? 0) >= (store.isLive(id) ? interval * LIVE_POLL_FACTOR : interval) - 1000;
        for (const s of store.list()) {
            if (treeView.visible && due(s.id, spacesAt)) {
                void reloadServer(s.id);
            }
            if (followsFiles(s.id, inUse) && due(s.id, filesAt)) {
                void syncFiles(s.id);
            }
        }
    }
    function startPolling(): void {
        if (timer || !getAutoRefresh()) {
            return;
        }
        timer = setInterval(poll, getRefreshInterval() * 1000);
    }
    function stopPolling(): void {
        if (timer) {
            clearInterval(timer);
            timer = undefined;
        }
    }
    context.subscriptions.push({
        dispose: () => {
            stopPolling();
            lingering.forEach((t) => clearTimeout(t));
        },
    });

    context.subscriptions.push(
        treeView.onDidChangeVisibility((e) => {
            updateActivity();
            if (e.visible) {
                void reload();
            }
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => updateActivity()),
        vscode.window.onDidChangeVisibleTextEditors(() => updateActivity()),
    );
    if (filesView) {
        context.subscriptions.push(
            filesView.onDidChangeVisibility((e) => {
                updateActivity();
                if (e.visible) {
                    for (const s of store.list()) {
                        if (store.getConnection(s.id)) {
                            void syncFiles(s.id);
                        }
                    }
                }
            }),
        );
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('knot.autoRefresh') || e.affectsConfiguration('knot.refreshInterval')) {
                stopPolling();
                updateActivity();
            }
        }),
    );

    // Boot: load persisted servers, connect to each, then poll if visible.
    await store.load();
    render();
    // The Files view first asked before the servers were loaded.
    filesTree.refresh();
    await Promise.all(store.list().map((s) => loadSpaces(s.id)));
    updateActivity();
}

export function deactivate(): void {
    // disposables registered via context.subscriptions
}
