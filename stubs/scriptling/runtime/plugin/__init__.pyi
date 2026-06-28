"""
Scriptling Runtime Plugin Library - Type stubs for IntelliSense support.

Declare a script as a Scriptling plugin server. When ``runtime.start_server()``
is called the CLI switches from the plain JSON-RPC loop to the full Scriptling
plugin protocol so that clients can load the script with ``scriptling=True``
and receive auto-generated proxy libraries.

Available in the **agent variant** of scriptling only.

Example::

    import scriptling.runtime.plugin as plugin_srv
    import scriptling.runtime as runtime

    plugin_srv.serve("myservice", "1.0", "My service")
    plugin_srv.register_function("greet", "handlers.greet")
    plugin_srv.register_constant("VERSION", "1.0.0")
    plugin_srv.register_class("handlers.Config")
    runtime.start_server()
"""

from typing import Any


def serve(name: str, version: str = "", description: str = "") -> None:
    """
    Declare this script as a Scriptling plugin server.

    Parameters:
        name:        Library name (e.g. ``"myservice"``). Clients import it as
                     ``plugin.myservice``.
        version:     Optional version string (e.g. ``"1.0.0"``).
        description: Optional human-readable description.
    """
    ...


def register_function(name: str, handler: str) -> None:
    """
    Register a function for the plugin server.

    Parameters:
        name:    Function name exposed to plugin clients.
        handler: Handler as ``"library.function"`` string. The handler
                 receives individual positional arguments decoded from the
                 plugin transport. Callable arguments are passed as callback
                 objects; the handler can call them with ``cb(args)``.
                 Callbacks require the stdio transport.
    """
    ...


def register_constant(name: str, value: Any) -> None:
    """
    Register a constant exported by the plugin server.

    Clients read it as ``plugin.myservice.NAME``.

    Parameters:
        name:  Constant name.
        value: Any JSON-serialisable value.
    """
    ...


def register_class(handler: str) -> None:
    """
    Register a class exported by the plugin server.

    The exposed class name is taken from the last segment of the handler
    (e.g. ``"mymodule.Config"`` → ``"Config"``). Clients instantiate it and
    call methods; instances are held server-side as remote objects.

    Parameters:
        handler: Class as ``"library.ClassName"`` string.
    """
    ...
