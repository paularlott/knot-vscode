"""Permission constants for role management."""

import builtins
from typing import Any
MANAGE_USERS: int
MANAGE_GROUPS: int
MANAGE_ROLES: int
MANAGE_SPACES: int
MANAGE_TEMPLATES: int
MANAGE_VOLUMES: int
MANAGE_VARIABLES: int
USE_SPACES: int
TRANSFER_SPACES: int
SHARE_SPACES: int
USE_TUNNELS: int
EDIT_SPACE_JOBS: int
VIEW_AUDIT_LOGS: int
CLUSTER_INFO: int
USE_VNC: int
USE_WEB_TERMINAL: int
USE_SSH: int
USE_CODE_SERVER: int
USE_VSCODE_TUNNEL: int
USE_LOGS: int
RUN_COMMANDS: int
COPY_FILES: int
USE_MCP_SERVER: int
USE_WEB_ASSISTANT: int
MANAGE_SCRIPTS: int
EXECUTE_SCRIPTS: int
MANAGE_OWN_SCRIPTS: int
EXECUTE_OWN_SCRIPTS: int
MANAGE_GLOBAL_SKILLS: int
MANAGE_OWN_SKILLS: int
SET_SPACE_DEPENDENCIES: int
USE_SPACE_STARTUP_SCRIPT: int
DOWNLOAD_AUDIT_LOGS: int
MANAGE_STACK_DEFINITIONS: int
MANAGE_OWN_STACK_DEFINITIONS: int
USE_STACK_DEFINITIONS: int
USE_METHODS: int
USE_POOLS: int
MANAGE_EVENTS: int
MANAGE_GLOBAL_EVENTS: int
MANAGE_GLOBAL_SLASH_COMMANDS: int
MANAGE_OWN_SLASH_COMMANDS: int
MANAGE_MCP_SERVERS: int
VIEW_PLUGINS: int
LINK_USERS: int

def list() -> builtins.list[dict[str, Any]]:
    """List all built-in permissions with their IDs, names, and groups"""
    ...
def list_plugin() -> builtins.list[dict[str, Any]]:
    """List the permissions declared by loaded plugins: dicts with id (the qualified grant, e.g. "plugin.metrics.read"), plugin (the declaring plugin's name) and label (the declared id)."""
    ...

# Aliases
SPACE_MANAGE: int
SPACE_USE: int
SCRIPT_MANAGE: int
SCRIPT_EXECUTE: int
