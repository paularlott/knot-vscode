"""Manage space templates."""
import builtins
from typing import Any
def field_options(handler_id: str, query: str = ...) -> builtins.list[str] | None:
    """Resolve a plugin field handler's option keys as the requesting user — the exact values the space form offers and the API's validation accepts. query is passed to the handler as the text typed so far (autocomplete). None when the handler cannot be reached."""
    ...
def list(include_inactive: bool = ..., resolve_options: bool = ...) -> builtins.list[dict[str, Any]]:
    """List templates visible to the current user. Defaults to active templates only; pass include_inactive=True to include retired ones. Each entry has runtime_available: whether a node in the zone currently offers the runtime the template needs (always True for manual and Nomad templates). With resolve_options=True, handler-backed custom fields carry their options resolved live (one plugin call per field) instead of naming their handler."""
    ...
def get(template_id: str, resolve_options: bool = ...) -> dict[str, Any]:
    """Get template by ID or name. runtime_available reports whether a node in the zone currently offers the runtime the template needs (always True for manual and Nomad templates). With resolve_options=True, handler-backed custom fields carry their options resolved live instead of naming their handler."""
    ...
def validate(platform: str, job: str = ..., volumes: str = ...) -> dict[str, Any]:
    """Validate template job and volume specifications without saving"""
    ...
def build_spec(platform: str, spec: dict[str, Any], original_job: str = ..., original_volumes: str = ...) -> dict[str, str]:
    """Build native job and volume text from a unified spec (image, environment, ports, storage, memory, cpus). Same conversion as the UI spec wizard. Patch into originals to preserve hand-written content."""
    ...
def nodes(template_id: str) -> builtins.list[dict[str, Any]]:
    """List available placement nodes for a local-container or KVM template (node_id, hostname, running_spaces, total_spaces); empty for other platforms"""
    ...
def create(name: str, job: str = ..., description: str = ..., platform: str = ..., volumes: str = ..., active: bool = ..., compute_units: int = ..., storage_units: int = ..., with_terminal: bool = ..., with_vscode_tunnel: bool = ..., with_code_server: bool = ..., with_ssh: bool = ..., with_run_command: bool = ..., allow_node_migration: bool = ..., schedule_enabled: bool = ..., icon_url: str = ..., with_vnc: bool = ..., groups: builtins.list[str] | None = ..., zones: builtins.list[str] | None = ..., paths: str | builtins.list[str] | None = ..., disable_user_activity: bool = ..., disable_file_storage: bool = ..., disable_user_secrets: bool = ..., health_check_type: str = ..., health_check_config: str = ..., health_check_skip_ssl_verify: bool = ..., health_check_timeout: int = ..., health_check_interval: int = ..., health_check_max_failures: int = ..., health_check_auto_restart: bool = ..., ports: builtins.list[dict[str, Any]] | None = ..., jobs: builtins.list[dict[str, Any]] | None = ..., max_uptime: int = ..., max_uptime_unit: str = ..., idle_timeout: int = ..., idle_timeout_unit: str = ..., port_forwards: builtins.list[dict[str, Any]] | None = ..., custom_fields: builtins.list[dict[str, Any]] | None = ...) -> str:
    """Create a new template. health_check_type can be none, agent, tcp, http, program, or custom. ports is a list of {name, port, protocol} objects, protocol one of "http", "https", "tcp" or "shared" (a shared port is reachable by every user in the same zone through a port forward as user--space, not just the space's owner; http/https get dev URLs, tcp is published on the host); port_forwards is a list of {local_port, space, remote_port} dicts seeded into spaces created from the template and connected when they start (space: a space or pool name, or user--name for another user's shared port); jobs is a list of {name, command, schedule, enabled} objects copied into new spaces; custom_fields declares the template's custom fields. max_uptime / max_uptime_unit and idle_timeout / idle_timeout_unit control the max-runtime and idle auto-stops (unit one of "minute", "hour", "day"; "disabled" or a 0 value turns the stop off). disable_file_storage refuses file storage (knot file, the files API) from the template's spaces; disable_user_secrets refuses personal secrets (knot secret get, knot.secret.get()) from them (Knot Pro); disable_user_activity stops filesystem user activity collection (Knot Pro).

    custom_fields declares the template's custom fields: a list of dicts with
    name, description, type ("text", "masked", "number", "bool", "select", "autocomplete"
    or "textarea"), handler (a plugin field handler id) or options (a manual
    option list) — select and autocomplete take exactly one of the two,
    language (the editor language, textarea only), default — a bool default
    becomes the string "true"/"false"; values are stored as strings — and
    required (bool): a required field cannot be blank when creating or editing
    a space, and the default can satisfy the requirement — and show_on_create
    (bool): an optional field shown on the create-space form without opening
    its optional fields toggle. The list order is the order the form shows
    the fields in.
    """
    ...
