"""The authoritative identity surface: who the code runs as.

Handlers receive the caller as inert data in request["user"]; this
library is the authority for any permission decision, and the only
identity read in module code (plugin libraries in libs/, lib scripts),
which never sees a handler's request.
"""

from knot.globals import User

def user() -> User:
    """The requesting user as a User instance — id, name, is_admin, groups, permissions (stable keys), plugin_permissions (qualified grants), with has_permission and in_group. Re-bound on every dispatch, so it always answers with the current user; the admin role passes every check."""
    ...
