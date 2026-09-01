"""Manage slash commands."""
import builtins
from typing import Any

def list(owner: str | None = ..., all_zones: bool = ...) -> builtins.list[dict[str, Any]]:
    """List slash commands the user has access to. Pass owner to filter to a user's own commands, all_zones=True to include other zones"""
    ...
def get(name_or_id: str) -> dict[str, Any]:
    """Get a slash command by name or UUID"""
    ...
def create(content: str, is_global: bool = ..., groups: builtins.list[str] | None = ..., zones: builtins.list[str] | None = ..., active: bool = ...) -> str:
    """Create a slash command from markdown content with YAML frontmatter (name, description, argument-hint, allowed-tools). Use is_global=True for admin (requires permission)"""
    ...
def update(name_or_id: str, content: str | None = ..., groups: builtins.list[str] | None = ..., zones: builtins.list[str] | None = ..., active: bool | None = ...) -> bool:
    """Update a slash command while preserving fields not passed"""
    ...
def delete(name_or_id: str) -> bool:
    """Delete a slash command by name or UUID"""
    ...
