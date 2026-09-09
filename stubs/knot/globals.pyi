"""The `user` global user-created MCP tools see, and the User class.

Plugin handlers receive no globals: their single `request` argument
carries {method, path, params, user} — with `user` an inert identity
snapshot for branching, not authority. The authoritative identity
surface everywhere is knot.identity. This global exists only in the
MCP-tool environment, where a tool script has no request to read.
"""


class User:
    """The requesting user's identity and effective permissions.

    Bound as the `user` global in user-created MCP tools; returned by
    knot.identity.user() everywhere identity matters. Admins pass every
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
