"""Read your own secrets from 1Password with the token on your profile (Knot Pro). Works only inside a knot space."""
def get(path: str, field: str = ...) -> str:
    """Read a secret by its 1Password reference, op://vault/item/field (op://vault/item/section/field for a field in a section); only inside a space"""
    ...
