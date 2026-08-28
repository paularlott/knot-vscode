"""Manage development spaces."""

from typing import Any, Optional

def list(all_zones: bool = ...) -> list[dict[str, Any]]: ...
    """List spaces visible to the current user. Defaults to the current server's zone; pass all_zones=True to include other zones."""
def get(name: str) -> dict[str, Any]: ...
    """Get space details as a dict"""
def create(
    name: str,
    template_name: str,
    description: str = ...,
    shell: str = ...,
    depends_on: list[str] | None = ...,
    icon_url: str = ...,
    custom_fields: list[dict[str, str]] | None = ...,
    start_on_create: bool = ...,
) -> str: ...
    """Create a new space"""
def update(
    name: str,
    new_name: str | None = ...,
    description: str | None = ...,
    shell: str | None = ...,
    template_name: str | None = ...,
    icon_url: str | None = ...,
    custom_fields: list[dict[str, str]] | None = ...,
    start: bool = ...,
    stop: bool = ...,
    restart: bool = ...,
) -> bool: ...
    """Update space properties while preserving fields not passed"""
def delete(name: str) -> bool: ...
    """Delete a space by name"""
def start(name: str) -> bool: ...
    """Start a space by name"""
def stop(name: str) -> bool: ...
    """Stop a space by name"""
def restart(name: str) -> bool: ...
    """Restart a space by name"""
def is_running(name: str) -> bool: ...
    """Check if a space is running"""
def wait_for_start(name: str, timeout: int = 30, interval: int = 2) -> bool: ...
    """Wait for a space to reach the running state. Returns True immediately if already running (never stops the space); polls every interval seconds until running or timeout expires. Returns False on timeout."""
def usage_current(name: str) -> dict[str, Any]: ...
    """Get the current resource usage point for a space"""
def usage_history(name: str, range: str = ...) -> list[dict[str, Any]]: ...
    """Get historical resource usage for a space"""
def set_description(name: str, description: str) -> bool: ...
    """Set space description"""
def get_description(name: str) -> str: ...
    """Get space description"""
def get_dependencies(name: str) -> list[str]: ...
    """Get dependency space IDs for a space"""
def set_dependencies(name: str, depends_on: list[str]) -> bool: ...
    """Set dependency spaces by name or ID"""
def get_stack(name: str) -> str: ...
    """Get the stack name for a space"""
def set_stack(name: str, stack: str) -> bool: ...
    """Set the stack name for a space (empty string to unstack)"""
def get_field(name: str, field: str) -> str: ...
    """Get custom field value from space"""
def set_field(name: str, field: str, value: str) -> bool: ...
    """Set custom field value on space"""
def transfer(name: str, user_id: str) -> bool: ...
    """Transfer space to another user (user_id can be username, email, or UUID)"""
def share(name: str, user_ids: list[str]) -> bool: ...
    """Share space with one or more users (user_ids can be usernames, emails, or UUIDs)"""
def unshare(name: str, user_id: str | None = ...) -> bool: ...
    """Remove a space share, optionally for a specific user"""
def run(name: str, command: str, args: list[str] | None = ..., timeout: int = ..., workdir: str = ...) -> dict[str, Any]: ...
    """Execute a command in a space"""
def run_script(name: str, script_name: str, args: list[str] | None = ...) -> dict[str, Any]: ...
    """Execute a script in a space"""
def eval(name: str, code: str, args: list[str] | None = ...) -> dict[str, Any]: ...
    """Execute inline Scriptling code in a running space (no stored script required)"""
def read_file(name: str, file_path: str, offset: int = ..., limit: int = ...) -> str: ...
    """Read file contents from a running space; offset/limit select a 1-based line range"""
def write_file(name: str, file_path: str, content: str, mode: str = ..., mtime_ns: int | None = ..., file_perm: int | None = ...) -> bool: ...
    """Write content to a file in a running space (overwrite/append/prepend). Optional mtime_ns (Unix nanoseconds) and file_perm (int bits like 0o644) are applied after the write so the destination matches a source file's metadata — useful for sync tools."""
