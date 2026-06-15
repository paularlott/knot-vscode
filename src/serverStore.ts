import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { KnotClient } from './api/client';
import type { UserResponse } from './api/types';

/** A configured Knot server, including its secret token. */
export interface ServerConfig {
    id: string;
    name?: string;
    address: string;
    token: string;
    insecure: boolean;
}

/** A live connection to a server: the config plus a validated client + user. */
export interface ConnectedServer {
    config: ServerConfig;
    client: KnotClient;
    user: UserResponse;
}

const STORAGE_KEY = 'knot.servers';
const LEGACY_TOKEN_KEY = 'knot.apiToken';

export function serverLabel(config: ServerConfig): string {
    return config.name?.trim() || config.address;
}

/**
 * Owns the list of configured servers and their live connections.
 * The whole list (tokens included) is persisted in SecretStorage as JSON.
 */
export class ServerStore implements vscode.Disposable {
    private servers: ServerConfig[] = [];
    private connections = new Map<string, ConnectedServer>();
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;

    constructor(private readonly secrets: vscode.SecretStorage) {}

    async load(): Promise<void> {
        const raw = await this.secrets.get(STORAGE_KEY);
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as ServerConfig[];
                if (Array.isArray(parsed)) {
                    this.servers = parsed;
                }
            } catch {
                this.servers = [];
            }
        }
        if (this.servers.length === 0) {
            await this.migrateLegacy();
        }
    }

    /** Migrate the old single-server config (knot.serverUrl + secret token). */
    private async migrateLegacy(): Promise<void> {
        const cfg = vscode.workspace.getConfiguration('knot');
        const address = cfg.get<string>('serverUrl', '').replace(/\/+$/, '');
        const insecure = cfg.get<boolean>('insecureSkipVerify', false);
        const token = await this.secrets.get(LEGACY_TOKEN_KEY);
        if (address && token) {
            this.servers = [{ id: randomUUID(), address, token, insecure }];
            await this.persist();
            try {
                await this.secrets.delete(LEGACY_TOKEN_KEY);
            } catch {
                // ignore
            }
        }
    }

    list(): ServerConfig[] {
        return this.servers;
    }

    get(id: string): ServerConfig | undefined {
        return this.servers.find((s) => s.id === id);
    }

    async add(input: Omit<ServerConfig, 'id'>): Promise<ServerConfig> {
        const server: ServerConfig = { ...input, id: randomUUID() };
        this.servers.push(server);
        await this.persist();
        this._onDidChange.fire();
        return server;
    }

    async update(id: string, changes: Partial<Omit<ServerConfig, 'id'>>): Promise<ServerConfig | undefined> {
        const idx = this.servers.findIndex((s) => s.id === id);
        if (idx === -1) {
            return undefined;
        }
        this.servers[idx] = { ...this.servers[idx], ...changes };
        await this.persist();
        // Address/token/TLS may have changed; drop the cached connection.
        await this.disconnect(id);
        this._onDidChange.fire();
        return this.servers[idx];
    }

    async remove(id: string): Promise<void> {
        this.servers = this.servers.filter((s) => s.id !== id);
        await this.disconnect(id);
        await this.persist();
        this._onDidChange.fire();
    }

    private async persist(): Promise<void> {
        await this.secrets.store(STORAGE_KEY, JSON.stringify(this.servers));
    }

    // ---- connections ----

    /** Create and validate a client for the server, caching it. Throws on auth failure. */
    async connect(id: string): Promise<ConnectedServer> {
        const existing = this.connections.get(id);
        if (existing) {
            return existing;
        }
        const config = this.get(id);
        if (!config) {
            throw new Error('Unknown server.');
        }
        const client = new KnotClient(config.address, config.token, config.insecure);
        try {
            const user = await client.whoami();
            if (!user.active) {
                throw new Error('User is inactive.');
            }
            const connected: ConnectedServer = { config, client, user };
            this.connections.set(id, connected);
            return connected;
        } catch (err) {
            client.dispose();
            throw err;
        }
    }

    async disconnect(id: string): Promise<void> {
        const conn = this.connections.get(id);
        if (conn) {
            conn.client.dispose();
            this.connections.delete(id);
        }
    }

    getConnection(id: string): ConnectedServer | undefined {
        return this.connections.get(id);
    }

    dispose(): void {
        for (const conn of this.connections.values()) {
            conn.client.dispose();
        }
        this.connections.clear();
        this._onDidChange.dispose();
    }
}
