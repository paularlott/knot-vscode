"""Manage space templates."""
import builtins
from typing import Any
def field_options(handler_id: str) -> builtins.list[str] | None:
    """Resolve a plugin field handler's option keys as the requesting user — the exact values the space form offers and the API's validation accepts. None when the handler cannot be reached."""
    ...
def list(include_inactive: bool = ..., resolve_options: bool = ...) -> builtins.list[dict[str, Any]]:
    """List templates visible to the current user. Defaults to active templates only; pass include_inactive=True to include retired ones. With resolve_options=True, handler-backed custom fields carry their options resolved live (one plugin call per field) instead of naming their handler."""
    ...
def get(template_id: str, resolve_options: bool = ...) -> dict[str, Any]:
    """Get template by ID or name. With resolve_options=True, handler-backed custom fields carry their options resolved live instead of naming their handler."""
    ...
def validate(platform: str, job: str = ..., volumes: str = ...) -> dict[str, Any]:
    """Validate template job and volume specifications without saving"""
    ...
def build_spec(platform: str, spec: dict[str, Any], original_job: str = ..., original_volumes: str = ...) -> dict[str, str]:
    """Build native job and volume text from a unified spec (image, environment, ports, storage, memory, cpus). Same conversion as the UI spec wizard. Patch into originals to preserve hand-written content."""
    ...
def nodes(template_id: str) -> builtins.list[dict[str, Any]]:
    """List available placement nodes for a local-container template"""
    ...
def create(name: str, job: str = ..., description: str = ..., platform: str = ..., volumes: str = ..., active: bool = ..., custom_fields: builtins.list[dict[str, Any]] | None = ..., **kwargs: Any) -> str:
    """Create a new template. health_check_type can be none, agent, tcp, http, program, or custom. ports is a list of {name, port, protocol} objects, protocol one of "http", "https", "tcp" or "shared" (a shared port is reachable by every user in the same zone through a port forward as user--space, not just the space's owner; http/https get dev URLs, tcp is published on the host); port_forwards is a list of {local_port, space, remote_port} dicts seeded into spaces created from the template and connected when they start (space: a space or pool name, or user--name for another user's shared port); jobs is a list of {name, command, schedule, enabled} objects copied into new spaces; custom_fields declares the template's custom fields. max_uptime / max_uptime_unit and idle_timeout / idle_timeout_unit control the max-runtime and idle auto-stops (unit one of "minute", "hour", "day"; "disabled" or a 0 value turns the stop off).

    custom_fields declares the template's custom fields: a list of dicts with
    name, description, type ("text", "masked", "number", "bool", "select", "autocomplete"
    or "textarea"), handler (a plugin field handler id) or options (a manual
    option list) — select and autocomplete take exactly one of the two,
    language (the editor language, textarea only), default — a bool default
    becomes the string "true"/"false"; values are stored as strings — and
    required (bool): a required field cannot be blank when creating or editing
    a space, and the default can satisfy the requirement.
    """
    ...
def update(template_id: str, name: str | None = ..., job: str | None = ..., description: str | None = ..., platform: str | None = ..., custom_fields: builtins.list[dict[str, Any]] | None = ..., **kwargs: Any) -> bool:
    """Update template properties, including health_check_type, health_check_auto_restart, max_uptime, idle_timeout, ports, jobs and port_forwards. Omitted properties are left unchanged. max_uptime / idle_timeout units are one of "minute", "hour", "day"; "disabled" (or a 0 value for idle) turns the stop off. custom_fields, when given, replaces the template's custom fields (same shape as create); omitted leaves them unchanged."""
    ...
def delete(template_id: str) -> bool:
    """Delete a template by ID or name"""
    ...
def get_icons() -> builtins.list[dict[str, Any]]:
    """Get list of available icons"""
    ...
