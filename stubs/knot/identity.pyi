"""The requesting user for module code (plugin libraries in libs/, lib scripts)."""

from knot.globals import User

def user() -> User:
    """The User instance the `user` global holds — id, name, is_admin, groups, permissions (stable keys), plugin_permissions (qualified grants), with has_permission and in_group. Module code can't see the dispatch globals (their scope is the calling program), so this library carries the same instance; it is re-bound per dispatch, so it always answers with the current user."""
    ...
