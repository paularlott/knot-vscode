# Change Log

## 0.1.3

- **Open in VSCode**: open a running, SSH-enabled space in a new VSCode window via Remote-SSH.
  - Checks for the **Remote-SSH** extension and offers to install it if missing.
  - Requires the **knot CLI** on your `PATH` (or set `knot.cliPath`); it's used as the SSH `ProxyCommand` with the server address + token passed inline, so no `knot connect` is needed.
  - Writes host entries into `~/.ssh/config` using the same alias-block convention as `knot ssh-config update`, but under a per-server `KNOT_VSCODE_<tag>` alias so the two coexist without clashing.
- Added a Requirements section to the README.

## 0.1.2

- Icons: Add Server is a server glyph with a `+`; Create Space and Create Stack inline icons are now coloured (amber / purple) and keep their colour on selection.

## 0.1.1

- Top toolbar slimmed down to Add Server + Refresh only.
- Create Space (`+`) and Create Stack (stack `+`) are now inline icons on each server node's row, keeping creates next to the server they apply to.

## 0.1.0

- Initial release.
