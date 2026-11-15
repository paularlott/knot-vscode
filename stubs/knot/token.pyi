"""Manage API tokens."""
import builtins
from typing import Any
def list() -> builtins.list[dict[str, Any]]:
    """List the current user's API tokens; id is the bearer key itself, and scopes is empty for full access"""
    ...
def create(name: str, scopes: builtins.list[str] | None = ...) -> str:
    """Create an API token and return its value (the bearer key). scopes narrows it to endpoint groups: "methods" (/api/methods*), "mcp" (/mcp), "tunnels" (/tunnel/* and /api/tunnels*: tunnels only), "files" (/api/files*, and S3 on Knot Pro) and "backup" (/api/backup* and /api/restore*); None means full access"""
    ...
def update(token_id: str, name: str | None = ..., scopes: builtins.list[str] | None = ...) -> bool:
    """Rename a token or change its scopes; only the arguments given change. scopes=[] clears them (full access)"""
    ...
def delete(token_id: str) -> bool:
    """Delete an API token by its value, revoking it immediately"""
    ...
