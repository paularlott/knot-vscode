import * as vscode from 'vscode';
import type { CustomFieldValue, PortForwardRequest, SpaceRequest, StackDefinitionInfo, StackDefSpace, Template } from './api/types';
import { describeError, defaultInsecure } from './session';
import type { ConnectedServer, ServerConfig, ServerStore } from './serverStore';
import { serverLabel } from './serverStore';
import { SpaceItem, SpacesTreeProvider, StackItem } from './provider/spacesTreeProvider';
import { createKnotTerminal } from './terminal/knotTerminal';

export interface CommandContext {
    store: ServerStore;
    tree: SpacesTreeProvider;
    reload: () => Promise<void>;
    reloadServer: (id: string) => Promise<void>;
    ensureConnected: (id: string) => Promise<ConnectedServer | undefined>;
}

function defaultShell(): string {
    return vscode.workspace.getConfiguration('knot').get<string>('terminalShell', '') || 'bash';
}

export function registerCommands(ctx: CommandContext): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('knot.addServer', () => cmdAddServer(ctx)),
        vscode.commands.registerCommand('knot.editServer', (node?: { serverId?: string }) =>
            cmdEditServer(ctx, node?.serverId),
        ),
        vscode.commands.registerCommand('knot.removeServer', (node?: { serverId?: string }) =>
            cmdRemoveServer(ctx, node?.serverId),
        ),
        vscode.commands.registerCommand('knot.refresh', () => ctx.reload()),
        vscode.commands.registerCommand('knot.createSpace', (node?: { serverId?: string }) =>
            cmdCreateSpace(ctx, node?.serverId),
        ),
        vscode.commands.registerCommand('knot.deleteSpace', (item?: SpaceItem) => cmdDeleteSpace(ctx, item)),
        vscode.commands.registerCommand('knot.startSpace', (item?: SpaceItem) => cmdLifecycle(ctx, item, 'start')),
        vscode.commands.registerCommand('knot.stopSpace', (item?: SpaceItem) => cmdLifecycle(ctx, item, 'stop')),
        vscode.commands.registerCommand('knot.restartSpace', (item?: SpaceItem) => cmdLifecycle(ctx, item, 'restart')),
        vscode.commands.registerCommand('knot.startStack', (item?: StackItem) => cmdStackLifecycle(ctx, item, 'start')),
        vscode.commands.registerCommand('knot.stopStack', (item?: StackItem) => cmdStackLifecycle(ctx, item, 'stop')),
        vscode.commands.registerCommand('knot.restartStack', (item?: StackItem) => cmdStackLifecycle(ctx, item, 'restart')),
        vscode.commands.registerCommand('knot.createStack', (node?: { serverId?: string }) => cmdCreateStack(ctx, node?.serverId)),
        vscode.commands.registerCommand('knot.deleteStack', (item?: StackItem) => cmdDeleteStack(ctx, item)),
        vscode.commands.registerCommand('knot.openTerminal', (item?: SpaceItem) => cmdOpenTerminal(ctx, item)),
        vscode.commands.registerCommand('knot.runCommand', (item?: SpaceItem) => cmdRunCommand(ctx, item)),
        vscode.commands.registerCommand('knot.openCodeServer', (item?: SpaceItem) => cmdOpenUrl(ctx, item, 'code-server')),
        vscode.commands.registerCommand('knot.openInBrowser', (item?: SpaceItem) => cmdOpenUrl(ctx, item, 'space')),
    ];
}

// ---------------------------------------------------------------------------
// Server management
// ---------------------------------------------------------------------------

async function cmdAddServer(ctx: CommandContext): Promise<void> {
    const input = await promptServer(ctx, undefined);
    if (!input) {
        return;
    }
    const server = await ctx.store.add(input);
    // Connecting validates the token; report failure but keep the server so it can be edited.
    const conn = await ctx.ensureConnected(server.id);
    if (conn) {
        vscode.window.showInformationMessage(`Knot: connected to "${serverLabel(server)}" as ${conn.user.username}.`);
    } else {
        vscode.window.showWarningMessage(
            `Knot: saved "${serverLabel(server)}" but could not connect. Edit it to fix the address or token.`,
        );
    }
}

async function cmdEditServer(ctx: CommandContext, serverId?: string): Promise<void> {
    const server = await resolveServer(ctx, serverId);
    if (!server) {
        return;
    }
    const input = await promptServer(ctx, server);
    if (!input) {
        return;
    }
    await ctx.store.update(server.id, input);
    const conn = await ctx.ensureConnected(server.id);
    if (conn) {
        vscode.window.showInformationMessage(`Knot: updated "${serverLabel(server)}".`);
    } else {
        vscode.window.showWarningMessage(`Knot: updated "${serverLabel(server)}" but connection failed.`);
    }
}

