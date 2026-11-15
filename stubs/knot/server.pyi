"""Server information, and the hosts space web ports are reached at."""
import builtins
from typing import Any
def info() -> dict[str, Any]:
    """Get server-wide information: version, wildcard_domain (space web-port URLs, e.g. "*.knot.example.com") and tunnel_domain (dot-prefixed suffix, e.g. ".tunnel.example.com", appended straight after a tunnel name) — the domains are empty when not configured."""
    ...
def host_label(user: str, name: str, port: int | str) -> str:
    """The first label of the host a space's web port is reached at, before the wildcard domain: "<user>--<name>--<port>", lowercased; name is a space, alt name or pool, port a number or "vnc". A label longer than the 63 characters DNS allows has the name cut short and ended with a hyphen and an 8-character hash, which knot routes by"""
    ...
def ping() -> dict[str, Any]:
    """Check the server is reachable and the credentials work: status, version, zone"""
    ...
def cluster_info() -> builtins.list[dict[str, Any]]:
    """List the cluster's server nodes (needs view cluster info): id, address, state, zone, hostname, allocated_spaces, running_spaces, runtimes, metadata"""
    ...
def search(query: str) -> dict[str, Any]:
    """Search everything you may see by name (case-insensitive substring, at most 5 hits per type): query plus lists of {id, name, description} for pages, spaces, templates, variables, volumes, stacks, scripts, skills, commands, mcp_servers, event_sinks, users, groups, roles, tokens"""
    ...
def plugins() -> dict[str, Any]:
    """List loaded server plugins (needs manage roles): count, plugins (name, version, description, permissions, menus, pages, mcp_tools, handlers, field_handlers, libs, ...), failed, warnings. Raises when no plugins are loaded"""
    ...
