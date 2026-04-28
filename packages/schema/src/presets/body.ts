// packages/schema/src/presets/body.ts
// Body-section extractor (best-effort H2 split). Splits a preset markdown body
// on `## ` headers and maps each canonical section to a string field. Unknown
// sections land in `body.unknown` for forward compatibility. Section content
// is preserved verbatim — no markdown rewriting. See T-304 §D-T304-4.
//
// Best-effort: deeper validation (typography weights, animation keyframes) is
// out of scope for T-304 and ships in downstream tasks.

/** Parsed body of a preset markdown file. */
export interface PresetBody {
  /** `## Visual tokens` section content (raw markdown, no header). */
  visualTokens: string;
  /** `## Typography` section content. */
  typography: string;
  /** `## Animation` section content. */
  animation: string;
  /** `## Rules` section content. */
  rules: string;
  /** `## Acceptance (parity)` / `## Acceptance` section content. */
  acceptance: string;
  /** `## References` section content. */
  references: string;
  /**
   * Forward-compat bucket: any H2 section the schema doesn't recognize lands
   * here keyed by the original header text (without the `## ` prefix).
   */
  unknown: Record<string, string>;
}

/** Map of canonical lower-cased headings to the PresetBody field. */
const CANONICAL_HEADERS: ReadonlyMap<string, keyof Omit<PresetBody, 'unknown'>> = new Map([
  ['visual tokens', 'visualTokens'],
  ['typography', 'typography'],
  ['animation', 'animation'],
  ['rules', 'rules'],
  ['acceptance', 'acceptance'],
  ['acceptance (parity)', 'acceptance'],
  ['references', 'references'],
]);

/**
 * Split a preset markdown body into its canonical sections.
 *
 * - Sections are demarcated by H2 lines (two-hash headers). H1 at the top is
 *   the document title and is ignored.
 * - Section order in the source is irrelevant — output shape is structural.
 * - Missing canonical sections leave the corresponding field as the empty
 *   string, never undefined; downstream consumers check `.length === 0`.
 * - Unknown H2 headers (e.g. "Notes") accumulate in `body.unknown` keyed by
 *   the trimmed original header text.
 * - Sections preceding the first H2 are discarded — they never carry preset
 *   content per the spec.
 */
export function extractPresetBody(rawBody: string): PresetBody {
  const result: PresetBody = {
    visualTokens: '',
    typography: '',
    animation: '',
    rules: '',
    acceptance: '',
    references: '',
    unknown: {},
  };

  const lines = rawBody.split('\n');
  let currentHeader: string | null = null;
  let currentBuffer: string[] = [];

  const flush = (): void => {
    if (currentHeader === null) {
      return;
    }
    const content = currentBuffer.join('\n').replace(/^\n+|\n+$/g, '');
    const canonical = CANONICAL_HEADERS.get(currentHeader.toLowerCase());
    if (canonical) {
      result[canonical] = content;
    } else {
      result.unknown[currentHeader] = content;
    }
  };

  for (const line of lines) {
    // Match H2 only (two leading hashes followed by space). Skip H3+.
    const h2Match = /^##[ \t]+(.+?)\s*$/.exec(line);
    if (h2Match && !line.startsWith('### ')) {
      flush();
      currentHeader = h2Match[1] ?? '';
      currentBuffer = [];
      continue;
    }
    if (currentHeader !== null) {
      currentBuffer.push(line);
    }
  }
  flush();

  return result;
}
