import { HttpClient } from './http';
import type {
    CreateSpaceResponse,
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
}
