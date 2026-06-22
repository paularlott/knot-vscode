import * as vscode from 'vscode';
import type { PoolInfo, SpaceInfo } from '../api/types';
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
    const prefix = space.pool_id ? 'knot-poolspace' : 'knot-space';
    const flags: string[] = [prefix, lifecycle];
    if (lifecycle === 'running') {
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

export type StackLifecycle = 'running' | 'stopped' | 'mixed';

/** Aggregate a stack's child space lifecycles into a single state for button gating. */
export function deriveStackLifecycle(items: SpaceItem[]): StackLifecycle {
    if (items.length === 0) {
        return 'stopped';
    }
    if (items.every((i) => i.lifecycle === 'running')) {
        return 'running';
    }
    if (items.every((i) => i.lifecycle === 'stopped')) {
        return 'stopped';
    }
    return 'mixed';
}

export class SpaceItem extends vscode.TreeItem {
    readonly webPorts: WebPortItem[] = [];

    constructor(
        readonly space: SpaceInfo,
        readonly lifecycle: SpaceLifecycle,
        readonly serverId: string,
    ) {
        super(space.name || space.space_id, vscode.TreeItemCollapsibleState.None);

        const parts: string[] = [];
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
        this.refreshLifecycle();
    }

    /** Recompute contextValue/description/tooltip from the current child spaces. */
    refreshLifecycle(): void {
        const lifecycle = deriveStackLifecycle(this.children);
        this.contextValue = `knot-stack-${lifecycle}`;
        const count = this.children.length;
        const stateLabel =
            lifecycle === 'running' ? 'Running' : lifecycle === 'stopped' ? 'Stopped' : 'Mixed';
        this.description = `${count} space${count === 1 ? '' : 's'} \u00b7 ${stateLabel}`;
        this.tooltip = `Stack: ${this.stackName} (${stateLabel})`;
    }
}

export type PoolLifecycle = 'active' | 'stopped';

export class PoolItem extends vscode.TreeItem {
    readonly children: SpaceItem[] = [];

    constructor(readonly pool: PoolInfo, readonly serverId: string) {
        super(pool.name, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon('package');
        this.refresh(pool);
    }

    refresh(pool: PoolInfo): void {
        const lifecycle: PoolLifecycle = pool.active ? 'active' : 'stopped';
        this.contextValue = `knot-pool-${lifecycle}`;
        const alive = pool.alive_members;
        const desired = pool.desired_count;
        const stateLabel = pool.active ? 'Active' : 'Stopped';
        this.description = `${alive} / ${desired} space${desired === 1 ? '' : 's'} \u00b7 ${stateLabel}`;
        this.tooltip = `Pool: ${this.pool.name} (${stateLabel}, ${alive}/${desired} alive)`;
    }
}

/** A configured server node. Stable id so expand/collapse state survives reloads. */
export class ServerNode extends vscode.TreeItem {
    children: vscode.TreeItem[] = [];

    constructor(
        readonly serverId: string,
        config: ServerConfig,
        status: ServerStatus,
        version?: string,
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
        if (version) {
            desc.push(`v${version}`);
        }
        this.description = desc.join(', ');

        const lines = [`**${serverLabel(config)}**`, `Address: ${config.address}`];
        if (version) {
            lines.push(`Version: ${version}`);
        }
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
    pools?: PoolInfo[];
    /** knot server version. */
    version?: string;
    /** Server wildcard domain, used to build web-port URLs. */
    wildcardDomain?: string;
    /** Protocol derived from the server address. */
    proto?: 'https' | 'http';
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

    getPools(): PoolItem[] {
        const out: PoolItem[] = [];
        for (const node of this.roots) {
            for (const child of node.children) {
                if (child instanceof PoolItem) {
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
        if (element instanceof PoolItem) {
            return element.children;
        }
        if (element instanceof SpaceItem) {
            return element.webPorts;
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
    const node = new ServerNode(view.config.id, view.config, view.status, view.version);

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

    const allSpaces = view.spaces ?? [];
    const pools = view.pools ?? [];
    const poolById = new Map(pools.map((p) => [p.pool_id, p]));

    // Partition: pool members vs non-pool spaces
    const poolSpaces: SpaceInfo[] = [];
    const nonPoolSpaces: SpaceInfo[] = [];
    for (const s of allSpaces) {
        if (s.pool_id) {
            poolSpaces.push(s);
        } else {
            nonPoolSpaces.push(s);
        }
    }

    if (allSpaces.length === 0 && pools.length === 0) {
        node.children = [new MessageItem('No spaces')];
        return node;
    }

    // --- Non-pool spaces: standalone + stacks (same as before) ---
    const groups = new Map<string, SpaceInfo[]>();
    const standalone: SpaceInfo[] = [];
    for (const s of nonPoolSpaces) {
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

    const children: (StackItem | SpaceItem | PoolItem)[] = [];
    standalone
        .sort((a, b) => (a.name || a.space_id).localeCompare(b.name || b.space_id))
        .forEach((s) => children.push(makeSpaceItem(s, view)));
    for (const name of [...groups.keys()].sort()) {
        const stack = new StackItem(name, view.config.id);
        groups
            .get(name)!
            .sort((a, b) => (a.name || a.space_id).localeCompare(b.name || b.space_id))
            .forEach((s) => stack.children.push(makeSpaceItem(s, view)));
        stack.refreshLifecycle();
        children.push(stack);
    }

    // --- Pool groups ---
    const spacesByPool = new Map<string, SpaceInfo[]>();
    for (const s of poolSpaces) {
        let bucket = spacesByPool.get(s.pool_id);
        if (!bucket) {
            bucket = [];
            spacesByPool.set(s.pool_id, bucket);
        }
        bucket.push(s);
    }
    for (const pool of pools) {
        const poolItem = new PoolItem(pool, view.config.id);
        const members = spacesByPool.get(pool.pool_id) ?? [];
        members
            .sort((a, b) => (a.name || a.space_id).localeCompare(b.name || b.space_id))
            .forEach((s) => poolItem.children.push(makeSpaceItem(s, view)));
        children.push(poolItem);
    }

    node.children = children;
    return node;
}

/** A clickable web-port (dev URL) under a running space. */
export class WebPortItem extends vscode.TreeItem {
    constructor(label: string, readonly url: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('globe');
        this.contextValue = 'knot-webport';
        this.tooltip = url;
        this.command = { command: 'knot.openWebPort', title: 'Open', arguments: [url] };
    }
}

interface WebPortEntry {
    name: string;
    port: string;
    label: string;
}

/** Build a SpaceItem and, for running spaces with web ports, its web-port children. */
function makeSpaceItem(s: SpaceInfo, view: ServerView): SpaceItem {
    const item = new SpaceItem(s, deriveLifecycle(s), view.config.id);
    if (view.wildcardDomain && s.has_state && s.http_ports) {
        const proto = view.proto ?? 'https';
        for (const e of webPortEntries(s)) {
            const url = buildWebPortUrl(proto, view.wildcardDomain!, s.username, e.name, e.port);
            if (url) {
                item.webPorts.push(new WebPortItem(e.label, url));
            }
        }
        if (item.webPorts.length > 0) {
            item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        }
    }
    return item;
}

/** Mirror of the web UI's getHttpPortEntries: http_ports plus alt-name aliases. */
function webPortEntries(space: SpaceInfo): WebPortEntry[] {
    const entries: WebPortEntry[] = [];
    const ports = space.http_ports ?? {};
    for (const [key, value] of Object.entries(ports)) {
        entries.push({ name: space.name, port: key, label: key === value ? key : `${value} (${key})` });
    }
    for (const alt of space.alt_names ?? []) {
        const portStr = String(alt.port ?? 0);
        if ((alt.port ?? 0) > 0 && ports[portStr] !== undefined) {
            entries.push({ name: alt.name, port: portStr, label: `${alt.name} (${ports[portStr]})` });
        }
    }
    return entries;
}

/** Build the dev URL: <proto>//<user>--<name>--<port> substituted into the wildcard domain. */
function buildWebPortUrl(proto: string, wildcard: string, user: string, name: string, port: string): string | undefined {
    if (!wildcard) {
        return undefined;
    }
    const sub = `${user}--${name}--${port}`.toLowerCase();
    const host = wildcard.startsWith('*') ? wildcard.replace(/^\*/, sub) : `${sub}.${wildcard}`;
    return `${proto}://${host}`;
}
