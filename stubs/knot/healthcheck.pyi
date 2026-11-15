"""Space health check functions.

Available in every agent-side (in-space) script: health check scripts, startup and shutdown scripts, user scripts and `knot run-script`. Not available in MCP tool execution, event sinks, plugin handlers or AI scripts.
"""
from typing import Any

def http_head(url: str, skip_ssl_verify: bool = ..., timeout: int = ...) -> bool:
    """HTTP HEAD check, returns True if status 200, False otherwise"""
    ...
def tcp_port(port: int, timeout: int = ...) -> bool:
    """TCP port check, returns True if port is open"""
    ...
def program(command: str, timeout: int = ...) -> bool:
    """Run command, returns True if exit code 0"""
    ...
def check_result(healthy: bool) -> Any:
    """Report health check result and exit. Use with combined checks"""
    ...
