import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import WebSocket from 'ws';
import type { SpaceInfo } from '../api/types';

const RESIZE_FLAG = 0x01;

interface TerminalWindowSize {
    rows: number;
    cols: number;
}

export interface KnotTerminalOptions {
    baseUrl: string;
    token: string;
    insecureSkipVerify: boolean;
    space: SpaceInfo;
    shell: string;
}

function buildTerminalUrl(opts: KnotTerminalOptions): string {
    const http = new URL(opts.baseUrl);
    const wsProto = http.protocol === 'https:' ? 'wss:' : 'ws:';
    const shell = encodeURIComponent(opts.shell || 'bash');
    const spaceId = encodeURIComponent(opts.space.space_id);
    return `${wsProto}//${http.host}/proxy/spaces/${spaceId}/terminal/${shell}`;
}

/**
 * Bridges a Knot web terminal WebSocket to a native VS Code terminal.
 *
 * Wire protocol (matches internal/proxy/spaces-terminal.go):
 *  - server -> client: binary frames are raw PTY output bytes
 *  - client -> server: text frames are terminal input
 *  - client -> server: binary frame starting with 0x01 + JSON {rows,cols} = resize
 */
export function createKnotTerminal(opts: KnotTerminalOptions): vscode.Terminal {
    const onDidWrite = new vscode.EventEmitter<string>();
    const onDidClose = new vscode.EventEmitter<number | void>();
    let ws: WebSocket | undefined;
    let closed = false;
    let closeSub: vscode.Disposable | undefined;

    const writeOut = (s: string) => onDidWrite.fire(s);
    const writeErr = (s: string) => onDidWrite.fire(s);

    function sendResize(rows: number, cols: number): void {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }
        const payload: TerminalWindowSize = { rows, cols };
        const frame = Buffer.concat([Buffer.from([RESIZE_FLAG]), Buffer.from(JSON.stringify(payload), 'utf8')]);
        ws.send(frame, { binary: true, mask: true });
    }

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

    function connect(initialDimensions?: vscode.TerminalDimensions): void {
        const url = buildTerminalUrl(opts);
        const wsOptions: WebSocket.ClientOptions = {};
        if (new URL(opts.baseUrl).protocol === 'https:' && opts.insecureSkipVerify) {
            wsOptions.agent = new https.Agent({ rejectUnauthorized: false });
        }

        const sock = new WebSocket(url, {
            ...wsOptions,
            headers: { Authorization: `Bearer ${opts.token}` },
        });
        ws = sock;

        sock.on('open', () => {
            if (initialDimensions) {
                sendResize(initialDimensions.rows, initialDimensions.columns);
            }
        });
        sock.on('message', (data: Buffer) => {
            // Raw PTY bytes -> terminal.
            writeOut(data.toString('binary'));
        });
        sock.on('unexpected-response', (_req: http.ClientRequest, res: http.IncomingMessage) => {
            writeErr(`\r\nKnot terminal rejected: HTTP ${res.statusCode}\r\n`);
            onDidClose.fire(1);
        });
        sock.on('error', (err: Error) => {
            writeErr(`\r\nKnot terminal error: ${err.message}\r\n`);
            if (!closed) {
                onDidClose.fire(1);
            }
        });
        sock.on('close', () => {
            if (!closed) {
                writeErr('\r\n[connection closed]\r\n');
                onDidClose.fire();
            }
        });
    }

    const pty: vscode.Pseudoterminal = {
        onDidWrite: onDidWrite.event,
        onDidClose: onDidClose.event,
        open: (initialDimensions) => {
            connect(initialDimensions);
        },
        close: () => {
            shutdown();
        },
        handleInput: (data) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                // Text frame = raw terminal input (matches xterm.js browser behavior).
                ws.send(data, { binary: false, mask: true });
            }
        },
        setDimensions: (dimensions) => {
            sendResize(dimensions.rows, dimensions.columns);
        },
    };

    const terminal = vscode.window.createTerminal({
        name: `knot: ${opts.space.name || opts.space.space_id}`,
        pty,
    });

    // When the remote session ends (e.g. user types `exit`, or the connection
    // drops), dispose the terminal so it doesn't linger in the panel.
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
