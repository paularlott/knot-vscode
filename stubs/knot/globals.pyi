"""The globals every dispatch binds: params, request and user.

Plugin handler dispatches, MCP tool calls and script tool executions
receive their world through globals — `params` (the call's parameters as
a dict), `request` (method and path) and `user` (a User instance
describing the requesting user). The metadata gates knot enforces before
code runs remain the security boundary; these globals are data and
in-code decision surfaces.
"""


class User:
    """The requesting user's identity and effective permissions.

    Bound as the `user` global on every dispatch. Admins pass every
    permission check by construction.
    """

    id: str
    """The user's id."""

    name: str
    """The user's login name."""

    is_admin: bool
    """Whether the user holds the fixed admin role."""

    groups: list[str]
    """The groups the user belongs to."""

    permissions: list[str]
    """Stable snake_case keys of the built-in permissions the user holds ("manage_spaces", "use_mcp_server", ...). Display names are not used — keys never change when wording does."""

    plugin_permissions: list[str]
    """Qualified plugin grants (e.g. "plugin.metrics.read") the user holds."""

    def has_permission(self, key: str | int) -> bool:
        """Check a permission. The argument picks the check: an integer is a built-in permission id (the knot.permission constants, e.g. knot.permission.MANAGE_SPACES), a "plugin."-prefixed string is a qualified grant ("plugin.metrics.read"), any other string is a built-in's stable key ("manage_spaces"). Admins pass every check."""
        ...

    def in_group(self, name: str) -> bool:
        """Check membership of one group."""
        ...
