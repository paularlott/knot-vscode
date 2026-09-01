"""Manage space pools — fixed-size, self-healing groups of identical spaces."""

import builtins
from typing import Any

def list() -> builtins.list[dict[str, Any]]:
    """List visible pools with utilization"""
    ...
def get(name: str) -> dict[str, Any]:
    """Get pool details, utilization, and member stats by name or ID"""
    ...
def create(name: str, template_name: str, startup_script_id: str = ..., desired_count: int = ..., active: bool = ...) -> str:
    """Create a pool with the given number of spaces"""
    ...
def update(name: str, desired_count: int | None = ..., active: bool | None = ...) -> bool:
    """Update pool desired count or active state. Name, template, and startup script are immutable."""
    ...
def delete(name: str) -> bool:
    """Delete a stopped pool and all its spaces"""
    ...
def set_size(name: str, desired_count: int) -> bool:
    """Set pool target size. The sweep loop creates, drains, or deletes spaces asynchronously."""
    ...
def start(name: str) -> bool:
    """Start a stopped pool: starts all member spaces"""
    ...
def stop(name: str) -> bool:
    """Stop a running pool: stops all member spaces without deleting them"""
    ...
