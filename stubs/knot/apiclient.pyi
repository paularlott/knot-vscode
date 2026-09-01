"""API client — configured automatically by the knot runtime."""
from typing import Any
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
