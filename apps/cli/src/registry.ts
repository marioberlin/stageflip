// apps/cli/src/registry.ts
// T-225 — the CLI command registry. Single source of truth for
// every user-manual.md §4 command: shape for commander wiring,
// shape for the T-226 skill generator, shape for `stageflip --help`.

import type { CliReferencePkg } from '@stageflip/skills-sync';

import { createAuthCommands } from './commands/auth.js';
import { runDoctor } from './commands/doctor.js';
import { runPluginInstall } from './commands/plugin-install.js';
import { runRender } from './commands/render.js';
import { createStubRunner } from './commands/stubs.js';

import type { CliCommand, CliCommandRegistry } from './types.js';

const { runLogin, runLogout, runWhoami } = createAuthCommands();

export const CLI_COMMAND_REGISTRY: CliCommandRegistry = {
  binaryName: 'stageflip',
  commands: [
    // Documents
    cmd('new', 'Create a new document.', {
      args: [{ name: 'name', required: true, description: 'Document name.' }],
      flags: [
        { name: '--mode', description: 'slide | video | display.', valueType: 'string' },
        {
          name: '--aspect',
          description: 'Video aspect ratio (e.g. 16:9, 9:16).',
          valueType: 'string',
        },
        { name: '--size', description: 'Display banner size, e.g. 300x250.', valueType: 'string' },
        {
          name: '--duration',
          description: 'Duration in ms or suffixed (30s).',
          valueType: 'string',
        },
        {
          name: '--from-prompt',
          description: 'Seed from a natural-language prompt.',
          valueType: 'string',
        },
        { name: '--from-template', description: 'Seed from a template id.', valueType: 'string' },
        {
          name: '--from-pptx',
          description: 'Import a PPTX file as slide mode.',
          valueType: 'string',
        },
        {
          name: '--from-google-slides',
          description: 'Import via OAuth from a Slides URL.',
          valueType: 'string',
        },
      ],
      stub: 'T-229',
    }),
    cmd('list', 'List documents accessible to you.', {
      flags: [
        { name: '--mode', description: 'Filter by mode.', valueType: 'string' },
        { name: '--org', description: 'Filter by org.', valueType: 'string' },
      ],
      stub: 'T-229',
    }),
    cmd('info', 'Show doc metadata + loss flags + quality tier.', {
      args: [{ name: 'name', required: true, description: 'Document name.' }],
      stub: 'T-229',
    }),
    cmd('rename', 'Rename a document.', {
      args: [
        { name: 'name', required: true, description: 'Current name.' },
        { name: 'new-name', required: true, description: 'New name.' },
      ],
      stub: 'T-229',
    }),
    cmd('delete', 'Soft-delete a document (recoverable 30d).', {
      args: [{ name: 'name', required: true, description: 'Document name.' }],
      stub: 'T-229',
    }),

    // Editing
    cmd('preview', 'Open a document in the web editor.', {
      args: [{ name: 'name', required: true, description: 'Document name.' }],
      stub: 'T-229',
    }),
    cmd('export', 'Export a document to a target format (alias: render).', {
      args: [{ name: 'name', required: true, description: 'Document name.' }],
      flags: renderFlags(),
      run: runRender,
    }),
    cmd('render', 'Render a document to a target format.', {
      args: [{ name: 'name', required: true, description: 'Document name.' }],
      flags: renderFlags(),
      run: runRender,
    }),

    // Validation
    cmd('lint', 'Pre-render static validation.', {
      args: [{ name: 'name', required: true, description: 'Document name.' }],
      stub: 'T-229',
    }),
    cmd('validate', 'Parity + brand + accessibility; returns tier A/B/F.', {
      args: [{ name: 'name', required: true, description: 'Document name.' }],
      stub: 'T-229',
    }),
    cmd('loss-flags', 'What won’t round-trip through target format.', {
      args: [{ name: 'name', required: true, description: 'Document name.' }],
      flags: [{ name: '--target', description: 'Target format.', valueType: 'string' }],
      stub: 'T-229',
    }),

    // Templates + themes
    cmd('theme list', 'List available themes.', { stub: 'T-229' }),
    cmd('theme learn', 'Run 8-step theme-learning pipeline on a source.', {
      args: [{ name: 'source-path', required: true, description: 'Source to learn from.' }],
      stub: 'T-249',
    }),
    cmd('template save', 'Save the current doc as a template.', {
      args: [{ name: 'name', required: true, description: 'Template name.' }],
      flags: [{ name: '--public', description: 'Make the template public.' }],
      stub: 'T-229',
    }),
    cmd('template use', 'Instantiate a template.', {
      args: [{ name: 'template-id', required: true, description: 'Template id.' }],
      stub: 'T-229',
    }),

    // Bulk / parametric
    cmd('bulk-render', 'Render a variant per CSV row.', {
      args: [
        { name: 'template-id', required: true, description: 'Template id.' },
        { name: 'csv', required: true, description: 'CSV file path.' },
      ],
      flags: [
        { name: '--out-dir', description: 'Output directory.', valueType: 'string' },
        {
          name: '--concurrency',
          description: 'Max parallel renders.',
          valueType: 'number',
          default: '4',
        },
      ],
      stub: 'T-229',
    }),
    cmd('variables list', 'List variables bound to a document.', {
      args: [{ name: 'name', required: true, description: 'Document name.' }],
      stub: 'T-229',
    }),
    cmd('variables set', 'Set a variable value.', {
      args: [
        { name: 'name', required: true, description: 'Document name.' },
        { name: 'assignment', required: true, description: 'key=value.' },
      ],
      stub: 'T-229',
    }),

    // Import / export
    cmd('import', 'Auto-detect import (pptx, gslides, html, lottie, afx).', {
      args: [{ name: 'file', required: true, description: 'Path or URL.' }],
      stub: 'T-240',
    }),
    cmd('export-schema', 'Dump canonical document JSON to stdout.', {
      args: [{ name: 'name', required: true, description: 'Document name.' }],
      stub: 'T-229',
    }),

    // Account + config
    cmd('login', 'Open OAuth flow + persist session JWT locally.', {
      flags: [
        { name: '--org', description: 'Target org (optional).', valueType: 'string' },
        {
          name: '--profile',
          description: 'Token-store profile name.',
          valueType: 'string',
          default: 'default',
        },
      ],
      run: runLogin,
    }),
    cmd('logout', 'Clear the local token store.', {
      run: runLogout,
    }),
    cmd('whoami', 'Print the logged-in principal.', {
      run: runWhoami,
    }),
    cmd('doctor', 'Environment diagnostics.', {
      run: runDoctor,
    }),
    cmd('config get', 'Read a config value.', {
      args: [{ name: 'key', required: true, description: 'Config key.' }],
      stub: 'T-229',
    }),
    cmd('config set', 'Write a config value.', {
      args: [{ name: 'assignment', required: true, description: 'key=value.' }],
      stub: 'T-229',
    }),
    cmd('api-key create', 'Mint a new API key.', {
      flags: [{ name: '--scope', description: 'Role / scope for the key.', valueType: 'string' }],
      stub: 'T-229',
    }),

    // Skills
    cmd('skills list', 'List installed skill files.', { stub: 'T-228' }),
    cmd('skills search', 'Full-text search the skill tree.', {
      args: [{ name: 'query', required: true, description: 'Search term.' }],
      stub: 'T-228',
    }),
    cmd('skills open', 'Print a skill body.', {
      args: [{ name: 'name', required: true, description: 'Skill path.' }],
      stub: 'T-228',
    }),

    // Plugin (T-224 wiring)
    cmd('plugin install', 'Bundle the skills tree + MCP config into a Claude plugin.', {
      args: [
        {
          name: 'destination',
          required: false,
          description: 'Output directory (default ./stageflip-plugin).',
        },
      ],
      run: runPluginInstall,
    }),

    // Developer
    cmd('parity run', 'Run the parity harness locally.', {
      args: [{ name: 'fixture', required: false, description: 'Fixture name (optional).' }],
      stub: 'T-229',
    }),
    cmd('parity update-expected', 'Re-bake reference frames for a fixture.', {
      args: [{ name: 'fixture', required: true, description: 'Fixture name.' }],
      stub: 'T-229',
    }),
    cmd('runtimes list', 'List registered runtimes.', { stub: 'T-228' }),
    cmd('clips list', 'List registered clips.', {
      flags: [
        { name: '--runtime', description: 'Filter by runtime id.', valueType: 'string' },
        { name: '--mode', description: 'Filter by mode.', valueType: 'string' },
      ],
      stub: 'T-228',
    }),
  ],
};