async function cmdRemoveServer(ctx: CommandContext, serverId?: string): Promise<void> {
    const server = await resolveServer(ctx, serverId);
    if (!server) {
        return;
    }
    const confirm = await vscode.window.showWarningMessage(
        `Remove server "${serverLabel(server)}"?`,
        { modal: true },
        'Remove',
    );
    if (confirm !== 'Remove') {
        return;
    }
    await ctx.store.remove(server.id);
    await ctx.reload();
    vscode.window.showInformationMessage(`Knot: removed "${serverLabel(server)}".`);
}

interface ServerInput {
    address: string;
    name?: string;
    token: string;
    insecure: boolean;
}

/** Prompt for address / optional name / token (+ insecure). Prefilled when editing. */
async function promptServer(ctx: CommandContext, existing: ServerConfig | undefined): Promise<ServerInput | undefined> {
    const address = await vscode.window.showInputBox({
        prompt: 'Knot server URL',
        value: existing?.address ?? '',
        placeHolder: 'https://knot.example.com',
        ignoreFocusOut: true,
        validateInput: (v) => (/^https?:\/\//.test(v.trim()) ? undefined : 'Enter a full http(s):// URL'),
    });
    if (address === undefined) {
        return undefined;
    }

    const name = await vscode.window.showInputBox({
        prompt: 'Display name (optional)',
        value: existing?.name ?? '',
        placeHolder: 'e.g. Production',
        ignoreFocusOut: true,
    });
    if (name === undefined) {
        return undefined;
    }

    const token = await vscode.window.showInputBox({
        prompt: 'API token (Bearer)',
        value: existing?.token ?? '',
        password: true,
        placeHolder: 'Paste the token from the Knot web UI or "knot admin"',
        ignoreFocusOut: true,
        validateInput: (v) => (v.trim().length > 0 ? undefined : 'Token required'),
    });
    if (token === undefined) {
        return undefined;
    }

    const insecure = existing?.insecure ?? defaultInsecure();

    return {
        address: address.trim().replace(/\/+$/, ''),
        name: name.trim() || undefined,
        token: token.trim(),
        insecure,
    };
}

async function resolveServer(ctx: CommandContext, serverId?: string): Promise<ServerConfig | undefined> {
    if (serverId) {
        return ctx.store.get(serverId);
    }
    const servers = ctx.store.list();
    if (servers.length === 0) {
        vscode.window.showInformationMessage('Knot: no servers configured.');
        return undefined;
    }
    if (servers.length === 1) {
        return servers[0];
    }
    const picked = await vscode.window.showQuickPick(
        servers.map((s) => ({ label: serverLabel(s), description: s.address, server: s })),
        { placeHolder: 'Select a server', ignoreFocusOut: true },
    );
    return picked?.server;
}

// ---------------------------------------------------------------------------
// Space lifecycle
// ---------------------------------------------------------------------------

async function cmdLifecycle(
    ctx: CommandContext,
    item: SpaceItem | undefined,
    action: 'start' | 'stop' | 'restart',
): Promise<void> {
    const space = item ?? (await pickSpace(ctx));
    if (!space) {
        return;
    }
    const conn = await ctx.ensureConnected(space.serverId);
    if (!conn) {
        return;
    }
    const name = space.space.name || space.space.space_id;
    const verb = action === 'start' ? 'Starting' : action === 'stop' ? 'Stopping' : 'Restarting';
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Knot: ${verb} "${name}"` },
        async () => {
            try {
                await conn.client[`${action}Space`](space.space.space_id);
                await ctx.reloadServer(space.serverId);
                for (const delay of [2000, 5000, 9000]) {
                    setTimeout(() => void ctx.reloadServer(space.serverId), delay);
                }
            } catch (err) {
                vscode.window.showErrorMessage(`Knot: ${describeError(err)}`);
            }
        },
    );
}

async function cmdStackLifecycle(
    ctx: CommandContext,
    item: StackItem | undefined,
    action: 'start' | 'stop' | 'restart',
): Promise<void> {
    const stack = item ?? (await pickStack(ctx));
    if (!stack) {
        return;
    }
    const conn = await ctx.ensureConnected(stack.serverId);
    if (!conn) {
        return;
    }
    const verb = action === 'start' ? 'Starting' : action === 'stop' ? 'Stopping' : 'Restarting';
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Knot: ${verb} stack "${stack.stackName}"` },
        async () => {
            try {
                await conn.client[`${action}Stack`](stack.stackName);
                await ctx.reloadServer(stack.serverId);
                for (const delay of [3000, 8000, 15000, 25000]) {
                    setTimeout(() => void ctx.reloadServer(stack.serverId), delay);
                }
            } catch (err) {
                vscode.window.showErrorMessage(`Knot: ${describeError(err)}`);
            }
        },
    );
}

