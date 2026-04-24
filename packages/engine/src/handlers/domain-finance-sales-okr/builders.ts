// packages/engine/src/handlers/domain-finance-sales-okr/builders.ts
// Shared element + slide builders used by the finance / sales / OKR
// domain composites. Each factory returns a plain JSON object that
// satisfies the corresponding element schema (the router Zod-validates
// downstream). The builders are pure — given the same inputs, they emit
// the same element.
//
// Every element gets `visible: true`, `locked: false`, and an empty
// `animations: []` by default. Callers can override via the `extra`
// parameter when they need to annotate.

const DEFAULT_TRANSFORM = {
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  rotation: 0,
  opacity: 1,
};

export interface ElementTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
}

function transform(overrides: Partial<ElementTransform> = {}): ElementTransform {
  return { ...DEFAULT_TRANSFORM, ...overrides };
}

export function makeTitleText(
  id: string,
  title: string,
  overrides: Partial<ElementTransform> = {},
) {
  return {
    id,
    type: 'text' as const,
    text: title,
    fontSize: 56,
    align: 'left' as const,
    visible: true,
    locked: false,
    animations: [],
    transform: transform({ x: 80, y: 60, width: 1760, height: 100, ...overrides }),
  };
}

export function makeBodyText(id: string, text: string, overrides: Partial<ElementTransform> = {}) {
  return {
    id,
    type: 'text' as const,
    text,
    fontSize: 24,
    align: 'left' as const,
    visible: true,
    locked: false,
    animations: [],
    transform: transform({ x: 80, y: 200, width: 1760, height: 80, ...overrides }),
  };
}

export function makeHeroNumber(
  id: string,
  text: string,
  overrides: Partial<ElementTransform> = {},
) {
  return {
    id,
    type: 'text' as const,
    text,
    fontSize: 160,
    align: 'center' as const,
    visible: true,
    locked: false,
    animations: [],
    transform: transform({ x: 200, y: 360, width: 1520, height: 240, ...overrides }),
  };
}

export function makeShape(
  id: string,
  shape: 'rect' | 'ellipse' | 'line',
  overrides: Partial<ElementTransform> = {},
  fill?: string,
) {
  return {
    id,
    type: 'shape' as const,
    shape,
    ...(fill ? { fill } : {}),
    visible: true,
    locked: false,
    animations: [],
    transform: transform(overrides),
  };
}

export function makeChart(
  id: string,
  chartKind: 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'combo',
  data: { labels: string[]; series: Array<{ name: string; values: Array<number | null> }> },
  overrides: Partial<ElementTransform> = {},
) {
  return {
    id,
    type: 'chart' as const,
    chartKind,
    data,
    legend: true,
    axes: chartKind !== 'pie' && chartKind !== 'donut',
    visible: true,
    locked: false,
    animations: [],
    transform: transform({ x: 120, y: 240, width: 1680, height: 720, ...overrides }),
  };
}

/**
 * Metric card — a group element composed of a background rectangle,
 * a label text, and a value text. Used by KPI strips across finance,
 * sales, and OKR composites.
 */
export function makeMetricCard(
  id: string,
  label: string,
  value: string,
  overrides: Partial<ElementTransform> = {},
  accent?: string,
) {
  const bg = transform({ width: 420, height: 240, ...overrides });
  return {
    id,
    type: 'group' as const,
    clip: false,
    visible: true,
    locked: false,
    animations: [],
    transform: bg,
    children: [
      {
        id: `${id}-bg`,
        type: 'shape' as const,
        shape: 'rect' as const,
        ...(accent ? { fill: accent } : {}),
        cornerRadius: 16,
        visible: true,
        locked: false,
        animations: [],
        transform: {
          x: bg.x,
          y: bg.y,
          width: bg.width,
          height: bg.height,
          rotation: 0,
          opacity: 1,
        },
      },
      {
        id: `${id}-label`,
        type: 'text' as const,
        text: label,
        fontSize: 28,
        align: 'left' as const,
        visible: true,
        locked: false,
        animations: [],
        transform: {
          x: bg.x + 24,
          y: bg.y + 24,
          width: bg.width - 48,
          height: 48,
          rotation: 0,
          opacity: 1,
        },
      },
      {
        id: `${id}-value`,
        type: 'text' as const,
        text: value,
        fontSize: 72,
        align: 'left' as const,
        visible: true,
        locked: false,
        animations: [],
        transform: {
          x: bg.x + 24,
          y: bg.y + 96,
          width: bg.width - 48,
          height: 120,
          rotation: 0,
          opacity: 1,
        },
      },
    ],
  };
}

/**
 * Progress bar — a group with a background rail, a filled portion, and
 * a label. `progress` is 0..1.
 */
export function makeProgressBar(
  id: string,
  label: string,
  progress: number,
  overrides: Partial<ElementTransform> = {},
) {
  const clamped = Math.max(0, Math.min(1, progress));
  const bg = transform({ width: 800, height: 48, ...overrides });
  return {
    id,
    type: 'group' as const,
    clip: false,
    visible: true,
    locked: false,
    animations: [],
    transform: bg,
    children: [
      {
        id: `${id}-rail`,
        type: 'shape' as const,
        shape: 'rect' as const,
        cornerRadius: 24,
        visible: true,
        locked: false,
        animations: [],
        transform: {
          x: bg.x,
          y: bg.y,
          width: bg.width,
          height: bg.height,
          rotation: 0,
          opacity: 1,
        },
      },
      {
        id: `${id}-fill`,
        type: 'shape' as const,
        shape: 'rect' as const,
        cornerRadius: 24,
        visible: true,
        locked: false,
        animations: [],
        transform: {
          x: bg.x,
          y: bg.y,
          width: Math.max(1, bg.width * clamped),
          height: bg.height,
          rotation: 0,
          opacity: 1,
        },
      },
      {
        id: `${id}-label`,
        type: 'text' as const,
        text: `${label} — ${Math.round(clamped * 100)}%`,
        fontSize: 22,
        align: 'left' as const,
        visible: true,
        locked: false,
        animations: [],
        transform: {
          x: bg.x,
          y: bg.y - 32,
          width: bg.width,
          height: 28,
          rotation: 0,
          opacity: 1,
        },
      },
    ],
  };
}

/**
 * Slide builder — produces a slide payload ready to push as an
 * `add /content/slides/-` patch.
 */
export function makeSlide(
  id: string,
  title: string,
  elements: unknown[],
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    title,
    elements: [makeTitleText(`${id}-title`, title), ...elements],
    ...extra,
  };
}

/**
 * Horizontal strip layout — deal `count` equal-width cards across the
 * canvas with `gap` between them. Returns transforms the caller can
 * feed into card builders.
 */
export function stripLayout(
  count: number,
  options: { y?: number; height?: number; margin?: number; gap?: number } = {},
): ElementTransform[] {
  const margin = options.margin ?? 80;
  const gap = options.gap ?? 24;
  const y = options.y ?? 280;
  const height = options.height ?? 240;
  const totalWidth = 1920 - margin * 2 - gap * Math.max(0, count - 1);
  const width = totalWidth / count;
  const out: ElementTransform[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      x: margin + i * (width + gap),
      y,
      width,
      height,
    });
  }
  return out;
}

export function currentCount(ctx: { document: { content: unknown } }): number {
  const content = (ctx.document as { content: { mode: string } }).content;
  if (content.mode !== 'slide') return 0;
  return ((content as unknown as { slides: unknown[] }).slides as unknown[]).length;
}
