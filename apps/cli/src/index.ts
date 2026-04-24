// apps/cli/src/index.ts
// @stageflip/cli — library-style exports. The executable shim
// is at src/bin/stageflip.ts. T-226 imports the registry from here
// to generate `skills/stageflip/reference/cli/SKILL.md`.

export {
  CLI_COMMAND_REGISTRY,
  commandRegistryAsCliReferencePkg,
} from './registry.js';
export { createAuthCommands } from './commands/auth.js';
export { runDoctor } from './commands/doctor.js';
export { runPluginInstall } from './commands/plugin-install.js';
export { runRender } from './commands/render.js';
export { createStubRunner } from './commands/stubs.js';
export type {
  CliCommand,
  CliCommandRegistry,
  CliCommandStatus,
  CliEnv,
  CliRunContext,
} from './types.js';
