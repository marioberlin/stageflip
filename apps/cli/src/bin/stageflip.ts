#!/usr/bin/env node
// apps/cli/src/bin/stageflip.ts
// T-225 — executable entry. Wraps every entry in CLI_COMMAND_REGISTRY
// as a commander subcommand. Command names with spaces (e.g.
// "plugin install") become nested commander groups.

import { Command } from 'commander';

import { CLI_COMMAND_REGISTRY } from '../registry.js';
import type { CliCommand, CliEnv, CliRunContext } from '../types.js';

function defaultEnv(): CliEnv {
  return {
    cwd: process.cwd(),
    env: process.env,
    log: (line) => {
      process.stdout.write(`${line}\n`);
    },
    error: (line) => {
      process.stderr.write(`${line}\n`);
    },
    exit: (code) => {
      process.exit(code);
    },
  };
}

export function buildProgram(env: CliEnv = defaultEnv(), registry = CLI_COMMAND_REGISTRY): Command {
  const program = new Command(registry.binaryName);
  program.description('StageFlip CLI — motion platform (slides, video, display).');

  for (const entry of registry.commands) {
    wireCommand(program, entry, env);
  }

  return program;
}

function wireCommand(root: Command, entry: CliCommand, env: CliEnv): void {
  const segments = entry.name.split(' ');
  let parent = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const piece = segments[i] as string;
    const existing = parent.commands.find((c) => c.name() === piece);
    parent = existing ?? parent.command(piece).description(`${piece} subcommands`);
  }
  const leaf = segments[segments.length - 1] as string;
  const usage = [leaf, ...entry.args.map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`))].join(
    ' ',
  );
  const sub = parent.command(usage).description(entry.summary);
  for (const flag of entry.flags) {
    const value = flag.valueType !== undefined ? ` <${flag.valueType}>` : '';
    const def = flag.default !== undefined ? ` (default: ${flag.default})` : '';
    sub.option(`${flag.name}${value}`, `${flag.description}${def}`);
  }
  sub.action(async (...rawArgs: unknown[]) => {
    // Commander invokes action(...positionals, opts, cmd). Pop cmd + opts.
    const cmd = rawArgs[rawArgs.length - 1] as Command;
    const opts = rawArgs[rawArgs.length - 2] as Record<string, string | boolean | undefined>;
    const positionals = rawArgs.slice(0, rawArgs.length - 2) as unknown[];
    const ctx: CliRunContext = {
      env,
      args: positionals.map((p) => (typeof p === 'string' ? p : '')).filter((s) => s.length > 0),
      flags: opts,
    };
    try {
      const code = await entry.run(ctx);
      env.exit(code);
    } catch (err) {
      env.error(`${entry.name} failed: ${err instanceof Error ? err.message : String(err)}`);
      env.exit(1);
    }
    // reference cmd to keep linter happy
    void cmd;
  });
}

// Only run the CLI when invoked directly (not imported for tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  buildProgram().parseAsync(process.argv);
}
