"""Manage API tokens."""
import builtins
from typing import Any
def list() -> builtins.list[dict[str, Any]]:
    """List the current user's API tokens; id is the bearer key itself, and scopes is empty for full access"""
    ...
def create(name: str, scopes: builtins.list[str] | None = ...) -> str:
    """Create an API token and return its value (the bearer key). scopes narrows it to endpoint groups: "methods" (/api/methods*), "mcp" (/mcp) and "tunnels" (/tunnel/* and /api/tunnels*: tunnels only); None means full access"""
    ...
def delete(token_id: str) -> bool:
    """Delete an API token by its value, revoking it immediately"""
    ...
