import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

/**
 * SSH config management that mirrors the knot CLI's `knot ssh-config` block
 * convention: each alias group lives between `#===KNOT-START (alias)===` and
 * `#===KNOT-END (alias)===` markers directly inside ~/.ssh/config.
 *
 * The extension uses its own alias namespace (`KNOT_VSCODE_<tag>`, one per
 * server) so its blocks coexist with the CLI's default/user alias blocks and
 * are never touched by `knot ssh-config update`.
 */

export function sshConfigPath(): string {
    return path.join(os.homedir(), '.ssh', 'config');
}

/** The alias a server's hosts are grouped under. */
export function aliasForServer(serverId: string): string {
    return `KNOT_VSCODE_${serverId.slice(0, 8)}`;
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function markers(alias: string): { start: string; end: string } {
    return { start: `#===KNOT-START (${alias})===`, end: `#===KNOT-END (${alias})===` };
}

interface HostBlock {
    host: string;
    lines: string[];
}

/** Parse `Host x` + indented option lines out of a block body. */
function parseHostBlocks(body: string): HostBlock[] {
    const blocks: HostBlock[] = [];
    let current: HostBlock | null = null;
    for (const line of body.split('\n')) {
        const m = line.match(/^\s*Host\s+(\S+)\s*$/);
        if (m) {
            if (current) {
                blocks.push(current);
            }
            current = { host: m[1], lines: [line.trim()] };
        } else if (current && line.trim() !== '' && !line.trim().startsWith('#')) {
            current.lines.push(line);
        }
    }
    if (current) {
        blocks.push(current);
    }
    return blocks;
}

function renderHostBlock(b: HostBlock): string {
    return b.lines.join('\n');
}

/**
 * Write the config file, preserving any existing file mode (the `mode` option
 * only applies when creating a new file, defaulting it to 0600).
 */
function writeConfig(cfgPath: string, content: string): void {
    fs.writeFileSync(cfgPath, content, { mode: 0o600 });
}

function readConfig(cfgPath: string): string {
    try {
        return fs.readFileSync(cfgPath, 'utf8');
    } catch {
        return '';
    }
}

export interface SshHostEntry {
    host: string;
    proxyCommand: string;
    comment?: string;
}

/**
 * Upsert a host into the given server alias's block in ~/.ssh/config, creating
 * the block (and file) if needed. Other hosts in the block are preserved.
 */
export function upsertKnotHost(alias: string, entry: SshHostEntry): void {
    const cfgPath = sshConfigPath();
    fs.mkdirSync(path.dirname(cfgPath), { recursive: true });

    let content = readConfig(cfgPath);
    const { start, end } = markers(alias);
    const blockRe = new RegExp(escapeRegex(start) + '[\\s\\S]*?' + escapeRegex(end) + '\\n?', 'g');

    let blocks: HostBlock[] = [];
    const existing = content.match(blockRe);
    if (existing) {
        const inner = existing[0]
            .replace(new RegExp('^' + escapeRegex(start) + '\\n'), '')
            .replace(new RegExp('\\n?' + escapeRegex(end) + '\\n?$'), '');
        blocks = parseHostBlocks(inner);
    }

    const newLines = [
        `Host ${entry.host}`,
        `  HostName ${entry.host}`,
        `  StrictHostKeyChecking no`,
        `  UserKnownHostsFile /dev/null`,
        `  LogLevel ERROR`,
        `  ProxyCommand ${entry.proxyCommand}`,
    ];
    if (entry.comment) {
        newLines.unshift(`# ${entry.comment}`);
    }
    const replacement: HostBlock = { host: entry.host, lines: newLines };
    const idx = blocks.findIndex((b) => b.host === entry.host);
    if (idx >= 0) {
        blocks[idx] = replacement;
    } else {
        blocks.push(replacement);
    }

    content = content.replace(blockRe, '');
    if (content.length && !content.endsWith('\n')) {
        content += '\n';
    }
    content += renderAliasBlock(alias, blocks);
    writeConfig(cfgPath, content);
}

/**
 * Remove a single host from the alias block. If no hosts remain, the whole
 * block is removed.
 */
export function removeKnotHost(alias: string, host: string): void {
    const cfgPath = sshConfigPath();
    let content = readConfig(cfgPath);
    if (!content) {
        return;
    }
    const { start, end } = markers(alias);
    const blockRe = new RegExp(escapeRegex(start) + '[\\s\\S]*?' + escapeRegex(end) + '\\n?', 'g');
    const existing = content.match(blockRe);
    if (!existing) {
        return;
    }

    const inner = existing[0]
        .replace(new RegExp('^' + escapeRegex(start) + '\\n'), '')
        .replace(new RegExp('\\n?' + escapeRegex(end) + '\\n?$'), '');
    const blocks = parseHostBlocks(inner).filter((b) => b.host !== host);

    content = content.replace(blockRe, '');
    if (blocks.length > 0) {
        if (content.length && !content.endsWith('\n')) {
            content += '\n';
        }
        content += renderAliasBlock(alias, blocks);
    }
    writeConfig(cfgPath, content);
}

/** Remove the entire managed alias block for a server. */
export function removeKnotAliasBlock(alias: string): void {
    const cfgPath = sshConfigPath();
    const content = readConfig(cfgPath);
    if (!content) {
        return;
    }
    const { start, end } = markers(alias);
    const blockRe = new RegExp(escapeRegex(start) + '[\\s\\S]*?' + escapeRegex(end) + '\\n?', 'g');
    const next = content.replace(blockRe, '');
    if (next === content) {
        return;
    }
    writeConfig(cfgPath, next);
}

function renderAliasBlock(alias: string, blocks: HostBlock[]): string {
    const { start, end } = markers(alias);
    const body = blocks.map(renderHostBlock).join('\n\n');
    return `${start}\n${body}\n${end}\n`;
}
