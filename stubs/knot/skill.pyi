"""Manage skills."""
import builtins
from typing import Any
def list(owner: str | None = ...) -> builtins.list[dict[str, Any]]:
    """List skills (filtered by permissions/groups/zones)"""
    ...
def get(name_or_id: str) -> dict[str, Any]:
    """Get skill by name or UUID"""
    ...
def create(content: str, is_global: bool = ..., groups: builtins.list[str] | None = ..., zones: builtins.list[str] | None = ..., owner: str | None = ..., active: bool = ...) -> str:
    """Create a new skill and return its ID: a user skill owned by owner (default: the current user) unless is_global=True. A global skill, or another user's, needs Manage Global Skills; groups (group IDs) apply to global skills only"""
    ...
def update(name_or_id: str, content: str | None = ..., groups: builtins.list[str] | None = ..., zones: builtins.list[str] | None = ..., active: bool | None = ...) -> bool:
    """Update a skill; arguments left as None keep their current values"""
    ...
def delete(name_or_id: str) -> bool:
    """Delete skill"""
    ...
def search(query: str) -> builtins.list[dict[str, Any]]:
    """Fuzzy search skills by name/description: up to 3 matches, best first, each with id, name, description, user_id, content and score (0 to 1)"""
    ...
