import * as vscode from 'vscode';
import { KnotClient, KnotHttpError } from './api/client';
import type { UserResponse } from './api/types';

export const SECRET_KEY = 'knot.apiToken';

export function getServerUrl(): string {
    return vscode.workspace.getConfiguration('knot').get<string>('serverUrl', '').replace(/\/+$/, '');
}

export function getInsecureSkipVerify(): boolean {
    return vscode.workspace.getConfiguration('knot').get<boolean>('insecureSkipVerify', false);
}

export function getAutoRefresh(): boolean {
    return vscode.workspace.getConfiguration('knot').get<boolean>('autoRefresh', true);
}

export function getRefreshInterval(): number {
    return vscode.workspace.getConfiguration('knot').get<number>('refreshInterval', 15);
}

/**
 * Holds the active KnotClient and current user identity.
 * Recreated whenever the server URL / token / TLS setting changes.
 */
export class Session implements vscode.Disposable {
    private _client: KnotClient | undefined;
    private _user: UserResponse | undefined;
    private _token: string | undefined;
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;

    constructor(private readonly secrets: vscode.SecretStorage) {}

    get client(): KnotClient | undefined {
        return this._client;
    }

    get user(): UserResponse | undefined {
        return this._user;
    }

    get token(): string | undefined {
        return this._token;
    }

    get connected(): boolean {
        return !!this._client && !!this._user;
    }

    /** Load token from secret storage and build a client, validating via whoami. */
    async connect(tokenOverride?: string): Promise<UserResponse> {
        const url = getServerUrl();
        if (!url) {
            throw new Error('No Knot server URL configured. Set "knot.serverUrl" in Settings.');
        }
        const token = tokenOverride ?? (await this.secrets.get(SECRET_KEY));
        if (!token) {
            throw new Error('No API token configured. Run "Knot: Connect to Server".');
        }

        const client = new KnotClient(url, token, getInsecureSkipVerify());
        const user = await client.whoami();
        if (!user.active) {
            client.dispose();
            throw new Error('API token belongs to an inactive user.');
        }

        this._client?.dispose();
        this._client = client;
        this._user = user;
        this._token = token;

        await this.secrets.store(SECRET_KEY, token);
        this._onDidChange.fire();
        return user;
    }

    async disconnect(): Promise<void> {
        try {
            await this.secrets.delete(SECRET_KEY);
        } catch {
            // ignore
        }
        this._client?.dispose();
        this._client = undefined;
        this._user = undefined;
        this._token = undefined;
        this._onDidChange.fire();
    }

    dispose(): void {
        this._client?.dispose();
        this._onDidChange.dispose();
    }
}

/** Translate any error into a user-friendly message, surfacing knot's error body. */
export function describeError(err: unknown): string {
    if (err instanceof KnotHttpError) {
        if (err.status === 401 || err.status === 403) {
            return `Authentication failed (${err.status}). Check your API token.`;
        }
        return `${err.message} (HTTP ${err.status} ${err.path})`;
    }
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}
