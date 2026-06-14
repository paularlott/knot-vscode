# Change Log

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
