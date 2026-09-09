"""Manage space templates."""
import builtins
from typing import Any
def list(include_inactive: bool = ...) -> builtins.list[dict[str, Any]]:
    """List templates visible to the current user. Defaults to active templates only; pass include_inactive=True to include retired ones."""
    ...
def get(template_id: str) -> dict[str, Any]:
    """Get template by ID or name"""
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
    """Create a new template. health_check_type can be none, agent, tcp, http, program, or custom. ports is a list of {name, port, protocol} objects; jobs is a list of {name, command, schedule, enabled} objects copied into new spaces.

    custom_fields declares the template's custom fields: a list of dicts with
    name, description, type ("text", "masked", "number", "bool", "autocomplete"
    or "textarea"), handler (a plugin field handler id, autocomplete only),
    language (the editor language, textarea only) and default — a bool default
    becomes the string "true"/"false"; values are stored as strings.
    """
    ...
def update(template_id: str, name: str | None = ..., job: str | None = ..., description: str | None = ..., platform: str | None = ..., custom_fields: builtins.list[dict[str, Any]] | None = ..., **kwargs: Any) -> bool:
    """Update template properties, including health_check_type, health_check_auto_restart, ports and jobs. custom_fields, when given, replaces the template's custom fields (same shape as create); omitted leaves them unchanged."""
    ...
def delete(template_id: str) -> bool:
    """Delete a template by ID or name"""
    ...
def get_icons() -> builtins.list[dict[str, Any]]:
    """Get list of available icons"""
    ...
