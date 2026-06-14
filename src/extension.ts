import * as vscode from 'vscode';
import { Session, getAutoRefresh, getRefreshInterval, getServerUrl } from './session';
import { SpacesTreeProvider } from './provider/spacesTreeProvider';
import { registerCommands } from './commands';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const session = new Session(context.secrets);
    const tree = new SpacesTreeProvider();

    const treeView = vscode.window.createTreeView('knot.spaces', {
        treeDataProvider: tree,
        showCollapseAll: false,
    });
    context.subscriptions.push(treeView);

    context.subscriptions.push(...registerCommands({ session, tree, reload: refreshFromSession }));

    // Re-render the tree when the session (connect/disconnect) changes.
    context.subscriptions.push(
        session.onDidChange(async () => {
            if (session.connected) {
                await refreshFromSession();
            } else {
                tree.setSpaces([]);
            }
            updateTreeViewTitle();
        }),
    );

    // Rebuild the client when server URL / TLS setting changes.
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('knot.serverUrl') || e.affectsConfiguration('knot.insecureSkipVerify')) {
                void tryReconnect();
            }
            if (e.affectsConfiguration('knot.autoRefresh') || e.affectsConfiguration('knot.refreshInterval')) {
                restartAutoRefresh();
            }
        }),
    );

    // Auto-refresh polling.
    let autoRefreshTimer: NodeJS.Timeout | undefined;
    function restartAutoRefresh(): void {
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = undefined;
        }
        if (!getAutoRefresh()) {
            return;
        }
        const seconds = getRefreshInterval();
        autoRefreshTimer = setInterval(() => {
            if (session.connected) {
                void refreshFromSession();
            }
        }, seconds * 1000);
    }
    context.subscriptions.push({ dispose: () => autoRefreshTimer && clearInterval(autoRefreshTimer) });

    async function refreshFromSession(): Promise<void> {
        const client = session.client;
        if (!client) {
            tree.setSpaces([]);
            return;
        }
        tree.setLoading(true);
        try {
            const list = await client.listSpaces();
            tree.setSpaces(list.spaces ?? []);
        } catch {
            // Non-fatal: keep stale list. Notifications handled by explicit actions.
            tree.setLoading(false);
        }
    }

    async function tryReconnect(): Promise<void> {
        if (!getServerUrl()) {
            tree.setSpaces([]);
            return;
        }
        try {
            await session.connect();
        } catch {
            // Token may be missing/invalid; stay disconnected until explicit login.
            tree.setSpaces([]);
        }
    }

    function updateTreeViewTitle(): void {
        const user = session.user;
        treeView.message = user ? `Connected as ${user.username}` : undefined;
    }

    // On activate: attempt silent connect if a token is already stored.
    await tryReconnect();
    updateTreeViewTitle();
    restartAutoRefresh();
}

export function deactivate(): void {
    // nothing to do; disposables are registered via context.subscriptions
}