export function commandRegistryAsCliReferencePkg(): CliReferencePkg {
  return {
    binaryName: CLI_COMMAND_REGISTRY.binaryName,
    commands: CLI_COMMAND_REGISTRY.commands.map((c) => ({
      name: c.name,
      summary: c.summary,
      args: c.args,
      flags: c.flags,
    })),
  };
}

function renderFlags() {
  return [
    { name: '--format', description: 'Target export format.', valueType: 'string' },
    { name: '--codec', description: 'Codec for video formats.', valueType: 'string' },
    { name: '--crf', description: 'Constant rate factor (video).', valueType: 'number' },
    {
      name: '--bounce',
      description: 'Multi-aspect-ratio render (comma-separated).',
      valueType: 'string',
    },
    {
      name: '--sizes',
      description: 'Multi-size display render (comma-separated).',
      valueType: 'string',
    },
    { name: '--out', description: 'Output path.', valueType: 'string' },
  ];
}

function cmd(
  name: string,
  summary: string,
  options: {
    args?: CliCommand['args'];
    flags?: CliCommand['flags'];
    run?: CliCommand['run'];
    stub?: string;
  },
): CliCommand {
  const args = options.args ?? [];
  const flags = options.flags ?? [];
  if (options.run) {
    return { name, summary, args, flags, status: 'shipped', run: options.run };
  }
  return {
    name,
    summary,
    args,
    flags,
    status: 'stub',
    run: createStubRunner(name, options.stub),
  };
}
