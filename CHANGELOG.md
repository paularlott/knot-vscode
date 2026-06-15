# Change Log

## 0.2.2

- Terminal now closes automatically when the remote session ends (e.g. `exit` or connection drop) instead of lingering in the panel.

## 0.2.1

- View title now shows Create Space, Create Stack, Add Server, Refresh (in that order).

## 0.2.0

- **Multiple servers**: connect to any number of Knot servers. Each is a top-level node; add via name (optional) + address + token.
- `Knot: Add Server`, `Knot: Edit Server` (change address / name / token), `Knot: Remove Server`.
- Tree is now 3-level: Server → Stack → Space (standalone spaces sit under the server).
- **Create space** now prompts for any custom fields defined by the chosen template.
- **Create / Delete stack**: instantiate a stack from a stack definition (creates each component space, wires up dependencies and port forwards, with rollback on failure) and delete a stack plus all its spaces.
- Servers (incl. tokens) stored in Secret Storage. Legacy single-server config auto-migrated on first load.
- Removed the old single-server `knot.login` / `knot.logout`.

## 0.1.3

- Group spaces by stack in the tree (collapsible stack nodes).
- Start, stop, and restart stacks via the stack node's inline buttons / context menu.
- Clicking a space row no longer opens a terminal (prevents accidental terminals); use the explicit terminal button instead.

## 0.1.2

- Fix progress notification getting stuck during space creation (the "start now?" prompt now appears after the progress closes).

## 0.1.1

- Brand icon for the activity bar.
- Fix lifecycle actions not reflecting in the tree (commands now reload from the server, with animated spinning icons during start/stop/restart/delete and a burst-poll to track the transition).

## 0.1.0

- Initial release.
- Connect to a Knot server with an API token.
- List, create, delete, start, stop, restart spaces.
- Native web terminal bridged to VS Code.
- Run one-off commands in a space.
- Open code-server / space page in the browser.
- Auto-refresh status polling.
