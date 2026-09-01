"""Manage roles."""
import builtins
from typing import Any
def list() -> builtins.list[dict[str, Any]]:
    """List all roles"""
    ...
def get(role_id: str) -> dict[str, Any]:
    """Get role by ID (UUID only)"""
    ...
def create(name: str, permissions: builtins.list[int] | None = ...) -> str:
    """Create a new role"""
    ...
def update(role_id: str, name: str | None = ..., permissions: builtins.list[int] | None = ...) -> bool:
    """Update role properties"""
    ...
def delete(role_id: str) -> bool:
    """Delete a role by UUID"""
    ...
