// apps/cli/src/commands/render.ts
// T-225 — `stageflip render <name>` / `export <name>`. The real engine
// wire-up (export-html5-zip / export-video / export-pptx / etc.) is
// in the respective @stageflip/export-* packages; this command routes
// a user-supplied document + format to the right exporter. For now
// the command reports what it would dispatch — the full runtime hookup
// lands with apps/api T-229 + the CLI-to-API glue.

import type { CliRunContext } from '../types.js';

const SUPPORTED_FORMATS = new Set(['html5-zip', 'mp4', 'mov', 'pptx', 'pdf', 'marp', 'png', 'gif']);

export async function runRender(ctx: CliRunContext): Promise<number> {
  const [name] = ctx.args;
  if (!name) {
    ctx.env.error('render: missing document name');
    return 1;
  }
  const format = String(ctx.flags.format ?? '');
  if (!format) {
    ctx.env.error('render: --format is required');
    return 1;
  }
  if (!SUPPORTED_FORMATS.has(format)) {
    ctx.env.error(
      `render: unsupported format "${format}". Supported: ${[...SUPPORTED_FORMATS].sort().join(', ')}`,
    );
    return 1;
  }
  const out = String(ctx.flags.out ?? `./${name}/${name}.${formatExtension(format)}`);
  ctx.env.log(`render: queued document "${name}" → ${format} → ${out}`);
  if (typeof ctx.flags.bounce === 'string') {
    ctx.env.log(`render: multi-aspect bounce via [${ctx.flags.bounce}]`);
  }
  if (typeof ctx.flags.sizes === 'string') {
    ctx.env.log(`render: multi-size display via [${ctx.flags.sizes}]`);
  }
  // Actual dispatch to @stageflip/export-* wired in a follow-up to T-229.
  ctx.env.log('render: (api bridge pending — T-229)');
  return 0;
}

function formatExtension(format: string): string {
  switch (format) {
    case 'html5-zip':
      return 'zip';
    case 'mp4':
    case 'mov':
    case 'pptx':
    case 'pdf':
    case 'png':
    case 'gif':
      return format;
    case 'marp':
      return 'md';
    default:
      return 'out';
  }
}
