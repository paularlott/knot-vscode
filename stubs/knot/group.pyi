"""Manage groups."""
import builtins
from typing import Any
def list() -> builtins.list[dict[str, Any]]:
    """List all groups"""
    ...
def get(group_id: str) -> dict[str, Any]:
    """Get group by ID (UUID only)"""
    ...
def create(name: str, max_spaces: int = ..., compute_units: int = ..., storage_units: int = ..., max_tunnels: int = ...) -> str:
    """Create a new group (optional kwargs: max_spaces, compute_units, storage_units, max_tunnels)"""
    ...
def update(group_id: str, name: str | None = ..., max_spaces: int | None = ..., compute_units: int | None = ..., storage_units: int | None = ...) -> bool:
    """Update group properties"""
    ...
def delete(group_id: str) -> bool:
    """Delete a group by UUID"""
    ...
