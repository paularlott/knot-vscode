# Change Log

## 0.1.6

- **Delete Stack**: stacks can now be deleted from the tree view's context menu. The **Delete Stack** action only appears when every space in the stack is stopped, requires knot 0.26.2 or later. SSH host entries for the deleted spaces are cleaned up from `~/.ssh/config`.

## 0.1.5

- **Context-aware lifecycle buttons**: start/stop/restart buttons now show based on state instead of always appearing.
  - **Spaces**: stopped spaces show **Start**; running spaces show **Stop** and **Restart**. (Spaces that are still starting show **Stop**.)
  - **Stacks**: when every space in a stack is running, only **Stop** and **Restart** are shown; when every space is stopped, only **Start** is shown; mixed stacks show all three. Stack rows now also display their aggregate state (Running / Stopped / Mixed) in the description.
- **View Logs**: stream a running space's logs into a terminal tab. Connects to the server's `/logs/{space_id}/stream` WebSocket over the same bearer token (and honours `knot.insecure`), replays the recent history (up to ~1000 lines), then live-tails new lines with their original ANSI colours. Close the tab to stop streaming. Inline icon and context-menu entry appear only for running spaces.
- **Open in VSCode**: when the current window has no folder open, the space now opens in that window instead of always launching a new one; windows with a workspace open still get a new window.

## 0.1.4

- **Web ports**: running spaces that expose HTTP ports now expand to show each dev URL (including alt-name aliases); click to open in the browser. Uses knot 0.26.0's new `/api/server-info` endpoint for the wildcard domain.

## 0.1.3

- **Open in VSCode**: open a running, SSH-enabled space in a new VSCode window via Remote-SSH.
  - Checks for the **Remote-SSH** extension and offers to install it if missing.
  - Requires the **knot CLI** on your `PATH` (or set `knot.cliPath`); it's used as the SSH `ProxyCommand` with the server address + token passed inline, so no `knot connect` is needed.
  - Writes host entries into `~/.ssh/config` using the same alias-block convention as `knot ssh-config update`, but under a per-server `KNOT_VSCODE_<tag>` alias so the two coexist without clashing.
- Removing a server / deleting a space now cleans up its `~/.ssh/config` entry.
- Added a Requirements section to the README.

## 0.1.2

- Icons: Add Server is a server glyph with a `+`; Create Space and Create Stack inline icons are now coloured (amber / purple) and keep their colour on selection.

## 0.1.1

- Top toolbar slimmed down to Add Server + Refresh only.
- Create Space (`+`) and Create Stack (stack `+`) are now inline icons on each server node's row, keeping creates next to the server they apply to.

## 0.1.0

- Initial release.
