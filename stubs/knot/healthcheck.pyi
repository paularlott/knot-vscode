"""Space health check functions.

Only available in agent-side health check scripts and `knot run-script`.
"""
from typing import Any

def http_head(url: str, skip_ssl_verify: bool = ..., timeout: int = ...) -> bool: ...
    """HTTP HEAD check, returns True if status 200, False otherwise"""
def tcp_port(port: int, timeout: int = ...) -> bool: ...
    """TCP port check, returns True if port is open"""
def program(command: str, timeout: int = ...) -> bool: ...
    """Run command, returns True if exit code 0"""
def check_result(healthy: bool) -> Any: ...
    """Report health check result and exit. Use with combined checks"""
