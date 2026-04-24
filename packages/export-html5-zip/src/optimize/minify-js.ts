// packages/export-html5-zip/src/optimize/minify-js.ts
// Minify inline `<script>` blocks via terser (BSD-2-Clause).
//
// External <script src=...> tags are skipped: the IAB budget forbids
// runtime fetches, so external-src scripts shouldn't exist in an export.
// If one does, we leave it untouched — trimming it silently would be a
// behaviour change the export target can't make safely.

import { type MinifyOptions, minify } from 'terser';

const SCRIPT_OPEN_RE = /<script\b([^>]*)>/gi;
const SCRIPT_CLOSE = '</script>';

/** Default compression settings tuned for display-ad JS. */
export const DEFAULT_MINIFY_OPTIONS: MinifyOptions = {
  compress: {
    booleans: true,
    drop_console: false, // leave intact for QA; T-208 validator checks compliance
    drop_debugger: true,
    passes: 2,
    unused: true,
  },
  mangle: true,
  format: {
    comments: false,
  },
  // Keep output deterministic — identical input → identical output.
  sourceMap: false,
};

function hasSrcAttr(attrSlice: string): boolean {
  return /\bsrc\s*=/.test(attrSlice);
}

/**
 * Minify every inline `<script>` in the HTML. External-src scripts and
 * scripts with unknown `type` attributes (e.g. `type="application/json"`)
 * are left untouched.
 */
export async function minifyInlineJsInHtml(
  html: string,
  opts: MinifyOptions = DEFAULT_MINIFY_OPTIONS,
): Promise<string> {
  // Collect every match first so we can await minification without mutating
  // the source mid-iteration.
  const matches: Array<{ openStart: number; openEnd: number; attrs: string }> = [];
  for (const match of html.matchAll(SCRIPT_OPEN_RE)) {
    const openStart = match.index ?? -1;
    if (openStart < 0) continue;
    matches.push({
      openStart,
      openEnd: openStart + match[0].length,
      attrs: match[1] ?? '',
    });
  }

  if (matches.length === 0) return html;

  const replacements: Array<{
    openStart: number;
    closeEnd: number;
    replacement: string;
  }> = [];

  for (const m of matches) {
    if (hasSrcAttr(m.attrs)) continue;
    // Skip non-JS scripts (JSON-LD, module-maps, etc.).
    const typeMatch = m.attrs.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const scriptType = (typeMatch?.[1] ?? typeMatch?.[2] ?? '').toLowerCase();
    const isJs =
      scriptType === '' ||
      scriptType === 'text/javascript' ||
      scriptType === 'application/javascript' ||
      scriptType === 'module';
    if (!isJs) continue;

    const closeIdx = html.indexOf(SCRIPT_CLOSE, m.openEnd);
    if (closeIdx < 0) continue;
    const closeEnd = closeIdx + SCRIPT_CLOSE.length;
    const code = html.slice(m.openEnd, closeIdx);
    if (code.trim().length === 0) continue;

    let minified: string;
    try {
      const result = await minify(code, opts);
      if (result.code === undefined || result.code.length === 0) continue;
      minified = result.code;
    } catch {
      // Never drop a script we can't minify — keep the original so the
      // banner still runs even if terser rejects syntax (e.g. modern
      // features the configured ecma level excludes).
      continue;
    }

    const replacement = `<script${m.attrs}>${minified}${SCRIPT_CLOSE}`;
    replacements.push({ openStart: m.openStart, closeEnd, replacement });
  }

  if (replacements.length === 0) return html;

  // Apply replacements back-to-front so earlier offsets stay valid.
  replacements.sort((a, b) => b.openStart - a.openStart);
  let out = html;
  for (const r of replacements) {
    out = out.slice(0, r.openStart) + r.replacement + out.slice(r.closeEnd);
  }
  return out;
}
