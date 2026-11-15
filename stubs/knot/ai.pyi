"""AI client access (delegates to scriptling.ai)."""
from typing import Any
def get_default_model() -> str:
    """Get the default model name. Returns "" in embedded contexts (the server then uses its configured default model when "" is passed to completion()); standalone it returns the ai_model given to knot.apiclient.configure() or KNOT_AI_MODEL, or "" when unset."""
    ...
def Client() -> Any:
    """Get a pre-configured AI client instance connected to the server's AI provider with MCP tools available"""
    ...
