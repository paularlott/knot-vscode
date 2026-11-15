"""List and close your tunnels (start tunnels from a space with knot.space.tunnel_start). Needs the use tunnels permission."""
import builtins
from typing import Any
def list() -> builtins.list[dict[str, Any]]:
    """List your open tunnels from every client and space, sorted by name: name ("<username>--<tunnel>") and address (public URL)"""
    ...
def server_info() -> dict[str, Any]:
    """Tunnel server settings: domain (suffix such as ".tunnel.example.com") and tunnel_servers (list of URLs)"""
    ...
def delete(name: str) -> bool:
    """Close one of your tunnels, disconnecting its client; name is the full "<username>--<tunnel>" or the bare tunnel name"""
    ...
