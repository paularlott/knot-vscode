"""API client — configured automatically by the knot runtime."""
from typing import Any, Final

DEFAULT_TIMEOUT: Final = 30
"""Default seconds get, post, put and delete wait in the standalone Python implementation."""

CONTENT_TIMEOUT: Final = 600
"""Default seconds get_bytes and put_bytes wait in the standalone Python implementation."""

def configure(url: str, token: str, insecure: bool = ..., ai_url: str = ..., ai_token: str = ..., ai_model: str = ..., ai_provider: str = ...) -> bool:
    """Configure the API client for use outside the knot runtime (spaces and server scripts get it pre-configured). ai_url defaults to url + "/v1", ai_token to token; ai_provider is openai, claude, gemini, ollama, mistral, zai or grok"""
    ...
def is_configured() -> bool:
    """Check if the client has been configured (explicitly or via env vars)"""
    ...
def get(path: str, params: dict[str, Any] | None = ..., timeout: float | None = ...) -> dict[str, Any] | list[Any] | None:
    """GET request to the Knot API. params is an optional dict of query parameters; waits up to timeout seconds if given, otherwise as long as the runtime allows (standalone: DEFAULT_TIMEOUT, or CONTENT_TIMEOUT for get_bytes/put_bytes; None means no limit). Returns the decoded JSON (dict or list), or None for an empty body"""
    ...
def post(path: str, body: dict[str, Any] | None = ..., timeout: float | None = ..., headers: dict[str, str] | None = ...) -> dict[str, Any] | list[Any] | None:
    """POST request to the Knot API. body is a dict; headers are extra request headers (a Content-Type given replaces application/json); waits up to timeout seconds if given, otherwise as long as the runtime allows (standalone: DEFAULT_TIMEOUT, or CONTENT_TIMEOUT for get_bytes/put_bytes; None means no limit). Returns the decoded JSON (dict or list), or None for an empty body"""
    ...
def put(path: str, body: dict[str, Any] | None = ..., timeout: float | None = ...) -> dict[str, Any] | list[Any] | None:
    """PUT request to the Knot API. body is a dict; waits up to timeout seconds if given, otherwise as long as the runtime allows (standalone: DEFAULT_TIMEOUT, or CONTENT_TIMEOUT for get_bytes/put_bytes; None means no limit). Returns the decoded JSON (dict or list), or None for an empty body"""
    ...
def delete(path: str, headers: dict[str, str] | None = ..., timeout: float | None = ...) -> dict[str, Any] | list[Any] | None:
    """DELETE request to the Knot API, with any extra request headers (such as If-Match); waits up to timeout seconds if given, otherwise as long as the runtime allows (standalone: DEFAULT_TIMEOUT, or CONTENT_TIMEOUT for get_bytes/put_bytes; None means no limit). Returns the decoded JSON (dict or list), or None for an empty body"""
    ...
def get_bytes(path: str, timeout: float | None = ...) -> bytes:
    """GET request to the Knot API returning the response body as bytes (file content); waits up to timeout seconds if given, otherwise as long as the runtime allows (standalone: DEFAULT_TIMEOUT, or CONTENT_TIMEOUT for get_bytes/put_bytes; None means no limit)"""
    ...
def put_bytes(path: str, data: str | bytes, content_type: str = ..., timeout: float | None = ...) -> dict[str, Any] | list[Any] | None:
    """PUT request to the Knot API with a string or bytes body (file content); waits up to timeout seconds if given, otherwise as long as the runtime allows (standalone: DEFAULT_TIMEOUT, or CONTENT_TIMEOUT for get_bytes/put_bytes; None means no limit). Returns the decoded JSON (dict or list), or None for an empty body"""
    ...
