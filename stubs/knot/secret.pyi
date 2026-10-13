"""Read your own secrets from 1Password with the token on your profile (Knot Pro). Works only inside a knot space."""
def get(path: str, field: str = ...) -> str:
    """Read a secret: path is vault/item (field defaults to password) or a full op:// reference; only inside a space"""
    ...
