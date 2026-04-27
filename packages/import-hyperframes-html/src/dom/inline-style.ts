// packages/import-hyperframes-html/src/dom/inline-style.ts
// Tiny inline-style parser: handles exactly the property set Hyperframes
// producers emit. CSS-class resolution is OOS (T-247 spec §"Out of scope" #1);
// this parser only walks `style="prop: value; prop: value"` declarations.
// Output is a `Record<prop, value>` keyed by lowercased property name.

/**
 * Parse a CSS inline-style attribute value into a property-keyed record.
 * Handles `;`-separated declarations with optional whitespace and trailing
 * semicolons. Property names are lowercased; values preserve case (URLs and
 * function arguments). Unparseable declarations (no `:`) are skipped.
 *
 * Example:
 *   `parseInlineStyle("left: 540px; top: 1360px")`
 *   → `{ left: "540px", top: "1360px" }`
 */
export function parseInlineStyle(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of raw.split(';')) {
    const idx = decl.indexOf(':');
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (prop.length === 0 || value.length === 0) continue;
    out[prop] = value;
  }
  return out;
}

/**
 * Reverse of `parseInlineStyle`: serialize a property-keyed record into a
 * `style="..."` value string. Output is deterministic: properties are emitted
 * in the supplied object's iteration order (caller controls; this writer
 * doesn't sort to allow positional preservation).
 */
export function serializeInlineStyle(props: Record<string, string>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    parts.push(`${k}: ${v}`);
  }
  return parts.join('; ');
}

/**
 * Parse a CSS length expressed in `px` (e.g. `"540px"`) to a finite number.
 * Returns `undefined` for non-px lengths or unparseable strings — the
 * caller's responsibility is to fall back / emit a loss flag.
 */
export function parsePxLength(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const match = /^(-?[\d.]+)\s*px$/.exec(value.trim());
  if (match === null) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parsed `transform: ...` shorthand. Hyperframes emits exactly the four
 * functional forms below; matrix/skew/3d transforms are escalation triggers
 * (T-247 §6 escalation list).
 */
export interface ParsedTransform {
  /** Translate offset in px, if present. */
  translateX?: number;
  translateY?: number;
  /** Center-anchor marker: `translate(-50%, -50%)`. */
  centerAnchor: boolean;
  /** Uniform scale factor, if present. */
  scale?: number;
  /** Rotation in degrees, if present. */
  rotation?: number;
}

const TRANSLATE_FN = /translate\(\s*(-?[\d.]+)(px|%)\s*,\s*(-?[\d.]+)(px|%)\s*\)/;
const TRANSLATE1_FN = /translate\(\s*(-?[\d.]+)(px|%)\s*\)/;
const SCALE_FN = /scale\(\s*(-?[\d.]+)\s*\)/;
const ROTATE_FN = /rotate\(\s*(-?[\d.]+)\s*deg\s*\)/;

/**
 * Parse a CSS `transform` shorthand into the small set of functional forms
 * Hyperframes producers emit. Multiple functions in one declaration are
 * additive (CSS-spec semantics): T-247 only needs scale != 1 / center-anchor
 * detection / rotation-deg pickup. Anything else is preserved on the raw
 * style record so the export round-trip can write it back if needed.
 */
export function parseTransform(value: string | undefined): ParsedTransform {
  if (value === undefined) return { centerAnchor: false };
  const result: ParsedTransform = { centerAnchor: false };

  const t2 = TRANSLATE_FN.exec(value);
  if (t2 !== null) {
    const [, x, xUnit, y, yUnit] = t2;
    if (xUnit === '%' && yUnit === '%' && Number(x) === -50 && Number(y) === -50) {
      result.centerAnchor = true;
    } else if (xUnit === 'px' && yUnit === 'px') {
      result.translateX = Number(x);
      result.translateY = Number(y);
    }
  } else {
    const t1 = TRANSLATE1_FN.exec(value);
    if (t1 !== null) {
      const [, x, xUnit] = t1;
      if (xUnit === 'px') {
        result.translateX = Number(x);
      }
    }
  }

  const sMatch = SCALE_FN.exec(value);
  if (sMatch !== null) {
    result.scale = Number(sMatch[1]);
  }

  const rMatch = ROTATE_FN.exec(value);
  if (rMatch !== null) {
    result.rotation = Number(rMatch[1]);
  }

  return result;
}
