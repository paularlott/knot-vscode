# Change Log

## 0.3.0

- **File storage**: browse, read, edit, rename and delete the files in your Knot [file storage](https://getknot.dev/docs/file-storage/) buckets from VS Code. Requires knot 0.37.0 or later with file storage enabled.
  - A new **Files** view lists each server that has file storage, its buckets (including ones shared with you), and their folders and files. Click a file to open it; **Add to Workspace** on a bucket or folder opens it in the Explorer, where files are edited and saved in place (`knotfs://`).
  - Rename and delete work on files and on whole folders, and renaming happens on the server without moving any content. Buckets shared read-only open read-only.
  - A save is refused, with a message, if the file changed on the server in the meantime.
  - Servers without file storage are left out of the view, and the server's API token needs the `files` scope or full access.

## 0.2.5

- **Python IntelliSense**: new `knot.files` type stubs for the file storage library — `list_buckets`, `create_bucket`, `share_bucket`, `list_files`, `read_file`, `read_text`, `write_file`, `get_bytes`, `put_bytes` and the rest, with docstrings. `knot.apiclient` gained the matching helpers. Space and template stubs refreshed.

## 0.2.4

- **Pool leases**: `knot.pool` stubs for exclusive member leases — `acquire`, `extend`, `release`, `leases` and the `leased` context manager (with `destroy` to replace the member afterwards). Pool and server types gained the lease fields (`lease_state`, `lease_holder`, `lease_expires_at`, `lease_max_time`, `lease_max_extensions`) and the server's `tunnel_domain`.
- **Python IntelliSense**: function stubs refined.

## 0.2.3

- **KVM spaces**: `knot.space.create` and `update` take `ip_address` for bridged KVM templates, and there are new `get_ip_address` / `set_ip_address` functions.
- **Python IntelliSense**: new stubs and completions for
  - `knot.token` (`list`, `create`, `delete`) and `knot.apiclient` (`configure`, `is_configured`);
  - permissions and roles — `knot.permission`, `knot.role` and `knot.user` (`has_permission`, plugin permissions), including role create and update with `plugin_permissions`;
  - plugins — `knot.plugin.user()` and `call()`, plus the dispatch `globals` (`params`, `request`, `user`);
  - templates — custom field types and the `required` option, `field_options`, and `resolve_options` on `list` and `get`;
  - tunnels — `tunnel_start`.

## 0.2.2

- **Python IntelliSense**: the `User` class available to plugin and tool scripts (`has_permission`, `in_group`) and the new permission and globals stubs.

## 0.2.1

- **Python IntelliSense**: `knot.space.create` and `update` stubs gained the missing parameters (`stack`, `selected_node_id`, `alt_names`, `startup_script_id`, `depends_on`) and no longer list lifecycle arguments that belong to `start`, `stop` and `restart`.

## 0.2.0

- **Python IntelliSense**: all `knot.*` type stubs now carry full docstrings (170 functions across 20 modules) — hover documentation and inline help in VS Code match the web editor's descriptions instead of showing bare signatures. New `knot.space.wait_for_start(name, timeout=30, interval=2)` stub for the space-start wait function (requires knot 0.33.0 or later).

## 0.1.15

- **Python IntelliSense**: new `knot.jobs` type stub — autocompletion, hover docs, and type checking for the space jobs library (`list`, `run`, `add`, `update`, `remove`, `enable`, `disable`, `enable_runner`, `disable_runner`); `knot.template` create/update gained a `jobs` parameter. Requires knot 0.33.0 or later.

## 0.1.14

- **Python IntelliSense**: type stubs updated to match the latest knot libraries — new `knot.healthcheck`, `knot.slash_command`, and `knot.methods.schema` modules.

## 0.1.13

- **Python IntelliSense**: added `knot.template.build_spec()` to the bundled type stubs — autocompletion, hover docs, and type checking for the new spec-building helper that converts a unified spec (image, env vars, ports, storage, resources) into native Nomad HCL or container YAML, the programmatic equivalent of the UI spec wizard.

## 0.1.12

- **Open in VSCode**: editing a server's address, token, or TLS setting now rewrites that server's existing `~/.ssh/config` host entries with the new connection params, so Remote-SSH reconnects and history entries stop reusing values baked in at open time. Previously only a fresh "Open in VSCode" refreshed the hosts, so reconnects and clicks on a host in Remote-SSH history failed after a token rotation.

## 0.1.7

- **Space Pools**: pools are now visible in the tree view, grouped as collapsible nodes with their member spaces as children. Requires knot 0.27.0 or later.
  - Pool rows show live/deployed count and active/stopped state.
  - **Create Pool** button on server nodes, alongside Create Space and Create Stack.
  - **Start Pool** and **Stop Pool** appear in the context menu and inline based on pool state.
  - **Set Pool Size** opens an input box to change the desired space count; the sweep loop handles creating or removing members.
  - **Delete Pool** (stopped pools only) deletes all member spaces and the pool definition.
  - Pool member spaces are excluded from the standalone/stack sections and have no individual lifecycle buttons (start/stop/restart/delete), matching the web UI.
- **Python IntelliSense for knot.\* libraries**: bundled PEP 561 type stubs for all `knot.space`, `knot.pool`, `knot.template`, `knot.stack`, `knot.script`, `knot.user`, `knot.volume`, `knot.vars`, `knot.group`, `knot.role`, `knot.audit`, `knot.skill`, `knot.mcp`, `knot.ai`, `knot.apiclient`, and `knot.permission` libraries. Stubs are registered with Pylance automatically on activation, providing autocompletion, hover docs, and type checking in any Python file that imports `knot.*`.

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
