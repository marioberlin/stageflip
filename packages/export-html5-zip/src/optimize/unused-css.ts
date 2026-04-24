// packages/export-html5-zip/src/optimize/unused-css.ts
// Drop unused selectors from inline `<style>` blocks. Conservative: if
// any selector in a rule looks unfamiliar (attribute selectors, complex
// pseudo-selectors, :has, :is, etc.) we keep the whole rule. Targeted at
// the common IAB banner shape: a handful of `.class`, `#id`, and tag
// selectors inline in the document.
//
// This lives here (rather than a real DOM / PostCSS dep) because
// HTML5 banners typically ship <2 KB of inline CSS; the common case
// matters more than covering every selector in the CSS spec.

const TAG_RE = /<([a-zA-Z][a-zA-Z0-9-]*)\b/g;
const CLASS_ATTR_RE = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const ID_ATTR_RE = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const STYLE_OPEN_RE = /<style\b[^>]*>/gi;
const STYLE_CLOSE = '</style>';

/** Extracted references from HTML used to match simple selectors. */
export interface HtmlReferences {
  readonly tags: ReadonlySet<string>;
  readonly classes: ReadonlySet<string>;
  readonly ids: ReadonlySet<string>;
}

/** Walk HTML once and collect every tag name / class / id reference. */
export function extractHtmlReferences(html: string): HtmlReferences {
  const tags = new Set<string>();
  const classes = new Set<string>();
  const ids = new Set<string>();

  for (const match of html.matchAll(TAG_RE)) {
    const tag = match[1];
    if (tag !== undefined) tags.add(tag.toLowerCase());
  }
  for (const match of html.matchAll(CLASS_ATTR_RE)) {
    const raw = (match[1] ?? match[2] ?? '').trim();
    if (raw.length === 0) continue;
    for (const c of raw.split(/\s+/)) {
      if (c.length > 0) classes.add(c);
    }
  }
  for (const match of html.matchAll(ID_ATTR_RE)) {
    const raw = (match[1] ?? match[2] ?? '').trim();
    if (raw.length > 0) ids.add(raw);
  }

  return { tags, classes, ids };
}

/**
 * Parse a CSS block into a list of rules. Extremely limited parser:
 * recognises `selector-list { declarations }`, handles nested braces
 * (e.g. `@media`) by treating them as single opaque rules.
 */
export interface CssRule {
  readonly selectors: readonly string[];
  /** Full rule body including braces for `@media`/`@keyframes` blocks. */
  readonly body: string;
  /** True for `@media`, `@keyframes`, `@supports`, etc. */
  readonly isAtRule: boolean;
  /** Raw source of the rule including its preamble + body. */
  readonly raw: string;
}

export function parseCssRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  let i = 0;
  while (i < css.length) {
    while (i < css.length && /\s/.test(css[i] as string)) i += 1;
    if (i >= css.length) break;
    const start = i;
    while (i < css.length && css[i] !== '{') i += 1;
    if (i >= css.length) break;
    const preamble = css.slice(start, i).trim();
    // Find matching close brace with depth tracking (@media blocks nest).
    let depth = 1;
    const bodyStart = i;
    i += 1;
    while (i < css.length && depth > 0) {
      const ch = css[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      i += 1;
    }
    const body = css.slice(bodyStart, i);
    const raw = css.slice(start, i);
    const isAtRule = preamble.startsWith('@');
    const selectors = isAtRule
      ? [preamble]
      : preamble
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
    rules.push({ selectors, body, isAtRule, raw });
  }
  return rules;
}

// Match "plain" simple-selector tokens: a tag, .class, #id, plus the
// universal selector, pseudo-elements, and direct-combinator whitespace.
// If a selector contains anything else (attribute, :pseudo-class, etc.)
// we mark it as "unknown syntax" and keep the rule conservatively.
const PLAIN_TOKEN_RE = /([#.]?[a-zA-Z_][a-zA-Z0-9_-]*)|::?[a-zA-Z-]+|[>+~*\s]/;

/**
 * Decide whether a single selector references at least one thing the
 * HTML actually mentions. Returns `false` only when we're confident the
 * selector is dead; unfamiliar / complex selectors return `true`.
 */
export function selectorMatchesHtml(selector: string, refs: HtmlReferences): boolean {
  const trimmed = selector.trim();
  if (trimmed.length === 0) return true;

  // Reject if we see any syntax we don't understand — keep the rule.
  const sanitised = trimmed
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/::?[a-zA-Z-]+(?:\([^)]*\))?/g, '') // strip pseudo-classes / pseudo-elements
    .trim();
  if (sanitised.length === 0) return true;
  // Characters we explicitly don't handle — keep the rule.
  if (/[[()]/.test(sanitised)) return true;

  const tokens = sanitised.split(/[\s>+~]+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return true;

  // For every compound token, require at least one atomic component to
  // be in the refs. If every atomic component is in the refs' negative
  // set, the selector is dead.
  for (const token of tokens) {
    const atoms = token.match(/[#.]?[a-zA-Z_*][a-zA-Z0-9_-]*/g);
    if (atoms === null || atoms.length === 0) return true;
    let anyAtomReferenced = false;
    for (const atom of atoms) {
      if (atom === '*') {
        anyAtomReferenced = true;
        break;
      }
      if (atom.startsWith('.')) {
        if (refs.classes.has(atom.slice(1))) {
          anyAtomReferenced = true;
          break;
        }
      } else if (atom.startsWith('#')) {
        if (refs.ids.has(atom.slice(1))) {
          anyAtomReferenced = true;
          break;
        }
      } else if (!PLAIN_TOKEN_RE.test(atom)) {
        // Shouldn't happen — the match pattern should cover it. Keep.
        return true;
      } else if (refs.tags.has(atom.toLowerCase())) {
        anyAtomReferenced = true;
        break;
      }
    }
    if (!anyAtomReferenced) return false;
  }
  return true;
}

/**
 * Strip unused selectors from a CSS text block given the HTML that
 * consumes it. When every selector in a rule is dead, the whole rule
 * is dropped; otherwise the live selectors are re-joined.
 */
export function stripUnusedCss(css: string, refs: HtmlReferences): string {
  const rules = parseCssRules(css);
  const out: string[] = [];
  for (const rule of rules) {
    if (rule.isAtRule) {
      out.push(rule.raw);
      continue;
    }
    const liveSelectors = rule.selectors.filter((s) => selectorMatchesHtml(s, refs));
    if (liveSelectors.length === 0) continue;
    out.push(`${liveSelectors.join(', ')}${rule.body}`);
  }
  return out.join('\n');
}

/**
 * Apply `stripUnusedCss` to every inline `<style>` block in the HTML.
 * External `<link rel="stylesheet">` references are untouched — IAB
 * banners rarely use them (the budget forbids external fetches).
 */
export function stripUnusedCssFromHtml(html: string): string {
  const refs = extractHtmlReferences(html);
  let out = '';
  let lastIdx = 0;
  for (const match of html.matchAll(STYLE_OPEN_RE)) {
    const openIdx = match.index ?? -1;
    if (openIdx < 0) continue;
    const openEnd = openIdx + match[0].length;
    const closeIdx = html.indexOf(STYLE_CLOSE, openEnd);
    if (closeIdx < 0) continue;
    const css = html.slice(openEnd, closeIdx);
    const stripped = stripUnusedCss(css, refs);
    out += html.slice(lastIdx, openEnd);
    out += stripped;
    lastIdx = closeIdx;
  }
  out += html.slice(lastIdx);
  return out;
}
