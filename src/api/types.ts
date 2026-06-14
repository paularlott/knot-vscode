// Types mirroring github.com/paularlott/knot/apiclient (Go structs).

export interface CustomFieldValue {
    name: string;
    value: string;
}

export interface AltNameEntry {
    name: string;
    port?: number;
}

export interface SpaceResourceUsage {
    cpu_percent: number;
    memory_used_bytes: number;
    memory_limit_bytes: number;
    disk_used_bytes: number;
    disk_limit_bytes: number;
}

// Lightweight space info as returned by GET /api/spaces (list).
export interface SpaceInfo {
    space_id: string;
    name: string;
    description: string;
    note: string;
    template_name: string;
    template_id: string;
    zone: string;
    username: string;
    user_id: string;
    platform: string;
    shares: string[];
    depends_on: string[];
    has_code_server: boolean;
    has_ssh: boolean;
    has_http_vnc: boolean;
    has_terminal: boolean;
    has_state: boolean;
    is_deployed: boolean;
    is_pending: boolean;
    is_deleting: boolean;
    tcp_ports: Record<string, string>;
    http_ports: Record<string, string>;
    update_available: boolean;
    is_remote: boolean;
    has_vscode_tunnel: boolean;
    vscode_tunnel_name: string;
    started_at: string;
    icon_url: string;
    healthy: boolean;
    node_hostname: string;
    stack: string;
    alt_names: AltNameEntry[];
    custom_fields: CustomFieldValue[];
    resource_usage?: SpaceResourceUsage;
}

export interface SpaceInfoList {
    count: number;
    spaces: SpaceInfo[];
}

// Full space definition as returned by GET /api/spaces/{id}.
export interface SpaceDefinition extends SpaceInfo {
    shell: string;
    has_ever_started: boolean;
    created_at: string;
    created_at_formatted: string;
    startup_script_id: string;
    node_id: string;
}

export interface SpaceRequest {
    name: string;
    description?: string;
    template_id: string;
    shell?: string;
    user_id?: string;
    alt_names?: AltNameEntry[];
    icon_url?: string;
    custom_fields?: CustomFieldValue[];
    selected_node_id?: string;
    startup_script_id?: string;
    depends_on?: string[];
    stack?: string;
}

export interface CreateSpaceResponse {
    status: boolean;
    space_id: string;
}

export interface RunCommandRequest {
    command: string;
    args?: string[];
    timeout?: number;
    workdir?: string;
}

export interface RunCommandResponse {
    output: string;
    success: boolean;
    error: string;
}

export interface ReadFileRequest {
    path: string;
}

export interface ReadFileResponse {
    success: boolean;
    content: string;
    size: number;
    error: string;
}

export interface WriteFileRequest {
    path: string;
    content: string;
}

export interface WriteFileResponse {
    success: boolean;
    bytes_written: number;
    error: string;
}

export interface UserResponse {
    id: string;
    username: string;
    email: string;
    service_password: string;
    roles: string[];
    groups: string[];
    active: boolean;
    max_spaces: number;
    compute_units: number;
    storage_units: number;
    ssh_public_key: string;
    ssh_private_key: string;
    github_username: string;
    preferred_shell: string;
    timezone: string;
    current: boolean;
    last_login_at?: string;
    created_at: string;
    updated_at: string;
}

export interface Template {
    template_id: string;
    name: string;
    description: string;
    platform: string;
    active: boolean;
    icon_url: string;
    usage: number;
    deployed: number;
    [key: string]: unknown;
}

export interface TemplateList {
    count: number;
    templates: Template[];
}

export interface ApiError {
    error: string;
}
