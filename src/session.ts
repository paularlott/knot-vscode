import * as vscode from 'vscode';
import { KnotHttpError } from './api/client';

export function getAutoRefresh(): boolean {
    return vscode.workspace.getConfiguration('knot').get<boolean>('autoRefresh', true);
}

export function getRefreshInterval(): number {
    return vscode.workspace.getConfiguration('knot').get<number>('refreshInterval', 15);
}

export function defaultInsecure(): boolean {
    return vscode.workspace.getConfiguration('knot').get<boolean>('insecureSkipVerify', false);
}

/** Translate any error into a user-friendly message, surfacing knot's error body. */
export function describeError(err: unknown): string {
    if (err instanceof KnotHttpError) {
        if (err.status === 401 || err.status === 403) {
            return `Authentication failed (HTTP ${err.status}). Check the API token.`;
        }
        return `${err.message} (HTTP ${err.status} ${err.path})`;
    }
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}
