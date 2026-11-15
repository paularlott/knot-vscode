"""Permission constants for role management."""

import builtins
from typing import Any, Final
MANAGE_USERS: Final = 0
MANAGE_GROUPS: Final = 4
MANAGE_ROLES: Final = 5
MANAGE_SPACES: Final = 2
MANAGE_TEMPLATES: Final = 1
MANAGE_VOLUMES: Final = 3
MANAGE_VARIABLES: Final = 6
USE_SPACES: Final = 7
TRANSFER_SPACES: Final = 10
SHARE_SPACES: Final = 11
USE_TUNNELS: Final = 8
EDIT_SPACE_JOBS: Final = 43
VIEW_AUDIT_LOGS: Final = 9
CLUSTER_INFO: Final = 12
USE_VNC: Final = 13
USE_WEB_TERMINAL: Final = 14
USE_SSH: Final = 15
USE_CODE_SERVER: Final = 16
USE_VSCODE_TUNNEL: Final = 17
USE_LOGS: Final = 18
RUN_COMMANDS: Final = 19
COPY_FILES: Final = 20
USE_MCP_SERVER: Final = 21
USE_WEB_ASSISTANT: Final = 22
MANAGE_SCRIPTS: Final = 23
EXECUTE_SCRIPTS: Final = 24
MANAGE_OWN_SCRIPTS: Final = 25
EXECUTE_OWN_SCRIPTS: Final = 26
MANAGE_GLOBAL_SKILLS: Final = 27
MANAGE_OWN_SKILLS: Final = 28
SET_SPACE_DEPENDENCIES: Final = 29
USE_SPACE_STARTUP_SCRIPT: Final = 30
DOWNLOAD_AUDIT_LOGS: Final = 31
MANAGE_STACK_DEFINITIONS: Final = 32
MANAGE_OWN_STACK_DEFINITIONS: Final = 33
USE_STACK_DEFINITIONS: Final = 34
USE_METHODS: Final = 35
USE_POOLS: Final = 36
MANAGE_EVENTS: Final = 37
MANAGE_GLOBAL_EVENTS: Final = 38
MANAGE_GLOBAL_SLASH_COMMANDS: Final = 39
MANAGE_OWN_SLASH_COMMANDS: Final = 40
MANAGE_MCP_SERVERS: Final = 41
USE_LOG_SINKS: Final = 42
VIEW_PLUGINS: Final = 44
LINK_USERS: Final = 45
USE_FILES: Final = 46
MANAGE_FILES: Final = 47
SHARE_BUCKETS: Final = 48
TRANSFER_BUCKETS: Final = 49
BACKUP_SERVER: Final = 50
USE_USER_SECRETS: Final = 51
RUN_AI_SCRIPTS: Final = 52

def list() -> builtins.list[dict[str, Any]]:
    """List all built-in permissions with their IDs, names, and groups"""
    ...
def list_plugin() -> builtins.list[dict[str, Any]]:
    """List the permissions declared by loaded plugins: dicts with id (the qualified grant, e.g. "plugin.metrics.read"), plugin (the declaring plugin's name) and label (the declared id)."""
    ...

# Aliases
SPACE_MANAGE: Final = 2
SPACE_USE: Final = 7
SCRIPT_MANAGE: Final = 23
SCRIPT_EXECUTE: Final = 24
