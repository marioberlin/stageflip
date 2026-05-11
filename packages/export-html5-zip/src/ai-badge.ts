// packages/export-html5-zip/src/ai-badge.ts
// T-439 — visible "AI" badge HTML generation + idempotent injection into the
// banner's <body>. Per FTC + EU AI Act human-disclosure requirements
// (see docs/tasks/T-439.md "Regulatory references").
//
// Pure functions; no I/O; no `Date.now()` / `Math.random()` (deterministic).

/** Tenant-configurable badge appearance. */
export interface AiDisclosureBadgeConfig {
  /** Badge text. Default `'AI'`. Set to `''` to disable visible badge. */
  text: string;
  /** Corner position. Default `'top-right'`. */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** CSS color. Default `'#fff'`. */
  color: string;
  /** CSS background color. Default `'rgba(0, 0, 0, 0.55)'` (semi-transparent). */
  background: string;
  /** Font size in px. Default `10`. */
  fontSize: number;
}

/** Defaults per docs/tasks/T-439.md. */
export const DEFAULT_AI_BADGE: AiDisclosureBadgeConfig = {
  text: 'AI',
  position: 'top-right',
  color: '#fff',
  background: 'rgba(0, 0, 0, 0.55)',
  fontSize: 10,
};

/** Markers bracketing the injected badge so `injectAiBadge` is idempotent. */
const BADGE_MARKER_OPEN = '<!-- stageflip-ai-disclosure -->';
const BADGE_MARKER_CLOSE = '<!-- /stageflip-ai-disclosure -->';

const HTML_ESCAPE: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPE[ch] ?? ch);
}

/**
 * Translate `position` into a CSS edge-pair (`top|bottom: 8px; left|right: 8px`).
 */
function positionCss(position: AiDisclosureBadgeConfig['position']): string {
  const vertical = position.startsWith('top') ? 'top: 8px;' : 'bottom: 8px;';
  const horizontal = position.endsWith('left') ? 'left: 8px;' : 'right: 8px;';
  return `${vertical} ${horizontal}`;
}

/**
 * Build the `<aside data-ai-disclosure>` HTML snippet that renders the
 * visible badge. Wrapped in our marker comments so `injectAiBadge` can
 * find + replace the existing block on re-injection.
 *
 * Throws when `cfg.text === ''` — callers must skip injection in the
 * disabled case (the orchestrator does this when reading
 * `cfg.text.length === 0`).
 */
export function aiBadgeHtml(cfg: AiDisclosureBadgeConfig): string {
  if (cfg.text.length === 0) {
    throw new Error('aiBadgeHtml: cfg.text must not be empty (caller must skip injection)');
  }
  const text = escapeHtml(cfg.text);
  const color = escapeHtml(cfg.color);
  const background = escapeHtml(cfg.background);
  const pos = positionCss(cfg.position);
  const fontSize = Number.isFinite(cfg.fontSize) ? cfg.fontSize : 10;
  const style = `position: absolute; ${pos} padding: 2px 6px; background: ${background}; color: ${color}; font: ${fontSize}px/1.2 system-ui, -apple-system, sans-serif; border-radius: 3px; pointer-events: none; z-index: 2147483647;`;
  return (
    `${BADGE_MARKER_OPEN}\n` +
    `<aside data-ai-disclosure aria-label="AI-generated content" style="${style}">${text}</aside>\n` +
    `${BADGE_MARKER_CLOSE}`
  );
}

/**
 * Insert the badge snippet immediately before `</body>`. If a previous
 * badge block (marker-bracketed) is present, it is replaced in place
 * (idempotent). Throws when the HTML has no `</body>` — every
 * IAB-compliant banner has one.
 */
export function injectAiBadge(html: string, cfg: AiDisclosureBadgeConfig): string {
  const snippet = aiBadgeHtml(cfg);
  const openIdx = html.indexOf(BADGE_MARKER_OPEN);
  if (openIdx !== -1) {
    const closeIdx = html.indexOf(BADGE_MARKER_CLOSE, openIdx);
    if (closeIdx === -1) {
      throw new Error('stageflip-ai-disclosure open marker present but no close marker found');
    }
    const replaceEnd = closeIdx + BADGE_MARKER_CLOSE.length;
    return html.slice(0, openIdx) + snippet + html.slice(replaceEnd);
  }
  const bodyCloseIdx = html.lastIndexOf('</body>');
  if (bodyCloseIdx === -1) {
    throw new Error('HTML has no </body> tag — cannot inject AI disclosure badge');
  }
  return `${html.slice(0, bodyCloseIdx)}${snippet}\n${html.slice(bodyCloseIdx)}`;
}

/**
 * Rewrite mount nodes carrying a `data-element-id` attribute whose value is
 * in `elementIds` to also carry `data-ai-generated="true"`. No-op when no
 * matching node is found OR when the attribute is already present.
 *
 * The bundler is responsible for emitting `data-element-id` on its mount
 * nodes; this helper is opt-in per bundler. When the bundler does NOT
 * emit such selectors, this function silently returns the input unchanged
 * — the visible badge and manifest disclosure still fire.
 */
export function annotateAiElementsInHtml(html: string, elementIds: readonly string[]): string {
  if (elementIds.length === 0) return html;
  let out = html;
  for (const id of elementIds) {
    // Escape regex metacharacters in the id to keep the matcher safe.
    const safeId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match a complete opening tag carrying `data-element-id="<id>"`.
    // Group 1 is the tag-prefix up to (but not including) the closing
    // `>` or `/>`; group 2 is the closing `>` / `/>`.
    const re = new RegExp(`(<[a-zA-Z][^>]*\\bdata-element-id="${safeId}"[^>]*?)(\\s*/?>)`, 'g');
    out = out.replace(re, (match, prefix: string, close: string) => {
      // Skip if `data-ai-generated=` already present anywhere in the tag.
      if (/\bdata-ai-generated=/.test(match)) return match;
      return `${prefix} data-ai-generated="true"${close}`;
    });
  }
  return out;
}
