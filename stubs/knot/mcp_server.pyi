"""Manage remote MCP servers whose tools knot exposes under a namespace (call the tools with knot.mcp)."""
import builtins
from typing import Any
def list(user_id: str | None = ...) -> builtins.list[dict[str, Any]]:
    """List remote MCP servers, sorted by namespace: id, user_id, namespace, url, command, args, env ("KEY=value" entries), enabled, tool_visibility ("native" or "discoverable"), disabled_tools, remote_search. user_id lists another user's servers (needs manage MCP servers)"""
    ...
def get(namespace_or_id: str) -> dict[str, Any]:
    """Get a remote MCP server by namespace (your own) or ID: list()'s fields plus auth_type ("", "bearer" or "oauth2"), oauth_client_id, oauth_token_url, and has_token / has_oauth_tokens flags — token values are never returned"""
    ...
def create(namespace: str, url: str = ..., command: str = ..., args: builtins.list[str] | None = ..., env: builtins.list[str] | None = ..., auth_type: str = ..., token: str = ..., oauth_client_id: str = ..., oauth_token_url: str = ..., oauth_access_token: str = ..., oauth_refresh_token: str = ..., enabled: bool = ..., tool_visibility: str = ..., remote_search: bool = ...) -> str:
    """Add a remote MCP server for the current user and return its ID: url for HTTP(S), or command (with args and env) for stdio. namespace must be unique among your servers and not contain "__". Needs manage MCP servers"""
    ...
def update(namespace_or_id: str, namespace: str | None = ..., url: str | None = ..., command: str | None = ..., args: builtins.list[str] | None = ..., env: builtins.list[str] | None = ..., auth_type: str | None = ..., token: str | None = ..., oauth_client_id: str | None = ..., oauth_token_url: str | None = ..., oauth_access_token: str | None = ..., oauth_refresh_token: str | None = ..., enabled: bool | None = ..., tool_visibility: str | None = ..., remote_search: bool | None = ...) -> bool:
    """Update a remote MCP server; only the arguments given change (namespace renames it), stored tokens are kept unless new ones are given"""
    ...
def delete(namespace_or_id: str) -> bool:
    """Delete a remote MCP server"""
    ...
def tools(namespace_or_id: str) -> builtins.list[dict[str, Any]]:
    """Connect to the server and list its tools: name (no namespace prefix), description, enabled, is_app. Raises with the reason when the server cannot be reached"""
    ...
def set_tool_enabled(namespace_or_id: str, tool_name: str, enabled: bool) -> bool:
    """Switch one of the server's tools on or off"""
    ...
def protocol_version(namespace_or_id: str) -> str:
    """The MCP protocol version negotiated with the server, e.g. "2025-06-18"; "" when it cannot be reached"""
    ...
