"""Manage event sinks: webhook, script and json-rpc listeners for space lifecycle and custom events."""
import builtins
from typing import Any
def list() -> builtins.list[dict[str, Any]]:
    """List the event sinks you may manage (your own with manage events, global ones with manage global events): id, name, description, user_id, is_global, events, sink_type ("webhook", "script" or "json-rpc"), webhook ({url, secret (masked here), headers, body_template, skip_tls_verify} or None), script_id, active"""
    ...
def get(name_or_id: str) -> dict[str, Any]:
    """Get an event sink by name or ID, as list() gives it but with the webhook secret in plain text. A name shared by a global sink and your own is ambiguous; give the ID"""
    ...
def create(name: str, events: builtins.list[str], sink_type: str = ..., description: str = ..., url: str = ..., secret: str = ..., headers: dict[str, str] | None = ..., body_template: str = ..., skip_tls_verify: bool = ..., script: str = ..., active: bool = ..., is_global: bool = ...) -> str:
    """Create an event sink and return its ID. events are type patterns such as ["space.started", "custom.myapp.*", "*"]. sink_type "webhook" (default; POSTs to url, signed with secret, generated when empty), "script" (runs script, a name or ID) or "json-rpc" (a named formatter for subscribed methods, using body_template). is_global=True makes a global sink (needs manage global events); otherwise it is your own (needs manage events)"""
    ...
def update(name_or_id: str, name: str | None = ..., description: str | None = ..., events: builtins.list[str] | None = ..., sink_type: str | None = ..., url: str | None = ..., secret: str | None = ..., headers: dict[str, str] | None = ..., body_template: str | None = ..., skip_tls_verify: bool | None = ..., script: str | None = ..., active: bool | None = ...) -> bool:
    """Update an event sink; only the arguments given change, and the webhook secret is kept unless a new one is given"""
    ...
def delete(name_or_id: str) -> bool:
    """Delete an event sink by name or ID"""
    ...