async function cmdCreateStack(ctx: CommandContext, serverId?: string): Promise<void> {
    const server = await resolveServer(ctx, serverId);
    if (!server) {
        return;
    }
    const conn = await ctx.ensureConnected(server.id);
    if (!conn) {
        return;
    }

    let defs: StackDefinitionInfo[] = [];
    try {
        const list = await conn.client.listStackDefinitions();
        defs = (list.stack_definitions ?? []).filter((d) => d.active);
    } catch (err) {
        vscode.window.showErrorMessage(`Knot: failed to load stack definitions: ${describeError(err)}`);
        return;
    }
    if (defs.length === 0) {
        vscode.window.showWarningMessage('Knot: no active stack definitions on this server.');
        return;
    }

    const def = await vscode.window.showQuickPick(
        defs.map((d) => ({ label: d.name, description: `${d.spaces?.length ?? 0} space(s)`, detail: d.description, def: d })),
        { placeHolder: 'Select a stack definition', ignoreFocusOut: true, matchOnDetail: true },
    );
    if (!def) {
        return;
    }

    const prefix = await vscode.window.showInputBox({
        prompt: 'Prefix for space names (spaces are named prefix-component)',
        placeHolder: 'myapp',
        ignoreFocusOut: true,
        validateInput: (v) => (/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(v) ? undefined : 'lowercase, digits and "-" only'),
    });
    if (!prefix) {
        return;
    }

    const stackName = (await vscode.window.showInputBox({
        prompt: 'Stack name to group spaces under (defaults to prefix)',
        placeHolder: prefix,
        ignoreFocusOut: true,
    })) || prefix;

    const components = def.def.spaces ?? [];
    if (components.length === 0) {
        vscode.window.showWarningMessage(`Knot: stack definition "${def.def.name}" has no spaces.`);
        return;
    }

    const created: { key: string; id: string; comp: StackDefSpace }[] = [];
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Knot: creating stack "${stackName}"` },
        async (progress) => {
            const step = 100 / (components.length * 3 || 1);
            try {
                // Pass 1: create all spaces.
                for (const comp of components) {
                    const spaceName = `${prefix}-${comp.name}`;
                    progress.report({ message: `creating ${spaceName}`, increment: step });
                    const id = await conn.client.createSpace({
                        name: spaceName,
                        template_id: comp.template_id,
                        stack: stackName,
                        description: comp.description || '',
                        shell: comp.shell || '',
                        custom_fields: (comp.custom_fields ?? []).map((cf) => ({ name: cf.name, value: cf.value })),
                    });
                    created.push({ key: comp.name, id, comp });
                }

                // Pass 2: resolve dependencies (keys -> space IDs).
                const keyToId = new Map(created.map((c) => [c.key, c.id]));
                for (const c of created) {
                    if (!c.comp.depends_on?.length) {
                        continue;
                    }
                    progress.report({ message: `linking ${prefix}-${c.key}`, increment: step });
                    const depIds = c.comp.depends_on.map((k) => keyToId.get(k)).filter((id): id is string => !!id);
                    if (depIds.length) {
                        await conn.client.updateSpace(c.id, {
                            name: `${prefix}-${c.key}`,
                            template_id: c.comp.template_id,
                            stack: stackName,
                            depends_on: depIds,
                        });
                    }
                }

                // Pass 3: apply port forwards.
                for (const c of created) {
                    if (!c.comp.port_forwards?.length) {
                        continue;
                    }
                    progress.report({ message: `ports for ${prefix}-${c.key}`, increment: step });
                    const forwards: PortForwardRequest[] = c.comp.port_forwards
                        .map((pf) => {
                            const target = keyToId.get(pf.to_space);
                            return target
                                ? { local_port: pf.local_port, space: target, remote_port: pf.remote_port, persistent: true }
                                : undefined;
                        })
                        .filter((f): f is PortForwardRequest => !!f);
                    if (forwards.length) {
                        await conn.client.applyPorts(c.id, { forwards });
                    }
                }
            } catch (err) {
                // Roll back any spaces already created.
                progress.report({ message: 'rolling back' });
                for (const c of created) {
                    try {
                        await conn.client.deleteSpace(c.id);
                    } catch {
                        // best-effort
                    }
                }
                vscode.window.showErrorMessage(
                    `Knot: stack create failed (${describeError(err)}). Rolled back ${created.length} space(s).`,
                );
                await ctx.reloadServer(server.id);
                return;
            }
        },
    );

    await ctx.reloadServer(server.id);
    vscode.window.showInformationMessage(
        `Knot: stack "${stackName}" created from "${def.def.name}" (${created.length} spaces).`,
    );
}

async function cmdDeleteStack(ctx: CommandContext, item?: StackItem): Promise<void> {
    const stack = item ?? (await pickStack(ctx));
    if (!stack) {
        return;
    }
    const conn = await ctx.ensureConnected(stack.serverId);
    if (!conn) {
        return;
    }
    const spaces = stack.children;
    if (spaces.length === 0) {
        vscode.window.showInformationMessage(`Knot: stack "${stack.stackName}" has no spaces.`);
        return;
    }
    const confirm = await vscode.window.showWarningMessage(
        `Delete stack "${stack.stackName}" and its ${spaces.length} space(s)? This cannot be undone.`,
        { modal: true },
        'Delete',
    );
    if (confirm !== 'Delete') {
        return;
    }
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Knot: deleting stack "${stack.stackName}"` },
        async (progress) => {
            const step = 100 / (spaces.length || 1);
            let failures = 0;
            for (const s of spaces) {
                progress.report({ message: `deleting ${s.space.name || s.space.space_id}`, increment: step });
                try {
                    await conn.client.deleteSpace(s.space.space_id);
                } catch {
                    failures++;
                }
            }
            await ctx.reloadServer(stack.serverId);
            if (failures) {
                vscode.window.showWarningMessage(`Knot: deleted stack, ${failures} space(s) could not be removed.`);
            }
        },
    );
}

