import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import * as zlib from 'zlib';
import type { ApiError } from './types';
import { EventStream } from './events';
import type { KnotEvent } from './events';

export class KnotHttpError extends Error {
    constructor(
        public readonly status: number,
        public readonly statusText: string,
        message: string,
        public readonly path: string,
    ) {
        super(message);
        this.name = 'KnotHttpError';
    }
}

interface RequestOptions {
    method: string;
    path: string;
    body?: unknown;
    expectStatus?: number;
}

export class HttpClient {
    private readonly baseURL: string;
    private readonly token: string;
    private readonly agent: https.Agent;

    constructor(baseURL: string, token: string, insecureSkipVerify: boolean) {
        this.baseURL = baseURL.replace(/\/+$/, '');
        this.token = token;
        this.agent = new https.Agent({
            keepAlive: true,
            rejectUnauthorized: !insecureSkipVerify,
        });
    }

    private buildURL(path: string): URL {
        const p = path.startsWith('/') ? path : `/${path}`;
        return new URL(p, this.baseURL);
    }

    async request<T>(opts: RequestOptions): Promise<T> {
        const url = this.buildURL(opts.path);
        const body = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;

        return new Promise<T>((resolve, reject) => {
            const isHttps = url.protocol === 'https:';
            const lib = isHttps ? https : http;
            const requestOpts: https.RequestOptions = {
                method: opts.method,
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                headers: {
                    Accept: 'application/json',
                    // Listings and change feeds are large and compress well.
                    'Accept-Encoding': 'gzip',
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.token}`,
                },
                agent: isHttps ? this.agent : undefined,
            };
            if (body !== undefined) {
                (requestOpts.headers as Record<string, string>)['Content-Length'] = Buffer.byteLength(body).toString();
            }

            const req = lib.request(requestOpts, (res: http.IncomingMessage) => {
                const chunks: Buffer[] = [];
                res.on('data', (c: Buffer) => chunks.push(c));
                res.on('end', () => {
                    let raw = Buffer.concat(chunks);
                    if (String(res.headers['content-encoding'] ?? '').toLowerCase() === 'gzip') {
                        try {
                            raw = zlib.gunzipSync(raw);
                        } catch (err) {
                            reject(err);
                            return;
                        }
                    }
                    const text = raw.toString('utf8');
                    if (opts.expectStatus !== undefined && res.statusCode !== opts.expectStatus) {
                        const msg = extractError(text) || res.statusMessage || 'request failed';
                        reject(new KnotHttpError(res.statusCode ?? 0, res.statusMessage ?? '', msg, opts.path));
                        return;
                    }
                    if (res.statusCode && res.statusCode >= 400) {
                        const msg = extractError(text) || res.statusMessage || 'request failed';
                        reject(new KnotHttpError(res.statusCode, res.statusMessage ?? '', msg, opts.path));
                        return;
                    }
                    if (text.length === 0) {
                        resolve(undefined as T);
                        return;
                    }
                    try {
                        resolve(JSON.parse(text) as T);
                    } catch {
                        resolve(text as unknown as T);
                    }
                });
            });

            req.on('error', (err) => reject(err));
            if (body !== undefined) {
                req.write(body);
            }
            req.end();
        });
    }

    /**
     * A request that carries and returns raw bytes with its headers, for file
     * content. A status of 400 or more is an error, unless it is listed in
     * `allow` (a 404 from a HEAD is an answer, not a failure).
     */
    requestRaw(opts: {
        method: string;
        path: string;
        body?: Buffer;
        headers?: Record<string, string>;
        allow?: number[];
    }): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
        const url = this.buildURL(opts.path);
        return new Promise((resolve, reject) => {
            const isHttps = url.protocol === 'https:';
            const lib = isHttps ? https : http;
            const headers: Record<string, string> = {
                Authorization: `Bearer ${this.token}`,
                ...(opts.headers ?? {}),
            };
            if (opts.body !== undefined) {
                headers['Content-Length'] = String(opts.body.length);
            }
            const req = lib.request(
                {
                    method: opts.method,
                    hostname: url.hostname,
                    port: url.port || (isHttps ? 443 : 80),
                    path: url.pathname + url.search,
                    headers,
                    agent: isHttps ? this.agent : undefined,
                },
                (res: http.IncomingMessage) => {
                    const chunks: Buffer[] = [];
                    res.on('data', (c: Buffer) => chunks.push(c));
                    res.on('end', () => {
                        const body = Buffer.concat(chunks);
                        const status = res.statusCode ?? 0;
                        if (status >= 400 && !(opts.allow ?? []).includes(status)) {
                            const msg = extractError(body.toString('utf8')) || res.statusMessage || 'request failed';
                            reject(new KnotHttpError(status, res.statusMessage ?? '', msg, opts.path));
                            return;
                        }
                        resolve({ status, headers: res.headers, body });
                    });
                },
            );
            req.on('error', (err) => reject(err));
            if (opts.body !== undefined) {
                req.write(opts.body);
            }
            req.end();
        });
    }

    get<T>(path: string): Promise<T> {
        return this.request<T>({ method: 'GET', path });
    }

    post<T>(path: string, body?: unknown, expectStatus?: number): Promise<T> {
        return this.request<T>({ method: 'POST', path, body, expectStatus });
    }

    put<T>(path: string, body?: unknown, expectStatus?: number): Promise<T> {
        return this.request<T>({ method: 'PUT', path, body, expectStatus });
    }

    delete<T>(path: string): Promise<T> {
        return this.request<T>({ method: 'DELETE', path });
    }

    /** The server's event stream; it does nothing until started. */
    events(handlers: { onEvent: (event: KnotEvent) => void; onState: (connected: boolean) => void }): EventStream {
        return new EventStream(this.baseURL, this.token, this.agent, handlers);
    }

    dispose(): void {
        this.agent.destroy();
    }
}

function extractError(text: string): string | undefined {
    if (!text) {
        return undefined;
    }
    try {
        const parsed = JSON.parse(text) as ApiError;
        if (parsed && typeof parsed.error === 'string') {
            return parsed.error;
        }
    } catch {
        // not JSON
    }
    return text.length < 500 ? text : undefined;
}
