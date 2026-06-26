import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import WebSocket from 'ws';
import type { SpaceInfo } from '../api/types';

export interface KnotLogsOptions {
    baseUrl: string;
    token: string;
    insecureSkipVerify: boolean;
    space: SpaceInfo;
}

function buildLogsUrl(opts: KnotLogsOptions): string {
    const httpUrl = new URL(opts.baseUrl);
    const wsProto = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const spaceId = encodeURIComponent(opts.space.space_id);
    return `${wsProto}//${httpUrl.host}/logs/${spaceId}/stream`;
}

/**
 * Streams a Knot space's logs into a read-only VS Code terminal.
 *
 * Wire protocol (matches web/logs-page.go HandleLogsStream):
 *  - server -> client: text frames, each an ANSI-formatted log line; history
 *    (up to ~1000 lines) is sent first, then a single 0x00 byte text frame
 *    marks the boundary, then live lines stream forever.
 */
export function createKnotLogsTerminal(opts: KnotLogsOptions): vscode.Terminal {
    const onDidWrite = new vscode.EventEmitter<string>();
    const onDidClose = new vscode.EventEmitter<number | void>();
    let ws: WebSocket | undefined;
    let closed = false;
    let closeSub: vscode.Disposable | undefined;
    let sawHistoryMarker = false;

    const writeOut = (s: string) => onDidWrite.fire(s);

    function shutdown(): void {
        closed = true;
        if (ws) {
            try {
                ws.removeAllListeners();
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close();
                }
            } catch {
                // ignore
            }
            ws = undefined;
        }
        closeSub?.dispose();
        closeSub = undefined;
        onDidWrite.dispose();
        onDidClose.dispose();
    }

    function connect(): void {
        const url = buildLogsUrl(opts);
        const wsOptions: WebSocket.ClientOptions = {};
        if (new URL(opts.baseUrl).protocol === 'https:' && opts.insecureSkipVerify) {
            wsOptions.agent = new https.Agent({ rejectUnauthorized: false });
        }

        const sock = new WebSocket(url, {
            ...wsOptions,
            headers: { Authorization: `Bearer ${opts.token}` },
        });
        ws = sock;

        sock.on('message', (data: Buffer) => {
            // End-of-history marker: a single 0x00 byte text frame.
            if (data.length === 1 && data[0] === 0) {
                if (!sawHistoryMarker) {
                    sawHistoryMarker = true;
                    writeOut('\r\n\x1b[90m\u2014 live tail \u2014\x1b[0m\r\n\r\n');
                }
                return;
            }
            writeOut(data.toString('utf8'));
        });
        sock.on('unexpected-response', (_req: http.ClientRequest, res: http.IncomingMessage) => {
            writeOut(`\r\n\x1b[91mKnot logs rejected: HTTP ${res.statusCode}\x1b[0m\r\n`);
            onDidClose.fire(1);
        });
        sock.on('error', (err: Error) => {
            writeOut(`\r\n\x1b[91mKnot logs error: ${err.message}\x1b[0m\r\n`);
            if (!closed) {
                onDidClose.fire(1);
            }
        });
        sock.on('close', () => {
            if (!closed) {
                if (!sawHistoryMarker) {
                    // Never connected to a live agent session (e.g. logs opened
                    // for a space that isn't running). Leave the terminal open
                    // with a message instead of flashing it open then disposing.
                    writeOut('\r\n\x1b[90m[space not running — close to dismiss]\x1b[0m\r\n');
                    return;
                }
                writeOut('\r\n\x1b[90m[stream ended]\x1b[0m\r\n');
                onDidClose.fire();
            }
        });
    }

    const pty: vscode.Pseudoterminal = {
        onDidWrite: onDidWrite.event,
        onDidClose: onDidClose.event,
        open: () => {
            writeOut(`\x1b[1mKnot logs: ${opts.space.name || opts.space.space_id}\x1b[0m\r\n\r\n`);
            connect();
        },
        close: () => {
            shutdown();
        },
        handleInput: () => {
            // Logs are read-only; ignore input.
        },
    };

    const terminal = vscode.window.createTerminal({
        name: `knot logs: ${opts.space.name || opts.space.space_id}`,
        pty,
    });

    // When the remote stream ends (space stopped / connection dropped), dispose
    // the terminal so it doesn't linger in the panel.
    closeSub = onDidClose.event(() => {
        setTimeout(() => {
            try {
                terminal.dispose();
            } catch {
                // already disposed
            }
        }, 150);
    });

    return terminal;
}
