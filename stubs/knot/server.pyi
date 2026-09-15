"""Server information."""
from typing import Any
def info() -> dict[str, Any]:
    """Get server-wide information: version, wildcard_domain (space web-port URLs, e.g. "*.knot.example.com") and tunnel_domain (dot-prefixed suffix, e.g. ".tunnel.example.com", appended straight after a tunnel name) — the domains are empty when not configured."""
    ...