def update(template_id: str, name: str | None = ..., job: str | None = ..., description: str | None = ..., platform: str | None = ..., volumes: str | None = ..., active: bool | None = ..., compute_units: int | None = ..., storage_units: int | None = ..., with_terminal: bool | None = ..., with_vscode_tunnel: bool | None = ..., with_code_server: bool | None = ..., with_ssh: bool | None = ..., with_run_command: bool | None = ..., allow_node_migration: bool | None = ..., schedule_enabled: bool | None = ..., with_vnc: bool | None = ..., icon_url: str | None = ..., groups: builtins.list[str] | None = ..., zones: builtins.list[str] | None = ..., paths: str | builtins.list[str] | None = ..., disable_user_activity: bool | None = ..., disable_file_storage: bool | None = ..., disable_user_secrets: bool | None = ..., health_check_type: str | None = ..., health_check_config: str | None = ..., health_check_skip_ssl_verify: bool | None = ..., health_check_timeout: int | None = ..., health_check_interval: int | None = ..., health_check_max_failures: int | None = ..., health_check_auto_restart: bool | None = ..., ports: builtins.list[dict[str, Any]] | None = ..., jobs: builtins.list[dict[str, Any]] | None = ..., max_uptime: int | None = ..., max_uptime_unit: str | None = ..., idle_timeout: int | None = ..., idle_timeout_unit: str | None = ..., port_forwards: builtins.list[dict[str, Any]] | None = ..., custom_fields: builtins.list[dict[str, Any]] | None = ...) -> bool:
    """Update template properties, including health_check_type, health_check_auto_restart, max_uptime, idle_timeout, ports, jobs and port_forwards. Omitted properties are left unchanged. disable_file_storage and disable_user_secrets switch file storage and personal secrets (Knot Pro) off for the template's spaces; disable_user_activity stops user activity collection (Knot Pro). max_uptime / idle_timeout units are one of "minute", "hour", "day"; "disabled" (or a 0 value for idle) turns the stop off. custom_fields, when given, replaces the template's custom fields (same shape as create); omitted leaves them unchanged."""
    ...
def delete(template_id: str) -> bool:
    """Delete a template by ID or name"""
    ...
def get_icons() -> builtins.list[dict[str, Any]]:
    """Get list of available icons, each a dict with description, source and url"""
    ...
def field_handlers() -> builtins.list[dict[str, Any]]:
    """List the field handlers loaded plugins declare (id, label, plugin), for a custom field's handler. Needs manage templates; raises when no plugins are loaded"""
    ...
def export(template_id: str) -> str:
    """Export a template (name or ID) as portable YAML, script IDs replaced by names. Needs manage templates"""
    ...
def import_yaml(yaml_text: str) -> str | None:
    """Create or update (by name) a template from YAML as export() writes it and return its ID (None if the server returns no body); scripts are looked up by name. Needs manage templates"""
    ...
def parse_spec(platform: str, job: str, volumes: str = ...) -> dict[str, Any]:
    """Convert native job/volume text into the unified spec build_spec() takes: wizardable, reason, spec, fully_representable, advanced_reason. Needs manage templates"""
    ...
def base_images() -> dict[str, Any]:
    """The spec wizard's base image catalog: version, manifest_version, description, registry_auth and images (name, display_name, image, category, default_memory, ...)"""
    ...
def refresh_base_images() -> dict[str, Any]:
    """Fetch the base image catalog from its update URL now: updated, active_version, update_url. Needs manage templates; HTTP 409 when updates are not configured"""
    ...
def capabilities() -> builtins.list[dict[str, Any]]:
    """Linux capabilities the spec wizard offers for cap_add/cap_drop: name, description, common"""
    ...
