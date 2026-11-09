"""Run sync projects in this space's agent: keep local folders in step with bucket folders. Works in scripts that run in a space: startup and shutdown scripts, knot space run-script and knot run-script."""
import builtins
from typing import Any
def start(project: dict[str, Any] | str, name: str = ..., wait: bool = ..., timeout: float = ...) -> dict[str, Any]:
    """Start a sync project, or replace one of the same name; one already running unchanged is left running, so a startup script can start it on every boot. project is a dict like a project file, {"name": "code", "exclude": [...], "no_default_excludes": False, "sync": [{"name", "local", "remote": "bucket:folder/", "snapshot": "bucket:folder/", "mode": "two-way" | "download" | "upload", "watch", "delete", "exclude", "exclude_from", "no_default_excludes", "allow_mass_delete"}]}, or a project file's TOML; name names a project that gives none. wait=True waits up to timeout seconds (default 600) for every job's first pass, raising if one fails. Returns the project's status, as status gives it"""
    ...
def stop(name: str) -> bool:
    """Stop a sync project after sending its last local changes, and forget it. The template's project, named template, cannot be stopped"""
    ...
def list() -> builtins.list[dict[str, Any]]:
    """The sync projects running in this space, the template's included, each as status gives it"""
    ...
def status(name: str) -> dict[str, Any] | None:
    """How a sync project is doing, or None when none of that name runs: name, template (True for the template's) and jobs, each with name, local, remote, mode, state (starting, snapshotting, syncing, watching, done, failed or stopped), passes, last_pass, error, uploaded, downloaded, deleted and conflicts"""
    ...
