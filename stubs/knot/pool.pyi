"""Manage space pools — fixed-size, self-healing groups of identical spaces,
with optional exclusive member leases."""

import builtins
import contextlib
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
def acquire(name: str, time: str | int | None = ..., wait: str | int | None = ...) -> dict[str, Any]:
    """Acquire a pool member exclusively until the lease ends (requires a
    lease-enabled pool). time: None = the pool's maximum, "none" = never
    expire (unlimited pools only), seconds or "5m"-style string. wait:
    optionally wait this long for a free member before raising. Returns the
    lease dict — the held member is space_name / space_id."""
    ...
def extend(space: str, time: str | int | None = ...) -> dict[str, Any]:
    """Extend the lease held on a pool member (space name or id): the new
    deadline is now + time (or never, on unlimited pools). Bounded by the
    pool's max extension count."""
    ...
def release(space: str, destroy: bool = ...) -> dict[str, Any]:
    """Release the lease held on a pool member (space name or id — the same
    identifier acquire returned). The member returns to the pool after
    in-flight work drains (normally within ~15s). With destroy=True the
    member is deleted and a fresh replacement is created, so the next
    acquire gets a clean space."""
    ...
def leases(name: str) -> builtins.list[dict[str, Any]]:
    """List the pool's held leases — active plus draining"""
    ...
class leased(contextlib.AbstractContextManager[dict[str, Any]]):
    """Context manager for exclusive pool member use; releases on exit
    (destroys the member instead when destroy=True, leaving a fresh
    replacement behind)."""
    def __init__(self, name: str, time: str | int | None = ..., wait: str | int | None = ..., destroy: bool = ...) -> None: ...
    lease: dict[str, Any]
