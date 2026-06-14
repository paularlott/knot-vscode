import * as vscode from 'vscode';
import type { SpaceInfo } from '../api/types';

export type SpaceLifecycle =
    | 'running'
    | 'starting'
    | 'stopped'
    | 'deleting'
    | 'unknown';

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

function buildContextValue(lifecycle: SpaceLifecycle, space: SpaceInfo): string {
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
        this.contextValue = buildContextValue(lifecycle, space);
        // No command on click: selecting a row should never spawn a terminal.
    }
}

/** A collapsible group of spaces sharing a stack name. */
export class StackItem extends vscode.TreeItem {
    readonly children: SpaceItem[] = [];

    constructor(readonly stackName: string) {
        super(stackName, vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon('layers');
        this.contextValue = 'knot-stack';
        this.tooltip = `Stack: ${stackName}`;
    }
}

export class SpacesTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private readonly _onDidChange = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChange.event;

    private roots: (StackItem | SpaceItem)[] = [];
    private stacks: StackItem[] = [];
    private spaces: SpaceItem[] = [];
    private loading = false;

    refresh(): void {
        this._onDidChange.fire(undefined);
    }

    setLoading(loading: boolean): void {
        this.loading = loading;
        this._onDidChange.fire(undefined);
    }

    /** Flat snapshot of all space items (including those inside stacks). */
    getSpaces(): SpaceItem[] {
        return this.spaces;
    }

    /** Snapshot of all stack nodes. */
    getStacks(): StackItem[] {
        return this.stacks;
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (element instanceof StackItem) {
            return element.children;
        }
        if (element) {
            return [];
        }
        if (this.loading && this.roots.length === 0) {
            return [new LoadingItem()];
        }
        if (this.roots.length === 0) {
            return [new EmptyItem()];
        }
        return this.roots;
    }

    setSpaces(spaces: SpaceInfo[]): void {
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

        const roots: (StackItem | SpaceItem)[] = [];
        const stacks: StackItem[] = [];
        const allSpaces: SpaceItem[] = [];

        for (const name of [...groups.keys()].sort()) {
            const stackSpaces = groups.get(name)!;
            const stack = new StackItem(name);
            stackSpaces
                .sort((a, b) => (a.name || a.space_id).localeCompare(b.name || b.space_id))
                .forEach((s) => {
                    const item = new SpaceItem(s, deriveLifecycle(s));
                    stack.children.push(item);
                    allSpaces.push(item);
                });
            stack.description = `${stackSpaces.length} space${stackSpaces.length === 1 ? '' : 's'}`;
            roots.push(stack);
            stacks.push(stack);
        }

        standalone
            .sort((a, b) => (a.name || a.space_id).localeCompare(b.name || b.space_id))
            .forEach((s) => {
                const item = new SpaceItem(s, deriveLifecycle(s));
                roots.push(item);
                allSpaces.push(item);
            });

        this.roots = roots;
        this.stacks = stacks;
        this.spaces = allSpaces;
        this.loading = false;
        this._onDidChange.fire(undefined);
    }
}

class LoadingItem extends vscode.TreeItem {
    constructor() {
        super('Loading\u2026', vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('loading~spin');
        this.contextValue = 'knot-message';
    }
}

class EmptyItem extends vscode.TreeItem {
    constructor() {
        super('No spaces', vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('info');
        this.contextValue = 'knot-message';
        this.tooltip = 'No spaces visible. Create one with the + button, or refresh.';
    }
}
