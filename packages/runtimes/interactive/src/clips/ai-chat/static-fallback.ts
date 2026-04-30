// packages/runtimes/interactive/src/clips/ai-chat/static-fallback.ts
// `defaultAiChatStaticFallback` — deterministic Element[] generator for
// the `family: 'ai-chat'` clip's `staticFallback` default per T-390
// D-T390-2 + D-T390-3. When the harness routes to the static path AND
// the clip's authored `staticFallback` is empty, the harness substitutes
// the result of this function: a TextElement summarising the clip's
// systemPrompt, plus one TextElement per turn in `capturedTranscript`
// (alternating role labels via the `id` suffix). When
// `capturedTranscript` is absent or empty, a single placeholder
// TextElement (empty text, `id` ending in `-placeholder`) is appended in
// place of the turn list.
//
// DETERMINISM (AC #5 / #15): byte-for-byte equality across calls is the
// architectural floor. The function uses ONLY:
//   - Pure string + integer arithmetic to derive transforms.
//   - `String.prototype.slice` for systemPrompt truncation.
// No `Math.random`, no `Date.now`, no `performance.now`. Same posture as
// `defaultVoiceStaticFallback` (T-388 D-T388-3).
//
// PRIVACY (AC #13): the generator wrapper's telemetry attributes carry
// integer lengths only — `transcriptTurnCount`, `systemPromptLength`. The
// systemPrompt body and per-turn bodies are NEVER attached to telemetry.
//
// Browser-safe AND Node-safe: pure string + integer arithmetic. No DOM,
// no canvas, no Node-only imports.

import type { Element, TextElement, Transform } from '@stageflip/schema';

import type { StaticFallbackGenerator } from '../../static-fallback-registry.js';

