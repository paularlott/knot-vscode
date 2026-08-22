"""Knot methods library.

Register JSON-RPC methods backed by a long-running stdio method server.
Agent-only: available in startup scripts and `knot methods register file.py`.
"""
from typing import Any

class Server:
    def __init__(
        self,
        command: str,
        *,
        type: str = "stdio",
        timeout: int = 30,
        args: list[str] | None = None,
        mode: str = "concurrent",
    ) -> None: ...

    def method(
        self,
        name: str,
        *,
        local_name: str = "",
        description: str = "",
        scope: str = "private",
        keywords: list[str] | None = None,
        groups: list[str] | None = None,
        mcp_tool: bool = False,
        params: dict[str, Any] | None = None,
        result: dict[str, Any] | None = None,
        events: list[str] | None = None,
        event_sinks: list[str] | None = None,
    ) -> bool: ...

    def register(self) -> bool: ...

    def unregister(self, name: str | None = None) -> bool: ...
