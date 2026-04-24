// packages/skills-sync/src/cli-reference-gen.ts
// Generator for skills/stageflip/reference/cli/SKILL.md (T-220).
// Takes a `CliReferencePkg` — a structural description of the CLI's
// command registry — and emits deterministic markdown. The generator
// lands in T-220 so every other Phase-10 task has the helper ready;
// actual invocation against the real `apps/cli` registry happens in
// T-225 (registry wire-up) and T-226 (sync wiring + skill emission).

/** A single positional argument on a command. */
export interface CliCommandArg {
  /** Positional name (no angle brackets; renderer adds them). */
  readonly name: string;
  /** Required positional if true; optional if false. */
  readonly required: boolean;
  readonly description: string;
}

/** A single flag (`--name`) on a command. */
export interface CliCommandFlag {
  /** Full flag with leading dashes (e.g. `--format`). */
  readonly name: string;
  readonly description: string;
  /**
   * Optional value-type indicator (`string`, `number`, `boolean`,
   * enum list as `'a|b'`, etc.). Omit for boolean switches.
   */
  readonly valueType?: string;
  /** Optional default value rendered as plain text. */
  readonly default?: string;
}

export interface CliCommand {
  /** Command path relative to the binary (e.g. `render`, `plugin install`). */
  readonly name: string;
  readonly summary: string;
  readonly args: readonly CliCommandArg[];
  readonly flags: readonly CliCommandFlag[];
}

export interface CliReferencePkg {
  /** The CLI's binary name (e.g. `stageflip`). */
  readonly binaryName: string;
  /** Commands in the order they should render (usually registration order). */
  readonly commands: readonly CliCommand[];
}

const LAST_UPDATED = '2026-04-24';

/** Render the CLI reference SKILL.md. */
export function generateCliReferenceSkill(pkg: CliReferencePkg): string {
  const bin = pkg.binaryName;
  const commandCount = pkg.commands.length;

  const frontmatter = [
    '---',
    'title: Reference — CLI',
    'id: skills/stageflip/reference/cli',
    'tier: reference',
    'status: auto-generated',
    `last_updated: ${LAST_UPDATED}`,
    'owner_task: T-226',
    'related:',
    '  - skills/stageflip/reference/schema',
    '  - skills/stageflip/reference/validation-rules',
    '---',
    '',
  ].join('\n');

  const intro = [
    '# Reference — CLI',
    '',
    "**Auto-generated from `apps/cli`'s command registry** via",
    '`@stageflip/skills-sync`. Do NOT edit by hand — run',
    '`pnpm skills-sync` after adding or renaming a command;',
    '`pnpm skills-sync:check` fails in CI on drift.',
    '',
    `${commandCount} commands registered.`,
    '',
  ].join('\n');

  const commands = renderCommands(bin, pkg.commands);

  return [frontmatter, intro, '## Commands', '', commands].join('\n');
}

function renderCommands(bin: string, commands: readonly CliCommand[]): string {
  if (commands.length === 0) {
    return '_No commands registered yet._\n';
  }
  const out: string[] = [];
  for (const cmd of commands) {
    out.push(`### \`${bin} ${cmd.name}\``);
    out.push('');
    out.push(cmd.summary);
    out.push('');
    out.push('```');
    out.push(`${bin} ${cmd.name}${renderUsageTail(cmd)}`);
    out.push('```');
    out.push('');
    if (cmd.args.length > 0) {
      out.push('**Arguments**');
      out.push('');
      for (const a of cmd.args) {
        const tag = a.required ? '' : ' _(optional)_';
        out.push(`- \`<${a.name}>\`${tag} — ${a.description}`);
      }
      out.push('');
    }
    if (cmd.flags.length > 0) {
      out.push('**Flags**');
      out.push('');
      for (const f of cmd.flags) {
        const value = f.valueType !== undefined ? ` \`<${f.valueType}>\`` : '';
        const def = f.default !== undefined ? ` (default: \`${f.default}\`)` : '';
        out.push(`- \`${f.name}\`${value} — ${f.description}${def}`);
      }
      out.push('');
    }
  }
  return out.join('\n');
}

function renderUsageTail(cmd: CliCommand): string {
  const parts: string[] = [];
  for (const a of cmd.args) {
    parts.push(a.required ? `<${a.name}>` : `[${a.name}]`);
  }
  if (cmd.flags.length > 0) parts.push('[flags]');
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}
