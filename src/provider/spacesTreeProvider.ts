import * as vscode from 'vscode';
import type { SpaceInfo } from '../api/types';
import type { ServerConfig } from '../serverStore';
import { serverLabel } from '../serverStore';

export type SpaceLifecycle = 'running' | 'starting' | 'stopped' | 'deleting' | 'unknown';

export function deriveLifecycle(s: SpaceInfo): SpaceLifecycle {
    if (s.is_deleting) {
        return 'deleting';
    }
    if (s.is_pending) {
        return 'starting';
    }
    if (s.is_deployed && s.has_state) {
        return 'running';
    }
    if (s.is_deployed && !s.has_state) {
        return 'starting';
    }
    return 'stopped';
}

function iconFor(lifecycle: SpaceLifecycle): vscode.ThemeIcon {
    switch (lifecycle) {
        case 'running':
            return new vscode.ThemeIcon('circle-large-filled', new vscode.ThemeColor('testing.iconPassed'));
        case 'starting':
            return new vscode.ThemeIcon('loading~spin', new vscode.ThemeColor('testing.iconQueued'));
        case 'deleting':
            return new vscode.ThemeIcon('loading~spin', new vscode.ThemeColor('testing.iconFailed'));
        case 'stopped':
            return new vscode.ThemeIcon('circle-large-outline', new vscode.ThemeColor('disabledForeground'));
        default:
            return new vscode.ThemeIcon('circle-large-outline');
    }
}

function statusLabel(lifecycle: SpaceLifecycle): string {
    switch (lifecycle) {
        case 'running':
            return 'Running';
        case 'starting':
            return 'Starting';
        case 'deleting':
            return 'Deleting';
        case 'stopped':
            return 'Stopped';
        default:
            return 'Unknown';
    }
}

function buildSpaceContextValue(lifecycle: SpaceLifecycle, space: SpaceInfo): string {
    const flags: string[] = ['knot-space'];
    if (lifecycle === 'running') {
        flags.push('running');
        if (space.has_terminal) {
            flags.push('terminal');
        }
        if (space.has_code_server) {
            flags.push('code-server');
        }
        if (space.has_ssh) {
            flags.push('ssh');
        }
    }
    return flags.join('-');
}

export class SpaceItem extends vscode.TreeItem {
    constructor(
        readonly space: SpaceInfo,
        readonly lifecycle: SpaceLifecycle,
        readonly serverId: string,
    ) {
        super(space.name || space.space_id, vscode.TreeItemCollapsibleState.None);

        const parts: string[] = [statusLabel(lifecycle)];
        if (space.template_name) {
            parts.push(space.template_name);
        }
        if (space.is_remote) {
            parts.push(`zone:${space.zone}`);
        }
        this.description = parts.join(' \u00b7 ');

        const tooltipLines = [
            `**${space.name || space.space_id}**`,
            `Status: ${statusLabel(lifecycle)}`,
            `Template: ${space.template_name || space.template_id}`,
            `User: ${space.username}`,
        ];
        if (space.stack) {
            tooltipLines.push(`Stack: ${space.stack}`);
        }
        if (space.node_hostname) {
            tooltipLines.push(`Node: ${space.node_hostname}`);
        }
        if (space.has_code_server) {
            tooltipLines.push('code-server: yes');
        }
        if (space.has_terminal) {
            tooltipLines.push('terminal: yes');
        }
        if (space.has_ssh) {
            tooltipLines.push('ssh: yes');
        }
        this.tooltip = new vscode.MarkdownString(tooltipLines.join('  \n'));

        this.iconPath = iconFor(lifecycle);
        this.contextValue = buildSpaceContextValue(lifecycle, space);
    }
}

/** A collapsible group of spaces sharing a stack name, within one server. */
export class StackItem extends vscode.TreeItem {
    readonly children: SpaceItem[] = [];

    constructor(readonly stackName: string, readonly serverId: string) {
        super(stackName, vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon('layers');
        this.contextValue = 'knot-stack';
        this.tooltip = `Stack: ${stackName}`;
    }
}

/** A configured server node. Stable id so expand/collapse state survives reloads. */
export class ServerNode extends vscode.TreeItem {
    children: vscode.TreeItem[] = [];

