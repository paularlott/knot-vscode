"""Query the audit log."""
import builtins
from typing import Any
def list(start: int = ..., max_items: int = ..., q: str = ..., actor: str = ..., actor_type: str = ..., event: str = ..., from_time: str = ..., to_time: str = ...) -> dict[str, Any]:
    """List audit log entries with optional filtering"""
    ...
def search(q: str, start: int = ..., max_items: int = ..., actor: str = ..., actor_type: str = ..., event: str = ..., from_time: str = ..., to_time: str = ...) -> dict[str, Any]:
    """Search audit logs with a text query across actor, event, and details"""
    ...
def export(format: str = ..., q: str = ..., actor: str = ..., actor_type: str = ..., event: str = ..., from_time: str = ..., to_time: str = ...) -> builtins.list[dict[str, Any]] | str:
    """Export every matching audit log entry, unpaged (needs download audit logs). format "json" (default) returns a list of entry dicts; "csv" returns CSV text with columns time, zone, actor, actor_type, event, details"""
    ...