/** One captured turn — same shape `aiChatClipPropsSchema` parses. */
export interface AiChatCapturedTurn {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * Args to {@link defaultAiChatStaticFallback}. Width/height are required;
 * `capturedTranscript` is optional (absent → placeholder).
 */
export interface DefaultAiChatStaticFallbackArgs {
  /** Bounding-box width (canvas px). */
  width: number;
  /** Bounding-box height (canvas px). */
  height: number;
  /** Per-slide system prompt (the clip's identity). Rendered truncated. */
  systemPrompt: string;
  /**
   * Pre-captured turn sequence. Absent OR empty → a single placeholder
   * TextElement (empty text) is rendered after the systemPrompt summary.
   */
  capturedTranscript?: ReadonlyArray<AiChatCapturedTurn>;
}

/** Maximum systemPrompt summary length (chars) — D-T390-2 documented cap. */
const SYSTEM_PROMPT_MAX_CHARS = 200;
/** Truncation marker appended when systemPrompt is sliced. */
const TRUNCATION_MARKER = '…';
/** Vertical padding (px) above the systemPrompt band. */
const TOP_PADDING_PX = 8;
/** Vertical gap (px) between rows. */
const ROW_GAP_PX = 4;
/** Horizontal padding (px) around every row. */
const HORIZONTAL_PADDING_PX = 8;
/** Fraction of the canvas height reserved for the systemPrompt band. */
const SYSTEM_PROMPT_HEIGHT_FRACTION = 0.18;
/** Minimum row height (px) — floor for tiny canvases. */
const MIN_ROW_HEIGHT_PX = 12;

/**
 * Build the default `staticFallback` Element[] for a `family: 'ai-chat'`
 * clip. See file header for the determinism contract (AC #5 + AC #15)
 * and D-T390-2 for the layout shape.
 *
 * Returns an Element[] (typed at the TypeScript layer) — NOT round-
 * tripped through Zod. The harness's `renderStaticFallback` consumes the
 * array directly.
 */
export function defaultAiChatStaticFallback(args: DefaultAiChatStaticFallbackArgs): Element[] {
  const { width, height, systemPrompt } = args;
  const capturedTranscript = args.capturedTranscript ?? [];

  const elements: Element[] = [];

  // 1. systemPrompt summary band — sized to a fraction of the canvas
  //    height; pinned by AC #11 to fit within (width, height).
  const systemPromptHeight = Math.max(
    MIN_ROW_HEIGHT_PX,
    Math.floor(height * SYSTEM_PROMPT_HEIGHT_FRACTION),
  );
  const systemPromptTransform: Transform = {
    x: HORIZONTAL_PADDING_PX,
    y: TOP_PADDING_PX,
    width: Math.max(0, width - HORIZONTAL_PADDING_PX * 2),
    height: systemPromptHeight,
    rotation: 0,
    opacity: 1,
  };
  const systemPromptElement: TextElement = {
    id: 'ai-chat-static-fallback-system-prompt',
    transform: systemPromptTransform,
    visible: true,
    locked: false,
    animations: [],
    type: 'text',
    text: truncateSystemPrompt(systemPrompt),
    align: 'left',
  };
  elements.push(systemPromptElement);

  // 2. Vertical layout cursor — y advances per row deterministically.
  let cursorY = TOP_PADDING_PX + systemPromptHeight + ROW_GAP_PX;

  // 3. Empty / absent transcript → single placeholder TextElement.
  //    Empty `text: ''` would fail a non-empty TextElement refine if the
  //    schema imposed one (AC #7 escalation note); the current
  //    `textElementSchema` does NOT refine `text` to non-empty so this
  //    is safe. The placeholder is host-replaceable via app-level i18n.
  if (capturedTranscript.length === 0) {
    const placeholderHeight = computeRowHeight(height, 1);
    const placeholderTransform: Transform = {
      x: HORIZONTAL_PADDING_PX,
      y: cursorY,
      width: Math.max(0, width - HORIZONTAL_PADDING_PX * 2),
      height: Math.min(placeholderHeight, Math.max(0, height - cursorY)),
      rotation: 0,
      opacity: 1,
    };
    const placeholderElement: TextElement = {
      id: 'ai-chat-static-fallback-placeholder',
      transform: placeholderTransform,
      visible: true,
      locked: false,
      animations: [],
      type: 'text',
      text: '',
      align: 'left',
    };
    elements.push(placeholderElement);
    return elements;
  }

  // 4. One TextElement per turn. Stack vertically; cursor advances per
  //    row by `rowHeight + ROW_GAP_PX`. AC #11 pins fit-within-bounds;
  //    AC #12 pins strict y-monotonicity.
  const rowHeight = computeRowHeight(height, capturedTranscript.length);
  for (let i = 0; i < capturedTranscript.length; i += 1) {
    const turn = capturedTranscript[i];
    if (turn === undefined) continue;
    const remaining = Math.max(0, height - cursorY);
    const renderedHeight = Math.min(rowHeight, remaining);
    const turnTransform: Transform = {
      x: HORIZONTAL_PADDING_PX,
      y: cursorY,
      width: Math.max(0, width - HORIZONTAL_PADDING_PX * 2),
      height: renderedHeight,
      rotation: 0,
      opacity: 1,
    };
    const turnElement: TextElement = {
      id: `ai-chat-static-fallback-turn-${i}-${turn.role}`,
      transform: turnTransform,
      visible: true,
      locked: false,
      animations: [],
      type: 'text',
      text: turn.text,
      align: turn.role === 'assistant' ? 'left' : 'right',
    };
    elements.push(turnElement);
    // Strict monotonic advance — even when a row is clipped to fit, the
    // next y is GREATER so AC #12 holds.
    cursorY += Math.max(1, renderedHeight) + ROW_GAP_PX;
  }

  return elements;
}

/**
 * Truncate a systemPrompt to `SYSTEM_PROMPT_MAX_CHARS` with an ellipsis
 * appended when sliced. Pure transformation — same input → same output.
 */
function truncateSystemPrompt(prompt: string): string {
  if (prompt.length <= SYSTEM_PROMPT_MAX_CHARS) return prompt;
  return `${prompt.slice(0, SYSTEM_PROMPT_MAX_CHARS - TRUNCATION_MARKER.length)}${TRUNCATION_MARKER}`;
}

/**
 * Per-row height — divides the available column (canvas height minus
 * top-padding minus systemPrompt band) by the turn count, with a
 * `MIN_ROW_HEIGHT_PX` floor. Pure integer arithmetic.
 */
function computeRowHeight(canvasHeight: number, turnCount: number): number {
  const reserved =
    TOP_PADDING_PX +
    Math.max(MIN_ROW_HEIGHT_PX, Math.floor(canvasHeight * SYSTEM_PROMPT_HEIGHT_FRACTION)) +
    ROW_GAP_PX;
  const available = Math.max(0, canvasHeight - reserved);
  // Reserve space for inter-row gaps so the last row still fits.
  const gapBudget = ROW_GAP_PX * Math.max(0, turnCount - 1);
  const rowBudget = Math.max(0, available - gapBudget);
  const candidate = Math.floor(rowBudget / Math.max(1, turnCount));
  return Math.max(MIN_ROW_HEIGHT_PX, candidate);
}

/**
 * `StaticFallbackGenerator` wrapper for `family: 'ai-chat'` per T-388a
 * D-T388a-2 / T-390 D-T390-5. Reads `systemPrompt` and
 * `capturedTranscript` from `clip.liveMount.props`, calls
 * `defaultAiChatStaticFallback` with the clip's transform-derived
 * dimensions, and emits the `ai-chat-clip.static-fallback.rendered`
 * telemetry event with the documented attribute shape (AC #13).
 *
 * Privacy posture (D-T390-4 + AC #13): telemetry attributes are integer
 * lengths only — `transcriptTurnCount` and `systemPromptLength`. The
 * systemPrompt body and per-turn bodies are NEVER attached to
 * telemetry. Same posture as T-389 D-T389-8.
 *
 * Exported so `clips/ai-chat/index.ts` (the production side-effect
 * registration site) and tests share the same wrapper — no drift
 * between the registered behaviour and what tests assert against.
 */
export const aiChatStaticFallbackGenerator: StaticFallbackGenerator = ({
  clip,
  reason,
  emitTelemetry,
}) => {
  const props = (clip.liveMount.props ?? {}) as {
    systemPrompt?: unknown;
    capturedTranscript?: unknown;
  };
  const systemPrompt = typeof props.systemPrompt === 'string' ? props.systemPrompt : '';
  const capturedTranscript = readCapturedTranscript(props.capturedTranscript);

  const generated = defaultAiChatStaticFallback({
    width: clip.transform.width,
    height: clip.transform.height,
    systemPrompt,
    ...(capturedTranscript !== undefined ? { capturedTranscript } : {}),
  });

  emitTelemetry('ai-chat-clip.static-fallback.rendered', {
    family: clip.family,
    reason,
    width: clip.transform.width,
    height: clip.transform.height,
    // Privacy posture (D-T390-4 + AC #13): integer lengths only.
    transcriptTurnCount: capturedTranscript?.length ?? 0,
    systemPromptLength: systemPrompt.length,
  });

  return generated;
};

/**
 * Defensive narrowing — the generator runs against
 * `clip.liveMount.props` whose shape has been validated at clip-creation
 * time, but we still re-read defensively because in-test fixtures may
 * supply ad-hoc props (and a leaked telemetry attribute from a malformed
 * payload would be a regression). Returns `undefined` for any
 * non-array, missing, or malformed value.
 */
function readCapturedTranscript(raw: unknown): ReadonlyArray<AiChatCapturedTurn> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: AiChatCapturedTurn[] = [];
  for (const item of raw) {
    if (
      item !== null &&
      typeof item === 'object' &&
      'role' in item &&
      'text' in item &&
      (item.role === 'user' || item.role === 'assistant') &&
      typeof item.text === 'string'
    ) {
      out.push({ role: item.role, text: item.text });
    } else {
      return undefined;
    }
  }
  return out;
}
