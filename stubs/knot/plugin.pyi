"""Calls to declared plugin handlers, as the requesting user.

In user-created MCP tools and event sinks the call rides the in-process
loopback — the same authenticated transport the knot.* libraries use —
through the real web dispatch, so the handler's declared gate applies
exactly as for a browser fetch. In plugin handler environments it is the
in-process bridge between plugins of the same trust domain.
"""

from typing import Any

def call(plugin: str, handler: str, params: dict[str, Any] = ..., method: str = "GET") -> dict[str, Any]:
    """Call a plugin's [[tool.knot.handlers]]-declared handler as the requesting user. params become the query string (GET, the default) or a JSON body (POST). Returns the handler's JSON answer as a dict; raises on a refused gate (permission denied), an undeclared handler, or an unknown plugin."""
    ...
