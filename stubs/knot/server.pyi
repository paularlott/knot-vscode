"""Server information, and the hosts space web ports are reached at."""
from typing import Any
def info() -> dict[str, Any]:
    """Get server-wide information: version, wildcard_domain (space web-port URLs, e.g. "*.knot.example.com") and tunnel_domain (dot-prefixed suffix, e.g. ".tunnel.example.com", appended straight after a tunnel name) — the domains are empty when not configured."""
    ...
def host_label(user: str, name: str, port: int | str) -> str:
    """The first label of the host a space's web port is reached at, before the wildcard domain: "<user>--<name>--<port>", lowercased; name is a space, alt name or pool, port a number or "vnc". A label longer than the 63 characters DNS allows has the name cut short and ended with a hyphen and an 8-character hash, which knot routes by"""
    ...
