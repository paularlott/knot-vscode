import * as vscode from 'vscode';
import { makeUri } from './knotFileSystem';

/**
 * Moves a file, or a folder and everything in it, to a new path in the same
 * bucket, on the server. The destination must not exist.
 */
export async function moveEntry(serverId: string, bucket: string, from: string, to: string): Promise<void> {
    await vscode.workspace.fs.rename(makeUri(serverId, bucket, from), makeUri(serverId, bucket, to), { overwrite: false });
}
