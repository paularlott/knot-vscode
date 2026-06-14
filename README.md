# Knot for VS Code

Manage [Knot](https://getknot.dev) cloud development environments directly from VS Code.

## Features

- **List spaces** in a sidebar tree with live status (running / starting / stopped / deleting), animated spinners while transitioning.
- **Grouped by stack** — spaces belonging to a stack are nested under a collapsible stack node; standalone spaces sit at the root.
- **Space lifecycle**: start, stop, and restart spaces with inline toolbar buttons or the context menu.
- **Stack lifecycle**: start, stop, and restart an entire stack (and its dependent spaces) from the stack node.
- **Create & delete** spaces by picking a template and naming it (with an optional start-on-create prompt).
- **Native web terminal** — open an interactive terminal into any running space, bridged to Knot's web-terminal WebSocket. No separate window; works like a local shell.
- **Run commands** in a space and view the output in an editor.
- **Open code-server** or the space's web page in your browser.
- **Auto-refresh** polling so the status stays current, with a short burst-poll right after lifecycle actions to animate through transitions.

## Getting started

1. Install the extension.
2. Set `knot.serverUrl` to your Knot server (e.g. `https://knot.example.com`), or enter it during connect.
3. Run **Knot: Connect to Server** from the Command Palette and paste an API token.
   - Create a token in the Knot web UI (*Profile → Tokens*) or with the CLI:
     `knot admin` → tokens.
4. Spaces appear in the **Knot** view in the activity bar.

For local development with a self-signed certificate, enable `knot.insecureSkipVerify`.

## Commands

| Command | Description |
| --- | --- |
| `Knot: Connect to Server` | Set server URL and API token |
| `Knot: Disconnect` | Forget the current token |
| `Knot: Refresh Spaces` | Reload the space list |
| `Knot: Create Space` | New space from a template |
| `Knot: Start / Stop / Restart` | Space lifecycle control |
| `Knot: Start / Stop / Restart Stack` | Stack lifecycle control |
| `Knot: Delete Space` | Delete a space |
| `Knot: Open Terminal` | Interactive terminal in the space |
| `Knot: Run Command in Space` | Run a one-off command |
| `Knot: Open Code-Server` | Open code-server in a browser |
| `Knot: Open in Browser` | Open the space page |

## Configuration

| Setting | Default | Description |
| --- | --- | --- |
| `knot.serverUrl` | `""` | Base URL of the Knot server |
| `knot.insecureSkipVerify` | `false` | Skip TLS verification (self-signed certs) |
| `knot.autoRefresh` | `true` | Poll for status changes |
| `knot.refreshInterval` | `15` | Polling interval in seconds |
| `knot.terminalShell` | `"bash"` | Default shell for new terminals |

## License

Apache-2.0
