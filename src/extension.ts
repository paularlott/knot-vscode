import * as vscode from 'vscode';
import { ServerStore } from './serverStore';
import type { ServerStatus, ServerView } from './provider/spacesTreeProvider';
import { SpacesTreeProvider } from './provider/spacesTreeProvider';
import { registerCommands } from './commands';
import { describeError, getAutoRefresh, getRefreshInterval } from './session';
import type { SpaceInfo } from './api/types';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const store = new ServerStore(context.secrets);
    const tree = new SpacesTreeProvider();

    const treeView = vscode.window.createTreeView('knot.spaces', {
        treeDataProvider: tree,
        showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    // Per-server runtime state.
    const status = new Map<string, ServerStatus>();
    const errors = new Map<string, string>();
    const spaces = new Map<string, SpaceInfo[]>();

    function buildViews(): ServerView[] {
        return store.list().map((config) => ({
            config,
            status: status.get(config.id) ?? 'disconnected',
            error: errors.get(config.id),
            spaces: spaces.get(config.id),
        }));
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
        try {
            // The API returns owned + shared spaces for a user; keep only the
            // user's own, in the server's zone (zone is filtered server-side).
            const list = await conn.client.listSpaces(conn.user.user_id);
            spaces.set(id, (list.spaces ?? []).filter((s) => s.user_id === conn.user.user_id));
        } catch (err) {
            spaces.set(id, []);
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
        try {
            const list = await conn.client.listSpaces(conn.user.user_id);
            spaces.set(id, (list.spaces ?? []).filter((s) => s.user_id === conn.user.user_id));
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

    // Auto-refresh: only while the Knot view is visible.
    let timer: NodeJS.Timeout | undefined;
    function startPolling(): void {
        if (timer) {
            return; // already running
        }
        if (!getAutoRefresh()) {
            return; // disabled by setting
        }
        if (!treeView.visible) {
            return; // view hidden
        }
        const seconds = getRefreshInterval();
        timer = setInterval(() => {
            void reload();
        }, seconds * 1000);
    }
    function stopPolling(): void {
        if (timer) {
            clearInterval(timer);
            timer = undefined;
        }
    }

    // Visibility drives polling: open -> refresh now + poll; close -> stop.
    context.subscriptions.push(
        treeView.onDidChangeVisibility((e) => {
            if (e.visible) {
                void reload();
                startPolling();
            } else {
                stopPolling();
            }
        }),
    );
    context.subscriptions.push({ dispose: () => stopPolling() });

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('knot.autoRefresh') || e.affectsConfiguration('knot.refreshInterval')) {
                stopPolling();
                startPolling();
            }
        }),
    );

    // Boot: load persisted servers, connect to each, then poll if visible.
    await store.load();
    render();
    await Promise.all(store.list().map((s) => loadSpaces(s.id)));
    startPolling();
}

export function deactivate(): void {
    // disposables registered via context.subscriptions
}