async function cmdDeleteSpace(ctx: CommandContext, item?: SpaceItem): Promise<void> {
    const space = item ?? (await pickSpace(ctx));
    if (!space) {
        return;
    }
    const conn = await ctx.ensureConnected(space.serverId);
    if (!conn) {
        return;
    }
    const name = space.space.name || space.space.space_id;
    const confirm = await vscode.window.showWarningMessage(
        `Delete space "${name}"? This cannot be undone.`,
        { modal: true },
        'Delete',
    );
    if (confirm !== 'Delete') {
        return;
    }
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Knot: deleting "${name}"` },
        async () => {
            try {
                await conn.client.deleteSpace(space.space.space_id);
                await ctx.reloadServer(space.serverId);
            } catch (err) {
                vscode.window.showErrorMessage(`Knot: ${describeError(err)}`);
            }
        },
    );
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

async function cmdCreateSpace(ctx: CommandContext, serverId?: string): Promise<void> {
    const server = await resolveServer(ctx, serverId);
    if (!server) {
        return;
    }
    const conn = await ctx.ensureConnected(server.id);
    if (!conn) {
        return;
    }

    let templates: Template[] = [];
    try {
        const list = await conn.client.listTemplates();
        templates = list.templates ?? [];
    } catch (err) {
        vscode.window.showErrorMessage(`Knot: failed to load templates: ${describeError(err)}`);
        return;
    }
    if (templates.length === 0) {
        vscode.window.showWarningMessage('Knot: no templates available on this server.');
        return;
    }

    const template = await vscode.window.showQuickPick(
        templates.map((t) => ({ label: t.name, description: t.platform, detail: t.description, template: t })),
        { placeHolder: 'Select a template', ignoreFocusOut: true, matchOnDescription: true, matchOnDetail: true },
    );
    if (!template) {
        return;
    }

    const name = await vscode.window.showInputBox({
        prompt: 'Space name',
        placeHolder: 'my-space',
        ignoreFocusOut: true,
        validateInput: (v) => (/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(v) ? undefined : 'lowercase, digits and "-" only'),
    });
    if (!name) {
        return;
    }
    const description = await vscode.window.showInputBox({ prompt: 'Description (optional)', ignoreFocusOut: true });

    // Prompt for any custom fields defined by the template.
    const customFields: CustomFieldValue[] = [];
    for (const cf of template.template.custom_fields ?? []) {
        const value = await vscode.window.showInputBox({
            prompt: cf.description || `Custom field: ${cf.name}`,
            placeHolder: cf.name,
            ignoreFocusOut: true,
        });
        if (value === undefined) {
            return; // user cancelled
        }
        if (value.trim()) {
            customFields.push({ name: cf.name, value });
        }
    }

    const req: SpaceRequest = {
        name,
        template_id: template.template.template_id,
        description: description || '',
        custom_fields: customFields.length ? customFields : undefined,
    };

    let createdId: string | undefined;
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Knot: creating "${name}"` },
        async () => {
            try {
                createdId = await conn.client.createSpace(req);
            } catch (err) {
                vscode.window.showErrorMessage(`Knot: create failed: ${describeError(err)}`);
            }
        },
    );
    if (!createdId) {
        return;
    }
    await ctx.reloadServer(server.id);

    const start = await vscode.window.showInformationMessage(
        `Knot: created "${name}". Start it now?`,
        'Start',
        'Not now',
    );
    if (start === 'Start') {
        await conn.client.startSpace(createdId);
        await ctx.reloadServer(server.id);
        for (const delay of [2000, 5000, 9000]) {
            setTimeout(() => void ctx.reloadServer(server.id), delay);
        }
    }
}