    constructor(
        readonly serverId: string,
        config: ServerConfig,
        status: ServerStatus,
    ) {
        super(serverLabel(config), vscode.TreeItemCollapsibleState.Expanded);
        this.id = `server:${serverId}`;
        this.iconPath = new vscode.ThemeIcon('server');
        this.contextValue = 'knot-server';

        const desc: string[] = [];
        if (status === 'connecting') {
            desc.push('connecting\u2026');
        } else if (status === 'error') {
            desc.push('error');
        } else if (status === 'connected') {
            desc.push('connected');
        }
        this.description = desc.join(', ');

        const lines = [`**${serverLabel(config)}**`, `Address: ${config.address}`];
        if (config.insecure) {
            lines.push('TLS verification: disabled');
        }
        if (status === 'error') {
            lines.push(`Status: error`);
        }
        this.tooltip = new vscode.MarkdownString(lines.join('  \n'));
    }
}

export type ServerStatus = 'connecting' | 'connected' | 'error' | 'disconnected';

export interface ServerView {
    config: ServerConfig;
    status: ServerStatus;
    error?: string;
    spaces?: SpaceInfo[];
}

class MessageItem extends vscode.TreeItem {
    constructor(label: string, kind: 'info' | 'warn' | 'loading' = 'info') {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.iconPath =
            kind === 'loading'
                ? new vscode.ThemeIcon('loading~spin')
                : kind === 'warn'
                  ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground'))
                  : new vscode.ThemeIcon('info');
        this.contextValue = 'knot-message';
    }
}

export class SpacesTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private readonly _onDidChange = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChange.event;

    private roots: ServerNode[] = [];
    private loading = false;

    refresh(): void {
        this._onDidChange.fire(undefined);
    }

    setLoading(loading: boolean): void {
        this.loading = loading;
        this._onDidChange.fire(undefined);
    }

    getSpaces(): SpaceItem[] {
        const out: SpaceItem[] = [];
        for (const node of this.roots) {
            this.collectSpaces(node.children, out);
        }
        return out;
    }

    private collectSpaces(items: vscode.TreeItem[], out: SpaceItem[]): void {
        for (const item of items) {
            if (item instanceof StackItem) {
                out.push(...item.children);
            } else if (item instanceof SpaceItem) {
                out.push(item);
            }
        }
    }

    getStacks(): StackItem[] {
        const out: StackItem[] = [];
        for (const node of this.roots) {
            for (const child of node.children) {
                if (child instanceof StackItem) {
                    out.push(child);
                }
            }
        }
        return out;
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (element instanceof ServerNode) {
            return element.children;
        }
        if (element instanceof StackItem) {
            return element.children;
        }
        if (element) {
            return [];
        }
        if (this.loading && this.roots.length === 0) {
            return [new MessageItem('Loading\u2026', 'loading')];
        }
        if (this.roots.length === 0) {
            return [new MessageItem('No servers yet \u2014 click + to add one')];
        }
        return this.roots;
    }

    /** Replace the entire tree from a set of per-server views. */
    render(views: ServerView[]): void {
        this.roots = views.map((view) => buildServerNode(view));
        this.loading = false;
        this._onDidChange.fire(undefined);
    }
}

function buildServerNode(view: ServerView): ServerNode {
    const node = new ServerNode(view.config.id, view.config, view.status);

    if (view.status === 'connecting') {
        node.children = [new MessageItem('Connecting\u2026', 'loading')];
        return node;
    }
    if (view.status === 'error') {
        node.children = [new MessageItem(view.error || 'Connection failed', 'warn')];
        return node;
    }
    if (view.status !== 'connected') {
        node.children = [new MessageItem('Disconnected')];
        return node;
    }

    const spaces = view.spaces ?? [];
    if (spaces.length === 0) {
        node.children = [new MessageItem('No spaces')];
        return node;
    }

    const groups = new Map<string, SpaceInfo[]>();
    const standalone: SpaceInfo[] = [];
    for (const s of spaces) {
        if (s.stack) {
            let bucket = groups.get(s.stack);
            if (!bucket) {
                bucket = [];
                groups.set(s.stack, bucket);
            }
            bucket.push(s);
        } else {
            standalone.push(s);
        }
    }

    const children: (StackItem | SpaceItem)[] = [];
    for (const name of [...groups.keys()].sort()) {
        const stack = new StackItem(name, view.config.id);
        groups
            .get(name)!
            .sort((a, b) => (a.name || a.space_id).localeCompare(b.name || b.space_id))
            .forEach((s) => stack.children.push(new SpaceItem(s, deriveLifecycle(s), view.config.id)));
        stack.description = `${stack.children.length} space${stack.children.length === 1 ? '' : 's'}`;
        children.push(stack);
    }
    standalone
        .sort((a, b) => (a.name || a.space_id).localeCompare(b.name || b.space_id))
        .forEach((s) => children.push(new SpaceItem(s, deriveLifecycle(s), view.config.id)));

    node.children = children;
    return node;
}
