// apps/cli/src/types.ts
// T-225 — shared types: the CliEnv (IO + fs + network seams) and
// the CliCommand registry entry. Tests inject a mock env so no
// stdout / filesystem / network is touched.

import type { CliCommandArg, CliCommandFlag } from '@stageflip/skills-sync';

export interface CliEnv {
  /** Current working directory. */
  readonly cwd: string;
  /** Process env snapshot. */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Capture-point for stdout; tests stub to collect. */
  log(line: string): void;
  /** Capture-point for stderr. */
  error(line: string): void;
  /** Abstraction over `process.exit`. */
  exit(code: number): never;
}

export interface CliRunContext {
  readonly env: CliEnv;
  /** Positional args in manual-spec order. */
  readonly args: readonly string[];
  /** Parsed flags. Values are strings or booleans per commander. */
  readonly flags: Readonly<Record<string, string | boolean | undefined>>;
}

export type CliCommandStatus = 'shipped' | 'stub';

export interface CliCommand {
  readonly name: string;
  readonly summary: string;
  readonly args: readonly CliCommandArg[];
  readonly flags: readonly CliCommandFlag[];
  readonly status: CliCommandStatus;
  run(ctx: CliRunContext): Promise<number> | number;
}

export interface CliCommandRegistry {
  readonly binaryName: string;
  readonly commands: readonly CliCommand[];
}
