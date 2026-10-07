import * as vscode from 'vscode';
import type { ConnectedServer, ServerStore } from '../serverStore';
import { serverLabel } from '../serverStore';
import type { FileBucketInfo } from '../api/types';
import { describeError } from '../session';
import { makeUri } from './knotFileSystem';
import { moveEntry } from './filesMove';

export type FilesNode = ServerNode | BucketNode | EntryNode | MessageNode;

export class ServerNode extends vscode.TreeItem {
    constructor(readonly serverId: string, label: string) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'knot-files-server';
        this.iconPath = new vscode.ThemeIcon('server');
    }
}

export class BucketNode extends vscode.TreeItem {
    readonly readOnly: boolean;
    constructor(readonly serverId: string, readonly bucket: FileBucketInfo) {
        super(bucket.display_name || bucket.name, vscode.TreeItemCollapsibleState.Collapsed);
        this.readOnly = bucket.access === 'read';
        this.contextValue = this.readOnly ? 'knot-files-bucket-ro' : 'knot-files-bucket';
        this.iconPath = new vscode.ThemeIcon('database');
        this.description = bucket.access === 'owner' ? undefined : `shared by ${bucket.owner_name} (${bucket.access})`;
        this.tooltip = `${bucket.name}: ${bucket.count} files`;
        this.resourceUri = makeUri(serverId, bucket.name);
    }
}

export class EntryNode extends vscode.TreeItem {
    constructor(
        readonly serverId: string,
        readonly bucket: string,
        readonly key: string,
        readonly isDir: boolean,
        readonly readOnly: boolean,
    ) {
        super(
            key.split('/').pop() ?? key,
            isDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        );
        const kind = isDir ? 'folder' : 'file';
        this.contextValue = `knot-files-${kind}${readOnly ? '-ro' : ''}`;
        this.resourceUri = makeUri(serverId, bucket, key);
        if (!isDir) {
            this.command = { command: 'vscode.open', title: 'Open', arguments: [this.resourceUri] };
        }
    }
}

export class MessageNode extends vscode.TreeItem {
    constructor(message: string) {
        super(message, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'knot-files-message';
        this.iconPath = new vscode.ThemeIcon('info');
    }
}

/**
 * The Files view: each server that has file storage, its buckets, and the
 * folders and files in them. Servers without file storage are left out.
 */
export class FilesTreeProvider implements vscode.TreeDataProvider<FilesNode>, vscode.TreeDragAndDropController<FilesNode> {
    readonly dragMimeTypes = ['application/vnd.code.tree.knot.files'];
    readonly dropMimeTypes = ['application/vnd.code.tree.knot.files'];

    private readonly emitter = new vscode.EventEmitter<FilesNode | undefined>();
    readonly onDidChangeTreeData = this.emitter.event;

    constructor(
        private readonly store: ServerStore,
        private readonly ensureConnected: (id: string) => Promise<ConnectedServer | undefined>,
    ) {}

    refresh(): void {
        this.emitter.fire(undefined);
    }

    getTreeItem(node: FilesNode): vscode.TreeItem {
        return node;
    }

    async getChildren(node?: FilesNode): Promise<FilesNode[]> {
        if (!node) {
            return this.servers();
        }
        if (node instanceof ServerNode) {
            return this.buckets(node.serverId);
        }
        if (node instanceof BucketNode) {
            return this.entries(node.serverId, node.bucket.name, '', node.readOnly);
        }
        if (node instanceof EntryNode && node.isDir) {
            return this.entries(node.serverId, node.bucket, node.key, node.readOnly);
        }
        return [];
    }

    private async servers(): Promise<FilesNode[]> {
        const configs = this.store.list();
        const conns = await Promise.all(configs.map((c) => this.ensureConnected(c.id)));
        const out: FilesNode[] = [];
        configs.forEach((config, i) => {
            const conn = conns[i];
            // A server that is down shows in the Spaces view; one without file
            // storage has nothing to show here.
            if (conn && conn.filesEnabled !== false) {
                out.push(new ServerNode(config.id, serverLabel(config)));
            }
        });
        return out;
    }

