import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import type { ApiError } from './types';

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
                    const text = Buffer.concat(chunks).toString('utf8');
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