def grep(
    name: str,
    pattern: str,
    path: str,
    literal: bool = ...,
    recursive: bool = ...,
    ignore_case: bool = ...,
    glob: str = ...,
    follow_links: bool = ...,
    max_size: int = ...,
    workdir: str = ...,
) -> list[dict[str, Any]]: ...
    """Search file contents in a running space via a parallel worker pool in the agent"""
def find(
    name: str,
    path: str = ...,
    recursive: bool = ...,
    type: str = ...,
    name_glob: str = ...,
    mtime_min: float | None = ...,
    mtime_max: float | None = ...,
    size_min: int | None = ...,
    size_max: int | None = ...,
    include_hidden: bool = ...,
    follow_links: bool = ...,
    max_depth: int = ...,
    workdir: str = ...,
) -> list[str]: ...
    """Find files and directories in a running space by name, type, mtime, or size. Returns path strings only."""
def find_entries(
    name: str,
    path: str = ...,
    recursive: bool = ...,
    type: str = ...,
    name_glob: str = ...,
    mtime_min: float | None = ...,
    mtime_max: float | None = ...,
    size_min: int | None = ...,
    size_max: int | None = ...,
    include_hidden: bool = ...,
    follow_links: bool = ...,
    max_depth: int = ...,
    include_hash: bool = ...,
    include_symlinks: bool = ...,
    workdir: str = ...,
) -> list[dict[str, Any]]: ...
    """Same as find() but each entry is a dict with path, size, mtime, is_dir, file_perm. Pass include_hash=True for a crc64 hash field, include_symlinks=True for symlink entries with link_target."""
def sed_replace(
    name: str,
    old: str,
    new: str,
    path: str,
    recursive: bool = ...,
    ignore_case: bool = ...,
    glob: str = ...,
    follow_links: bool = ...,
    max_size: int = ...,
    workdir: str = ...,
) -> int: ...
    """Replace literal occurrences of old with new in files (atomic in-place edit)"""
def sed_replace_pattern(
    name: str,
    pattern: str,
    new: str,
    path: str,
    recursive: bool = ...,
    ignore_case: bool = ...,
    glob: str = ...,
    follow_links: bool = ...,
    max_size: int = ...,
    workdir: str = ...,
) -> int: ...
    """Replace regex matches in files; capture groups as ${1}, ${name} (atomic in-place edit)"""
def sed_extract(
    name: str,
    pattern: str,
    path: str,
    recursive: bool = ...,
    ignore_case: bool = ...,
    glob: str = ...,
    follow_links: bool = ...,
    max_size: int = ...,
    workdir: str = ...,
) -> list[dict[str, Any]]: ...
    """Extract regex capture groups from files in a running space (read-only)"""
def edit_file(
    name: str,
    file_path: str,
    search: str,
    replace: str,
    workdir: str = ...,
) -> int: ...
    """Targeted search-and-replace edit on a single file; search must be unique (fails if 0 or >1 matches)"""
def delete_file(
    name: str,
    file_path: str,
    recursive: bool = ...,
    workdir: str = ...,
) -> int: ...
def port_forward(source_space: str, local_port: int, remote_space: str, remote_port: int, persistent: bool = ..., force: bool = ...) -> bool: ...
    """Forward a local port to a remote space port"""
def port_list(name: str) -> list[dict[str, Any]]: ...
    """List active port forwards for a space"""
def port_stop(name: str, local_port: int) -> bool: ...
    """Stop a port forward"""
def port_throttle(name: str, local_port: int, latency_ms: int = ..., jitter_ms: int = ..., bandwidth_kb: int = ..., timeout_ms: int = ..., down: bool = ..., reset: bool = ...) -> bool: ...
    """Apply latency, jitter, bandwidth limits, connection timeout, and/or traffic blocking (down) to a port forward. Pass reset=True to clear."""
def port_apply(source_space: str, forwards: list[dict[str, Any]]) -> bool: ...
    """Replace all port forwards for a space"""
def tunnel_start(space: str, protocol: str, port: int, name: str) -> str: ...
    """Start an agent-owned web tunnel in a space, exposing <port> as <user>--<name>.<domain>. Owned by the space's agent; not persisted."""
def tunnel_list(space: str) -> list[dict[str, Any]]: ...
    """List agent-owned web tunnels in a space"""
def tunnel_stop(space: str, name: str) -> bool: ...
    """Stop an agent-owned web tunnel in a space by name"""