// ---------------------------------------------------------------------------
// Terminal / run command / open URLs
// ---------------------------------------------------------------------------

async function cmdOpenTerminal(ctx: CommandContext, item?: SpaceItem): Promise<void> {
    const space = item ?? (await pickSpace(ctx));
    if (!space) {
        return;
    }
    if (!space.space.has_terminal) {
        vscode.window.showWarningMessage(`Knot: "${space.space.name}" has no terminal (start the space first).`);
        return;
    }
    const conn = await ctx.ensureConnected(space.serverId);
    if (!conn) {
        return;
    }
    try {
        const def = await conn.client.getSpace(space.space.space_id);
        const shell = def.shell || defaultShell();
        const term = createKnotTerminal({
            baseUrl: conn.config.address,
            token: conn.config.token,
            insecureSkipVerify: conn.config.insecure,
            space: space.space,
            shell,
        });
        term.show();
    } catch (err) {
        vscode.window.showErrorMessage(`Knot: terminal failed: ${describeError(err)}`);
    }
}

async function cmdRunCommand(ctx: CommandContext, item?: SpaceItem): Promise<void> {
    const space = item ?? (await pickSpace(ctx));
    if (!space) {
        return;
    }
    const conn = await ctx.ensureConnected(space.serverId);
    if (!conn) {
        return;
    }
    const command = await vscode.window.showInputBox({
        prompt: `Run command in "${space.space.name}"`,
        placeHolder: 'e.g. make test',
        ignoreFocusOut: true,
    });
    if (!command) {
        return;
    }
    const [cmd, ...args] = command.trim().split(/\s+/);
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Knot: running "${command}"` },
        async () => {
            try {
                const res = await conn.client.runCommand(space.space.space_id, { command: cmd, args });
                const doc = await vscode.workspace.openTextDocument({ content: res.output, language: 'log' });
                await vscode.window.showTextDocument(doc);
            } catch (err) {
                vscode.window.showErrorMessage(`Knot: ${describeError(err)}`);
            }
        },
    );
}

async function cmdOpenUrl(ctx: CommandContext, item: SpaceItem | undefined, kind: 'code-server' | 'space'): Promise<void> {
    const space = item ?? (await pickSpace(ctx));
    if (!space) {
        return;
    }
    const server = ctx.store.get(space.serverId);
    if (!server) {
        vscode.window.showErrorMessage('Knot: server not found.');
        return;
    }
    const id = space.space.space_id;
    const url = kind === 'code-server' ? `${server.address}/proxy/spaces/${id}/code-server/` : `${server.address}/space/${id}`;
    void vscode.env.openExternal(vscode.Uri.parse(url));
}

// ---------------------------------------------------------------------------
// Pickers
// ---------------------------------------------------------------------------

async function pickSpace(ctx: CommandContext): Promise<SpaceItem | undefined> {
    const spaces = ctx.tree.getSpaces();
    if (spaces.length === 0) {
        vscode.window.showInformationMessage('Knot: no spaces available.');
        return undefined;
    }
    const picked = await vscode.window.showQuickPick(
        spaces.map((s) => ({
            label: s.space.name || s.space.space_id,
            description: typeof s.description === 'string' ? s.description : undefined,
            item: s,
        })),
        { placeHolder: 'Select a space', ignoreFocusOut: true },
    );
    return picked?.item;
}

async function pickStack(ctx: CommandContext): Promise<StackItem | undefined> {
    const stacks = ctx.tree.getStacks();
    if (stacks.length === 0) {
        vscode.window.showInformationMessage('Knot: no stacks available.');
        return undefined;
    }
    const picked = await vscode.window.showQuickPick(
        stacks.map((s) => ({ label: s.stackName, description: s.description as string | undefined, item: s })),
        { placeHolder: 'Select a stack', ignoreFocusOut: true },
    );
    return picked?.item;
}
