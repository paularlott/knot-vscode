import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

/** One message from the server's event stream, e.g. `files:changed`. */
export interface KnotEvent {
    type: string;
    payload?: {
        id?: string;
        user_id?: string;
        shared_with_user_ids?: string[];
        previous_user_ids?: string[];
        bucket_ids?: string[];
    };
}

const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
// The server sends a keep-alive every 5s; silence for longer means a dead link.
const IDLE_TIMEOUT_MS = 20_000;

/**
 * The server's Server-Sent Events stream (/api/events), held open and
 * reopened with backoff when it drops. A stream the server refuses (the token
 * is no longer valid) is not retried until `start()` is called again.
 */
export class EventStream {
    private req: http.ClientRequest | undefined;
    private retry: NodeJS.Timeout | undefined;
    private idle: NodeJS.Timeout | undefined;
    private delay = MIN_DELAY_MS;
    private stopped = true;
    private _connected = false;

    constructor(
        private readonly baseURL: string,
        private readonly token: string,
        private readonly agent: https.Agent,
        private readonly handlers: {
            onEvent: (event: KnotEvent) => void;
            /** The stream opened (true) or closed (false). */
            onState: (connected: boolean) => void;
        },
    ) {}

    get connected(): boolean {
        return this._connected;
    }

    start(): void {
        if (!this.stopped) {
            return;
        }
        this.stopped = false;
        this.delay = MIN_DELAY_MS;
        this.open();
    }

    stop(): void {
        this.stopped = true;
        clearTimeout(this.retry);
        this.retry = undefined;
        this.close();
    }

    private open(): void {
        const url = new URL('/api/events', this.baseURL);
        const isHttps = url.protocol === 'https:';
        const lib = isHttps ? https : http;
        const req = lib.request({
            method: 'GET',
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            headers: {
                Accept: 'text/event-stream',
                'Cache-Control': 'no-cache',
                Authorization: `Bearer ${this.token}`,
            },
            agent: isHttps ? this.agent : undefined,
        });
        this.req = req;

        req.on('response', (res) => {
            const status = res.statusCode ?? 0;
            if (status !== 200) {
                res.resume();
                this.close();
                // 401/403: the token is refused; polling surfaces the error.
                if (status === 401 || status === 403) {
                    this.stopped = true;
                } else {
                    this.scheduleRetry();
                }
                return;
            }
            this.delay = MIN_DELAY_MS;
            this.setConnected(true);
            this.touch();

            let buffer = '';
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => {
                this.touch();
                buffer += chunk;
                // Events end with a blank line.
                let end: number;
                while ((end = buffer.search(/\r?\n\r?\n/)) !== -1) {
                    const block = buffer.slice(0, end);
                    buffer = buffer.slice(end).replace(/^\r?\n\r?\n/, '');
                    this.dispatch(block);
                }
            });
            res.on('end', () => this.dropped());
            res.on('error', () => this.dropped());
        });
        req.on('error', () => this.dropped());
        req.end();
    }

    private dispatch(block: string): void {
        let name = 'message';
        const data: string[] = [];
        for (const line of block.split(/\r?\n/)) {
            if (line.startsWith(':')) {
                continue; // comment: keep-alive
            }
            const i = line.indexOf(':');
            const field = i === -1 ? line : line.slice(0, i);
            const value = i === -1 ? '' : line.slice(i + 1).replace(/^ /, '');
            if (field === 'event') {
                name = value;
            } else if (field === 'data') {
                data.push(value);
            }
        }
        if (name !== 'message' || data.length === 0) {
            return;
        }
        let event: KnotEvent;
        try {
            event = JSON.parse(data.join('\n')) as KnotEvent;
        } catch {
            return;
        }
        if (event.type === 'auth:required') {
            // The token was deleted or logged out.
            this.stopped = true;
            this.close();
            return;
        }
        try {
            this.handlers.onEvent(event);
        } catch {
            // a listener's failure must not end the stream
        }
    }

    private touch(): void {
        clearTimeout(this.idle);
        this.idle = setTimeout(() => this.dropped(), IDLE_TIMEOUT_MS);
    }

    private dropped(): void {
        if (!this.req) {
            return; // already closed
        }
        this.close();
        this.scheduleRetry();
    }

    private scheduleRetry(): void {
        if (this.stopped || this.retry) {
            return;
        }
        const delay = this.delay;
        this.delay = Math.min(this.delay * 2, MAX_DELAY_MS);
        this.retry = setTimeout(() => {
            this.retry = undefined;
            if (!this.stopped) {
                this.open();
            }
        }, delay);
    }

    private close(): void {
        clearTimeout(this.idle);
        this.idle = undefined;
        const req = this.req;
        this.req = undefined;
        req?.destroy();
        this.setConnected(false);
    }

    private setConnected(connected: boolean): void {
        if (this._connected !== connected) {
            this._connected = connected;
            this.handlers.onState(connected);
        }
    }
}
