"""Query the audit log."""
from typing import Any
def list(start: int = ..., max_items: int = ..., q: str = ..., actor: str = ..., actor_type: str = ..., event: str = ..., from_time: str = ..., to_time: str = ...) -> dict[str, Any]:
    """List audit log entries with optional filtering"""
    ...
def search(q: str, start: int = ..., max_items: int = ..., actor: str = ..., actor_type: str = ..., event: str = ..., from_time: str = ..., to_time: str = ...) -> dict[str, Any]:
    """Search audit logs with a text query across actor, event, and details"""
    ...