    private async buckets(serverId: string): Promise<FilesNode[]> {
        const conn = await this.ensureConnected(serverId);
        if (!conn) {
            return [new MessageNode('The server is not available')];
        }
        try {
            const list = (await conn.client.listFileBuckets()).buckets ?? [];
            if (list.length === 0) {
                return [new MessageNode('No buckets: create one in the Files page of the web interface')];
            }
            return list.map((b) => new BucketNode(serverId, b));
        } catch (err) {
            return [new MessageNode(`File storage is not available: ${describeError(err)}`)];
        }
    }

    private async entries(serverId: string, bucket: string, key: string, readOnly: boolean): Promise<FilesNode[]> {
        const conn = await this.ensureConnected(serverId);
        if (!conn) {
            return [new MessageNode('The server is not available')];
        }
        try {
            const prefix = key ? key + '/' : '';
            const folders: EntryNode[] = [];
            const files: EntryNode[] = [];
            let after = '';
            for (;;) {
                const page = await conn.client.listFileObjects(bucket, prefix, '/', after);
                for (const p of page.prefixes ?? []) {
                    const name = p.replace(/\/+$/, '');
                    if (name.length > prefix.length) {
                        folders.push(new EntryNode(serverId, bucket, name, true, readOnly));
                    }
                }
                for (const o of page.objects ?? []) {
                    if (o.key.length > prefix.length && !o.key.slice(prefix.length).includes('/')) {
                        files.push(new EntryNode(serverId, bucket, o.key, false, readOnly));
                    }
                }
                if (!page.is_truncated || !page.next) {
                    break;
                }
                after = page.next;
            }
            return [...folders, ...files];
        } catch (err) {
            return [new MessageNode(describeError(err))];
        }
    }

    // ---- drag and drop: files and folders are moved onto a folder or bucket ----

    handleDrag(source: readonly FilesNode[], data: vscode.DataTransfer): void {
        const entries = source.filter((n): n is EntryNode => n instanceof EntryNode && !n.readOnly);
        if (entries.length > 0) {
            data.set(
                this.dragMimeTypes[0],
                new vscode.DataTransferItem(entries.map((e) => ({ serverId: e.serverId, bucket: e.bucket, key: e.key }))),
            );
        }
    }

    async handleDrop(target: FilesNode | undefined, data: vscode.DataTransfer): Promise<void> {
        const item = data.get(this.dropMimeTypes[0]);
        if (!item || !target || target instanceof MessageNode || target instanceof ServerNode) {
            return;
        }
        if ((target instanceof BucketNode && target.readOnly) || (target instanceof EntryNode && target.readOnly)) {
            void vscode.window.showWarningMessage('That bucket is shared with you for reading only.');
            return;
        }
        // Dropped on a file, an item goes into the folder that holds it.
        const serverId = target.serverId;
        const bucket = target instanceof BucketNode ? target.bucket.name : target.bucket;
        let folder = '';
        if (target instanceof EntryNode) {
            folder = target.isDir ? target.key : target.key.includes('/') ? target.key.slice(0, target.key.lastIndexOf('/')) : '';
        }
        const moved = item.value as { serverId: string; bucket: string; key: string }[];
        let any = false;
        for (const m of moved) {
            if (m.serverId !== serverId || m.bucket !== bucket) {
                void vscode.window.showWarningMessage('Files can only be moved within their own bucket.');
                continue;
            }
            const name = m.key.split('/').pop() ?? m.key;
            const dest = folder ? `${folder}/${name}` : name;
            if (dest === m.key || folder === m.key || folder.startsWith(m.key + '/')) {
                continue; // already there, or into itself
            }
            try {
                await moveEntry(serverId, bucket, m.key, dest);
                any = true;
            } catch (err) {
                void vscode.window.showErrorMessage(`Could not move ${m.key}: ${describeError(err)}`);
            }
        }
        if (any) {
            this.refresh();
        }
    }
}
