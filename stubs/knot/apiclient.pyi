"""API client — configured automatically by the knot runtime."""
from typing import Any
def configure(url: str, token: str, insecure: bool = ..., ai_url: str = ..., ai_token: str = ..., ai_model: str = ..., ai_provider: str = ...) -> bool:
    """Configure the API client for use outside the knot runtime (spaces and server scripts get it pre-configured). ai_url defaults to url + "/v1", ai_token to token; ai_provider is openai, claude, gemini, ollama or mistral"""
    ...
def is_configured() -> bool:
    """Check if the client has been configured (explicitly or via env vars)"""
    ...
def get(path: str) -> dict[str, Any]:
    """GET request to the Knot API. params is an optional dict of query parameters"""
    ...
def post(path: str, body: dict[str, Any] | None = ..., expect: int = ...) -> dict[str, Any]:
    """POST request to the Knot API. body is a dict"""
    ...
def put(path: str, body: dict[str, Any] | None = ..., expect: int = ...) -> dict[str, Any]:
    """PUT request to the Knot API. body is a dict"""
    ...
def delete(path: str, expect: int = ...) -> dict[str, Any]:
    """DELETE request to the Knot API"""
    ...
