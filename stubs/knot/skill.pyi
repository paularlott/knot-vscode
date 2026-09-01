"""Manage skills."""
import builtins
from typing import Any
def list(owner: str | None = ...) -> builtins.list[dict[str, Any]]:
    """List skills (filtered by permissions/groups/zones)"""
    ...
def get(name_or_id: str) -> dict[str, Any]:
    """Get skill by name or UUID"""
    ...
def create(content: str, is_global: bool = ..., groups: builtins.list[str] | None = ..., zones: builtins.list[str] | None = ...) -> str:
    """Create a new skill"""
    ...
def update(name_or_id: str, content: str | None = ..., groups: builtins.list[str] | None = ..., zones: builtins.list[str] | None = ...) -> bool:
    """Update skill"""
    ...
def delete(name_or_id: str) -> bool:
    """Delete skill"""
    ...
def search(query: str) -> builtins.list[dict[str, Any]]:
    """Fuzzy search skills by name/description"""
    ...
