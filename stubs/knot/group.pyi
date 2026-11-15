"""Manage groups."""
import builtins
from typing import Any
def list() -> builtins.list[dict[str, Any]]:
    """List all groups"""
    ...
def get(group_id: str) -> dict[str, Any]:
    """Get group by ID (UUID only)"""
    ...
def create(name: str, max_spaces: int = ..., compute_units: int = ..., storage_units: int = ..., max_tunnels: int = ..., file_storage_mb: int = ..., max_buckets: int = ...) -> str:
    """Create a new group and return its ID"""
    ...
def update(group_id: str, name: str | None = ..., max_spaces: int | None = ..., compute_units: int | None = ..., storage_units: int | None = ..., max_tunnels: int | None = ..., file_storage_mb: int | None = ..., max_buckets: int | None = ...) -> bool:
    """Update group properties; arguments left as None keep their current values"""
    ...
def delete(group_id: str) -> bool:
    """Delete a group by UUID"""
    ...
