import { HttpClient } from './http';
import type {
    CreateSpaceResponse,
    FileBucketList,
    FileChangeList,
    FileObjectList,
    PortApplyRequest,
    PoolList,
    ReadFileRequest,
    ReadFileResponse,
    RunCommandRequest,
    RunCommandResponse,
    ServerInfo,
    SpaceDefinition,
    SpaceInfo,
    SpaceInfoList,
    SpaceRequest,
    StackDefinitionList,
    TemplateList,
    UserResponse,
    WriteFileRequest,
    WriteFileResponse,
} from './types';

export { KnotHttpError } from './http';
export type * from './types';

export class KnotClient {
    readonly http: HttpClient;
    readonly baseUrl: string;

    constructor(baseUrl: string, token: string, insecureSkipVerify: boolean) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.http = new HttpClient(this.baseUrl, token, insecureSkipVerify);
    }

    // ---- Auth ----
    whoami(): Promise<UserResponse> {
        return this.http.get<UserResponse>('/api/users/whoami');
    }

    /** Server-wide info (wildcard domain for web-port URLs, etc.). */
    getServerInfo(): Promise<ServerInfo> {
        return this.http.get<ServerInfo>('/api/server-info');
    }

    // ---- Spaces ----
    listSpaces(userId?: string): Promise<SpaceInfoList> {
        const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
        return this.http.get<SpaceInfoList>(`/api/spaces${qs}`);
    }

    getSpace(spaceId: string): Promise<SpaceDefinition> {
        return this.http.get<SpaceDefinition>(`/api/spaces/${encodeURIComponent(spaceId)}`);
    }

    createSpace(req: SpaceRequest): Promise<string> {
        return this.http
            .post<CreateSpaceResponse>('/api/spaces', req, 201)
            .then((r) => r.space_id);
    }

    updateSpace(spaceId: string, req: SpaceRequest): Promise<void> {
        return this.http.put(`/api/spaces/${encodeURIComponent(spaceId)}`, req, 200);
    }

    deleteSpace(spaceId: string): Promise<void> {
        return this.http.delete(`/api/spaces/${encodeURIComponent(spaceId)}`);
    }

    startSpace(spaceId: string): Promise<void> {
        return this.http.post(`/api/spaces/${encodeURIComponent(spaceId)}/start`, undefined, 200);
    }

    stopSpace(spaceId: string): Promise<void> {
        return this.http.post(`/api/spaces/${encodeURIComponent(spaceId)}/stop`, undefined, 200);
    }

    restartSpace(spaceId: string): Promise<void> {
        return this.http.post(`/api/spaces/${encodeURIComponent(spaceId)}/restart`, undefined, 200);
    }

    // ---- Stacks ----
    // Stack operations are long-running on the server (synchronous, up to ~120s
    // per tier). They return 202 once the action is applied.
    startStack(name: string): Promise<void> {
        return this.http.post(`/api/spaces/stacks/${encodeURIComponent(name)}/start`, undefined, 202);
    }

    stopStack(name: string): Promise<void> {
        return this.http.post(`/api/spaces/stacks/${encodeURIComponent(name)}/stop`, undefined, 202);
    }

    restartStack(name: string): Promise<void> {
        return this.http.post(`/api/spaces/stacks/${encodeURIComponent(name)}/restart`, undefined, 202);
    }

    /**
     * Delete every space in a stack. The server validates that every space is
     * stoppable before mutating anything (all-or-nothing). Resolves once each
     * space has been marked as deleting; teardown continues asynchronously.
     */
    deleteStack(name: string): Promise<void> {
        return this.http.delete(`/api/stacks/${encodeURIComponent(name)}`);
    }

    // ---- Run command / files ----
    /** Runs a command; throws if the space reports failure (success:false). */
    runCommand(spaceId: string, req: RunCommandRequest): Promise<RunCommandResponse> {
        return this.http
            .post<RunCommandResponse>(`/api/spaces/${encodeURIComponent(spaceId)}/run-command`, req, 200)
            .then((res) => {
                if (!res.success) {
                    throw new Error(res.error || 'command failed');
                }
                return res;
            });
    }

    readFile(spaceId: string, req: ReadFileRequest): Promise<ReadFileResponse> {
        return this.http
            .post<ReadFileResponse>(`/api/spaces/${encodeURIComponent(spaceId)}/files/read`, req, 200)
            .then((res) => {
                if (!res.success) {
                    throw new Error(res.error || 'failed to read file');
                }
                return res;
            });
    }

    writeFile(spaceId: string, req: WriteFileRequest): Promise<WriteFileResponse> {
        return this.http
            .post<WriteFileResponse>(`/api/spaces/${encodeURIComponent(spaceId)}/files/write`, req, 200)
            .then((res) => {
                if (!res.success) {
                    throw new Error(res.error || 'failed to write file');
                }
                return res;
            });
    }

    // ---- Templates ----
    listTemplates(): Promise<TemplateList> {
        return this.http.get<TemplateList>('/api/templates');
    }

    // ---- Stack definitions ----
    listStackDefinitions(): Promise<StackDefinitionList> {
        return this.http.get<StackDefinitionList>('/api/stack-definitions');
    }

    // ---- Port forwarding (space-io) ----
    applyPorts(spaceId: string, req: PortApplyRequest): Promise<void> {
        return this.http.post(`/space-io/${encodeURIComponent(spaceId)}/port/apply`, req, 200);
    }

    // ---- Pools ----
    listPools(): Promise<PoolList> {
        return this.http.get<PoolList>('/api/pools');
    }
    createPool(req: { name: string; template_id: string; desired_count: number; active?: boolean }): Promise<{ pool_id: string }> {
        return this.http.post('/api/pools', req, 201);
    }
    startPool(idOrName: string): Promise<void> {
        return this.http.post(`/api/pools/${encodeURIComponent(idOrName)}/start`, undefined, 200);
    }
    stopPool(idOrName: string): Promise<void> {
        return this.http.post(`/api/pools/${encodeURIComponent(idOrName)}/stop`, undefined, 200);
    }
    setPoolSize(idOrName: string, desiredCount: number): Promise<void> {
        return this.http.post(`/api/pools/${encodeURIComponent(idOrName)}/size`, { desired_count: desiredCount }, 200);
    }
    deletePool(idOrName: string): Promise<void> {
        return this.http.delete(`/api/pools/${encodeURIComponent(idOrName)}`) as unknown as Promise<void>;
    }

    // ---- Helpers ----
    spaceById(spaces: SpaceInfo[], id: string): SpaceInfo | undefined {
        return spaces.find((s) => s.space_id === id);
    }

    dispose(): void {
        this.http.dispose();
    }

    // ---- File storage ----
    listFileBuckets(): Promise<FileBucketList> {
        return this.http.get<FileBucketList>('/api/files/buckets');
    }

    /** One page of a bucket listing. With a delimiter, folders come back as prefixes. */
    listFileObjects(bucket: string, prefix: string, delimiter: string, after = ''): Promise<FileObjectList> {
        const qs =
            `prefix=${encodeURIComponent(prefix)}&delimiter=${encodeURIComponent(delimiter)}` +
            `&after=${encodeURIComponent(after)}&limit=1000`;
        return this.http.get<FileObjectList>(`/api/files/list/${encodeURIComponent(bucket)}?${qs}`);
    }

    /**
     * A page of what changed in a bucket since cursor. The cursor "now"
     * returns no changes, only a cursor to follow the bucket from now on.
     */
    listFileChanges(bucket: string, cursor: string, prefix = ''): Promise<FileChangeList> {
        const qs = `cursor=${encodeURIComponent(cursor)}&prefix=${encodeURIComponent(prefix)}&limit=1000`;
        return this.http.get<FileChangeList>(`/api/files/changes/${encodeURIComponent(bucket)}?${qs}`);
    }

    private fileUrl(bucket: string, key: string): string {
        const k = key.split('/').map(encodeURIComponent).join('/');
        return `/api/files/objects/${encodeURIComponent(bucket)}/${k}`;
    }

    /** A file's size, ETag and modification time, or undefined if there is no such file. */
    async statFile(bucket: string, key: string): Promise<{ size: number; etag: string; mtime: number } | undefined> {
        const res = await this.http.requestRaw({ method: 'HEAD', path: this.fileUrl(bucket, key), allow: [404] });
        if (res.status === 404) {
            return undefined;
        }
        const modified = Date.parse(String(res.headers['last-modified'] ?? ''));
        return {
            size: Number(res.headers['content-length'] ?? 0),
            etag: String(res.headers['etag'] ?? '').replace(/"/g, ''),
            mtime: Number.isNaN(modified) ? Date.now() : modified,
        };
    }

    /** A file's content and the ETag of the version read. */
    async readFileContent(bucket: string, key: string): Promise<{ body: Buffer; etag: string }> {
        const res = await this.http.requestRaw({ method: 'GET', path: this.fileUrl(bucket, key) });
        return { body: res.body, etag: String(res.headers['etag'] ?? '').replace(/"/g, '') };
    }

    /**
     * Writes a file. With `ifMatch` the write only replaces the version with that
     * ETag; with `ifAbsent` it only creates. Either refusal is a 412. Returns
     * the new version's ETag.
     */
    async writeFileContent(
        bucket: string,
        key: string,
        data: Buffer,
        opts: { ifMatch?: string; ifAbsent?: boolean } = {},
    ): Promise<string> {
        const headers: Record<string, string> = { 'Content-Type': 'application/octet-stream' };
        if (opts.ifMatch) {
            headers['If-Match'] = `"${opts.ifMatch}"`;
        }
        if (opts.ifAbsent) {
            headers['If-None-Match'] = '*';
        }
        const res = await this.http.requestRaw({ method: 'PUT', path: this.fileUrl(bucket, key), body: data, headers });
        try {
            return String((JSON.parse(res.body.toString('utf8')) as { etag?: string }).etag ?? '');
        } catch {
            return '';
        }
    }

    async deleteFileObject(bucket: string, key: string): Promise<void> {
        await this.http.requestRaw({ method: 'DELETE', path: this.fileUrl(bucket, key) });
    }

    /** Renames a file, or a folder and everything under it, within a bucket, on the server. */
    async moveFileObjects(bucket: string, from: string, to: string, overwrite: boolean): Promise<number> {
        const res = await this.http.post<{ moved: number }>('/api/files/move', { bucket, from, to, overwrite }, 200);
        return res.moved;
    }
}
