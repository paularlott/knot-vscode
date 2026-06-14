import * as vscode from 'vscode';
import { KnotHttpError } from './api/client';
import type { SpaceRequest, Template } from './api/types';
import { describeError, getServerUrl, Session } from './session';
import { SpaceItem, SpacesTreeProvider, StackItem } from './provider/spacesTreeProvider';
import { createKnotTerminal } from './terminal/knotTerminal';

function requireClient(session: Session) {
    const client = session.client;
    if (!client) {
        throw new Error('Not connected. Run "Knot: Connect to Server".');
    }
    return client;
}

function defaultShell(): string {
    const shell = vscode.workspace.getConfiguration('knot').get<string>('terminalShell', '');
    return shell || 'bash';
}

export interface CommandContext {
    session: Session;
    tree: SpacesTreeProvider;
    reload: () => Promise<void>;
}

export function registerCommands(ctx: CommandContext): vscode.Disposable[] {
    const subs: vscode.Disposable[] = [];

    subs.push(
        vscode.commands.registerCommand('knot.login', () => cmdLogin(ctx)),
        vscode.commands.registerCommand('knot.logout', () => cmdLogout(ctx)),
        vscode.commands.registerCommand('knot.refresh', () => cmdRefresh(ctx)),
        vscode.commands.registerCommand('knot.createSpace', () => cmdCreateSpace(ctx)),
        vscode.commands.registerCommand('knot.deleteSpace', (item?: SpaceItem) => cmdDeleteSpace(ctx, item)),
        vscode.commands.registerCommand('knot.startSpace', (item?: SpaceItem) => cmdLifecycle(ctx, item, 'start')),
        vscode.commands.registerCommand('knot.stopSpace', (item?: SpaceItem) => cmdLifecycle(ctx, item, 'stop')),
        vscode.commands.registerCommand('knot.restartSpace', (item?: SpaceItem) => cmdLifecycle(ctx, item, 'restart')),
        vscode.commands.registerCommand('knot.startStack', (item?: StackItem) => cmdStackLifecycle(ctx, item, 'start')),
        vscode.commands.registerCommand('knot.stopStack', (item?: StackItem) => cmdStackLifecycle(ctx, item, 'stop')),
        vscode.commands.registerCommand('knot.restartStack', (item?: StackItem) => cmdStackLifecycle(ctx, item, 'restart')),
        vscode.commands.registerCommand('knot.openTerminal', (item?: SpaceItem) => cmdOpenTerminal(ctx, item)),
        vscode.commands.registerCommand('knot.runCommand', (item?: SpaceItem) => cmdRunCommand(ctx, item)),
        vscode.commands.registerCommand('knot.openCodeServer', (item?: SpaceItem) => cmdOpenUrl(ctx, item, 'code-server')),
        vscode.commands.registerCommand('knot.openInBrowser', (item?: SpaceItem) => cmdOpenUrl(ctx, item, 'space')),
    );

    return subs;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function cmdLogin(ctx: CommandContext): Promise<void> {
    const { session, tree } = ctx;
    const cfgUrl = getServerUrl();
    const url = await vscode.window.showInputBox({
        prompt: 'Knot server URL',
        value: cfgUrl || 'https://',
        placeHolder: 'https://knot.example.com',
        ignoreFocusOut: true,
        validateInput: (v) => (v && /^https?:\/\//.test(v) ? undefined : 'Enter a full http(s):// URL'),
    });
    if (!url) {
        return;
    }

    const cleanUrl = url.replace(/\/+$/, '');
    await vscode.workspace.getConfiguration('knot').update('serverUrl', cleanUrl, vscode.ConfigurationTarget.Global);

    const token = await vscode.window.showInputBox({
        prompt: 'API token (Bearer)',
        password: true,
        placeHolder: 'Paste the token from the Knot web UI or "knot admin"',
        ignoreFocusOut: true,
        validateInput: (v) => (v && v.length > 0 ? undefined : 'Token required'),
    });
    if (!token) {
        return;
    }

    try {
        const user = await session.connect(token);
        vscode.window.showInformationMessage(`Knot: connected as ${user.username}.`);
        await cmdRefresh(ctx);
    } catch (err) {
        vscode.window.showErrorMessage(`Knot: ${describeError(err)}`);
    }
}

async function cmdLogout({ session, tree }: CommandContext): Promise<void> {
    await session.disconnect();
    tree.setSpaces([]);
    vscode.window.showInformationMessage('Knot: disconnected.');
}

// ---------------------------------------------------------------------------
// Tree refresh
// ---------------------------------------------------------------------------

async function cmdRefresh({ session, tree }: CommandContext): Promise<void> {
    const client = session.client;
    if (!client) {
        tree.setSpaces([]);
        return;
    }
    tree.setLoading(true);
    try {
        const list = await client.listSpaces();
        tree.setSpaces(list.spaces ?? []);
    } catch (err) {
        tree.setSpaces([]);
        if (err instanceof KnotHttpError && (err.status === 401 || err.status === 403)) {
            vscode.window.showWarningMessage('Knot: token rejected. Please reconnect.');
        } else {
            vscode.window.showErrorMessage(`Knot: ${describeError(err)}`);
        }
    }
}

// ---------------------------------------------------------------------------
// Create / delete
// ---------------------------------------------------------------------------

async function cmdCreateSpace({ session, reload }: CommandContext): Promise<void> {
    const client = requireClient(session);

    let templates: Template[] = [];
    try {
        const list = await client.listTemplates();
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

    const description = await vscode.window.showInputBox({
        prompt: 'Description (optional)',
        ignoreFocusOut: true,
    });

    const req: SpaceRequest = {
        name,
        template_id: template.template.template_id,
        description: description || '',
    };

    // Create inside a progress notification; it closes as soon as the call
    // resolves (so it can never get stuck). Ask the follow-up question after.
    let createdId: string | undefined;
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Knot: creating "${name}"` },
        async () => {
            try {
                createdId = await client.createSpace(req);
            } catch (err) {
                vscode.window.showErrorMessage(`Knot: create failed: ${describeError(err)}`);
            }
        },
    );

    if (!createdId) {
        return;
    }
    await reload();

    const start = await vscode.window.showInformationMessage(
        `Knot: created "${name}". Start it now?`,
        'Start',
        'Not now',
    );
    if (start === 'Start') {
        await client.startSpace(createdId);
        await reload();
        for (const delay of [2000, 5000, 9000]) {
            setTimeout(() => void reload(), delay);
        }
    }
}

async function cmdDeleteSpace(ctx: CommandContext, item?: SpaceItem): Promise<void> {
    const space = item ?? (await pickSpace(ctx));
    if (!space) {
        return;
    }
    const client = requireClient(ctx.session);
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
                await client.deleteSpace(space.space.space_id);
                await ctx.reload();
            } catch (err) {
                vscode.window.showErrorMessage(`Knot: ${describeError(err)}`);
            }
        },
    );
}

// ---------------------------------------------------------------------------
// Lifecycle
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
    const client = requireClient(ctx.session);
    const name = space.space.name || space.space.space_id;
    const verb = action === 'start' ? 'Starting' : action === 'stop' ? 'Stopping' : 'Restarting';
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Knot: ${verb} "${name}"` },
        async () => {
            try {
                await client[`${action}Space`](space.space.space_id);
                await ctx.reload();
                // The server accepts the state change before it completes, so
                // burst-poll to animate through the transition.
                for (const delay of [2000, 5000, 9000]) {
                    setTimeout(() => void ctx.reload(), delay);
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
    const client = requireClient(ctx.session);
    const verb = action === 'start' ? 'Starting' : action === 'stop' ? 'Stopping' : 'Restarting';
    // Stack actions are synchronous on the server and can take a while.
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Knot: ${verb} stack "${stack.stackName}"` },
        async () => {
            try {
                await client[`${action}Stack`](stack.stackName);
                await ctx.reload();
                for (const delay of [3000, 8000, 15000, 25000]) {
                    setTimeout(() => void ctx.reload(), delay);
                }
            } catch (err) {
                vscode.window.showErrorMessage(`Knot: ${describeError(err)}`);
            }
        },
    );
}

// ---------------------------------------------------------------------------
// Terminal / run command / open URLs
// ---------------------------------------------------------------------------

async function cmdOpenTerminal(ctx: CommandContext, item?: SpaceItem): Promise<void> {
    const space = item ?? (await pickSpace(ctx));
    if (!space) {
        return;
    }
    const client = requireClient(ctx.session);
    if (!space.space.has_terminal) {
        vscode.window.showWarningMessage(`Knot: "${space.space.name}" has no terminal available (start the space).`);
        return;
    }
    const token = ctx.session.token;
    if (!token) {
        vscode.window.showErrorMessage('Knot: no token available for terminal.');
        return;
    }
    try {
        const def = await client.getSpace(space.space.space_id);
        const shell = def.shell || defaultShell();
        const term = createKnotTerminal({
            baseUrl: client.baseUrl,
            token,
            insecureSkipVerify: vscode.workspace.getConfiguration('knot').get<boolean>('insecureSkipVerify', false),
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
    const client = requireClient(ctx.session);
    const command = await vscode.window.showInputBox({
        prompt: `Run command in "${space.space.name}"`,
        placeHolder: 'e.g. make test',
        ignoreFocusOut: true,
    });
    if (!command) {
        return;
    }
    const parts = command.trim().split(/\s+/);
    const [cmd, ...args] = parts;

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Knot: running "${command}"` },
        async () => {
            try {
                const res = await client.runCommand(space.space.space_id, { command: cmd, args });
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
    const base = clientBaseUrl(ctx);
    if (!base) {
        return;
    }
    const id = space.space.space_id;
    let url: string;
    if (kind === 'code-server') {
        url = `${base}/proxy/spaces/${id}/code-server/`;
    } else {
        url = `${base}/space/${id}`;
    }
    void vscode.env.openExternal(vscode.Uri.parse(url));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clientBaseUrl(ctx: CommandContext): string | undefined {
    const client = ctx.session.client;
    if (!client) {
        vscode.window.showErrorMessage('Knot: not connected.');
        return undefined;
    }
    return client.baseUrl;
}

async function pickSpace(ctx: CommandContext): Promise<SpaceItem | undefined> {
    const client = requireClient(ctx.session);
    let spaces = ctx.tree.getSpaces();
    if (spaces.length === 0) {
        try {
            const list = await client.listSpaces();
            ctx.tree.setSpaces(list.spaces ?? []);
        } catch {
            // fall through
        }
        spaces = ctx.tree.getSpaces();
    }
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
