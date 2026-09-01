"""Manage template variables."""
import builtins
from typing import Any
def list() -> builtins.list[dict[str, Any]]:
    """List all template variables"""
    ...
def get(var_id: str) -> dict[str, Any]:
    """Get variable value"""
    ...
def create(name: str, value: str, zones: builtins.list[str] | None = ..., local: bool = ..., protected: bool = ..., restricted: bool = ...) -> str:
    """Create a new variable"""
    ...
def set_value(var_id: str, value: str | None = ...) -> bool:
    """Set variable value (updates existing)"""
    ...
def update(var_id: str, value: str | None = ..., zones: builtins.list[str] | None = ..., local: bool | None = ..., protected: bool | None = ..., restricted: bool | None = ...) -> bool:
    """Update variable properties"""
    ...
def delete(var_id: str) -> bool:
    """Delete a variable"""
    ...
