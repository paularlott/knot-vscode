# Knot for VS Code

Manage [Knot](https://getknot.dev) cloud development environments directly from VS Code — across **multiple servers**.

## Features

- **Multiple servers** — connect to any number of Knot servers. Each shows as a top-level node in the sidebar; name them or let the address be shown.
- **List spaces** grouped under their server, with live status (running / starting / stopped / deleting) and animated spinners while transitioning.
- **Grouped by stack** — spaces belonging to a stack are nested under a collapsible stack node; standalone spaces sit at the root.
- **Space lifecycle**: start, stop, and restart spaces with inline toolbar buttons or the context menu.
- **Stack lifecycle**: create a stack from a stack definition, plus start, stop, restart, and delete an entire stack from the stack node.
- **Create & delete** spaces by picking a template and naming it (with an optional start-on-create prompt). Custom fields defined by the template are prompted for at create time.
- **Native web terminal** — open an interactive terminal into any running space (per-server credentials), bridged to Knot's web-terminal WebSocket.
- **Run commands** in a space and view the output in an editor.
- **Open code-server** or the space's web page in your browser.
- **Auto-refresh** — polls for status changes **only while the Knot view is visible**, with a short burst-poll right after lifecycle actions.

## Getting started

1. Click the **Knot** icon in the activity bar.
2. Run **Knot: Add Server** (the Add Server button in the view title, or the Command Palette).
3. Enter the server URL, an optional display name, and an API token.
   - Create a token in the Knot web UI.
4. Spaces for that server appear under its node. Add as many servers as you like.

The view title also offers **Create Space**, **Create Stack**, **Add Server**, and **Refresh**.

Servers (including their tokens) are stored securely in VS Code's Secret Storage.

## Managing servers

| Command               | Description                                  |
| --------------------- | -------------------------------------------- |
| `Knot: Add Server`    | Add a server (address, optional name, token) |
| `Knot: Edit Server`   | Change a server's address, name, or token    |
| `Knot: Remove Server` | Remove a server                              |

These are also available on a server node's context menu (right-click).

## Commands

| Command                              | Description                                                        |
| ------------------------------------ | ------------------------------------------------------------------ |
| `Knot: Refresh`                      | Reload all servers                                                 |
| `Knot: Create Space`                 | New space from a template (picks the server, or use a server node) |
| `Knot: Start / Stop / Restart`       | Space lifecycle control                                            |
| `Knot: Start / Stop / Restart Stack` | Stack lifecycle control                                            |
| `Knot: Create Stack`                 | Instantiate a stack from a stack definition (per server)           |
| `Knot: Delete Stack`                 | Delete a stack and all its spaces                                  |
| `Knot: Delete Space`                 | Delete a space                                                     |
| `Knot: Open Terminal`                | Interactive terminal in the space                                  |
| `Knot: Run Command in Space`         | Run a one-off command                                              |
| `Knot: Open Code-Server`             | Open code-server in a browser                                      |
| `Knot: Open in Browser`              | Open the space page                                                |

## Configuration

| Setting                   | Default  | Description                                                                             |
| ------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `knot.autoRefresh`        | `true`   | Poll for status changes                                                                 |
| `knot.refreshInterval`    | `15`     | Polling interval in seconds                                                             |
| `knot.terminalShell`      | `"bash"` | Default shell for new terminals                                                         |
| `knot.insecureSkipVerify` | `false`  | Default _skip TLS verification_ option when adding a server (each server keeps its own) |
| `knot.serverUrl`          | `""`     | Legacy single-server URL, used only to migrate to the multi-server list                 |

## License

Apache-2.0
