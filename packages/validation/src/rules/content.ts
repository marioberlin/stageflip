// packages/validation/src/rules/content.ts
// Per-content-type rules. Most of these are warnings or quality
// checks — the Zod schema already bans most structural errors.

import type { LintFinding, LintRule } from '../types.js';

const CSS_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgb\(.*\)|rgba\(.*\)|hsl\(.*\)|hsla\(.*\)|[a-zA-Z]+)$/;
const MIN_REASONABLE_FONT_SIZE = 1;
const MAX_REASONABLE_FONT_SIZE = 2000;

export const textNonEmpty: LintRule = {
  id: 'text-non-empty',
  severity: 'warn',
  description: 'text elements should have non-empty text content',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (el.content.type === 'text' && el.content.text.length === 0) {
        out.push({
          rule: this.id,
          severity: 'warn',
          message: `text element '${el.id}' has empty text content`,
          elementId: el.id,
        });
      }
    }
    return out;
  },
};

export const textFontSizeReasonable: LintRule = {
  id: 'text-font-size-reasonable',
  severity: 'warn',
  description: `text fontSize should fall within [${MIN_REASONABLE_FONT_SIZE}, ${MAX_REASONABLE_FONT_SIZE}]`,
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (el.content.type === 'text') {
        const fs = el.content.fontSize;
        if (fs < MIN_REASONABLE_FONT_SIZE || fs > MAX_REASONABLE_FONT_SIZE) {
          out.push({
            rule: this.id,
            severity: 'warn',
            message: `text element '${el.id}' has fontSize ${fs} (outside ${MIN_REASONABLE_FONT_SIZE}-${MAX_REASONABLE_FONT_SIZE})`,
            elementId: el.id,
          });
        }
      }
    }
    return out;
  },
  fix(doc, findings) {
    if (findings.length === 0) return null;
    const ids = new Set(findings.map((f) => f.elementId).filter((id): id is string => Boolean(id)));
    if (ids.size === 0) return null;
    let changed = false;
    const elements = doc.elements.map((el) => {
      if (!ids.has(el.id) || el.content.type !== 'text') return el;
      const clamped = Math.min(
        MAX_REASONABLE_FONT_SIZE,
        Math.max(MIN_REASONABLE_FONT_SIZE, el.content.fontSize),
      );
      if (clamped === el.content.fontSize) return el;
      changed = true;
      return { ...el, content: { ...el.content, fontSize: clamped } };
    });
    if (!changed) return null;
    return { ...doc, elements };
  },
};

export const textColorIsValidCss: LintRule = {
  id: 'text-color-is-valid-css',
  severity: 'error',
  description: 'text.color must parse as a CSS color string (hex / rgb / hsl / keyword)',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (el.content.type === 'text' && !CSS_COLOR_RE.test(el.content.color)) {
        out.push({
          rule: this.id,
          severity: 'error',
          message: `text element '${el.id}' has invalid color '${el.content.color}'`,
          elementId: el.id,
        });
      }
    }
    return out;
  },
};

export const shapeHasFillOrStroke: LintRule = {
  id: 'shape-has-fill-or-stroke',
  severity: 'warn',
  description:
    'shape elements should define at least one of fill / strokeColor, else nothing renders',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (el.content.type === 'shape' && !el.content.fill && !el.content.strokeColor) {
        out.push({
          rule: this.id,
          severity: 'warn',
          message: `shape element '${el.id}' has neither fill nor strokeColor — will render invisibly`,
          elementId: el.id,
        });
      }
    }
    return out;
  },
};

export const shapeCustomPathHasPath: LintRule = {
  id: 'shape-custom-path-has-path',
  severity: 'error',
  description: "shape with shape: 'custom-path' must carry a path string",
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (el.content.type === 'shape' && el.content.shape === 'custom-path' && !el.content.path) {
        out.push({
          rule: this.id,
          severity: 'error',
          message: `custom-path shape '${el.id}' has no path string`,
          elementId: el.id,
        });
      }
    }
    return out;
  },
};

export const shapeFillIsValidCss: LintRule = {
  id: 'shape-fill-is-valid-css',
  severity: 'error',
  description: 'shape.fill must parse as a CSS color string when present',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (el.content.type === 'shape' && el.content.fill && !CSS_COLOR_RE.test(el.content.fill)) {
        out.push({
          rule: this.id,
          severity: 'error',
          message: `shape element '${el.id}' has invalid fill '${el.content.fill}'`,
          elementId: el.id,
        });
      }
    }
    return out;
  },
};

export const videoPlaybackRateReasonable: LintRule = {
  id: 'video-playback-rate-reasonable',
  severity: 'warn',
  description: 'video playbackRate outside [0.25, 4] is unusual',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (el.content.type === 'video') {
        const rate = el.content.playbackRate;
        if (rate < 0.25 || rate > 4) {
          out.push({
            rule: this.id,
            severity: 'warn',
            message: `video element '${el.id}' playbackRate is ${rate} (outside [0.25, 4])`,
            elementId: el.id,
          });
        }
      }
    }
    return out;
  },
  fix(doc, findings) {
    if (findings.length === 0) return null;
    const ids = new Set(findings.map((f) => f.elementId).filter((id): id is string => Boolean(id)));
    if (ids.size === 0) return null;
    let changed = false;
    const elements = doc.elements.map((el) => {
      if (!ids.has(el.id) || el.content.type !== 'video') return el;
      const clamped = Math.min(4, Math.max(0.25, el.content.playbackRate));
      if (clamped === el.content.playbackRate) return el;
      changed = true;
      return { ...el, content: { ...el.content, playbackRate: clamped } };
    });
    if (!changed) return null;
    return { ...doc, elements };
  },
};

export const videoTrimOrderedWhenPresent: LintRule = {
  id: 'video-trim-ordered-when-present',
  severity: 'error',
  description: 'when both video.trimStartMs and trimEndMs are set, end must be > start',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (el.content.type === 'video') {
        const { trimStartMs, trimEndMs } = el.content;
        if (trimStartMs !== undefined && trimEndMs !== undefined && trimEndMs <= trimStartMs) {
          out.push({
            rule: this.id,
            severity: 'error',
            message: `video '${el.id}' trim window is inverted: start=${trimStartMs}ms end=${trimEndMs}ms`,
            elementId: el.id,
          });
        }
      }
    }
    return out;
  },
  fix(doc, findings) {
    if (findings.length === 0) return null;
    const ids = new Set(findings.map((f) => f.elementId).filter((id): id is string => Boolean(id)));
    if (ids.size === 0) return null;
    let changed = false;
    const elements = doc.elements.map((el) => {
      if (!ids.has(el.id) || el.content.type !== 'video') return el;
      const { trimStartMs, trimEndMs } = el.content;
      if (trimStartMs === undefined || trimEndMs === undefined) return el;
      // Only swap when strictly inverted (end <= start). Equal endpoints
      // produce a zero-length window which the rule also flags; the
      // operator-intended fix for that is unclear, so we skip equals and
      // let the finding persist in the final report.
      if (trimEndMs >= trimStartMs) return el;
      changed = true;
      return {
        ...el,
        content: { ...el.content, trimStartMs: trimEndMs, trimEndMs: trimStartMs },
      };
    });
    if (!changed) return null;
    return { ...doc, elements };
  },
};

export const embedSrcUsesHttps: LintRule = {
  id: 'embed-src-uses-https',
  severity: 'warn',
  description: 'embed.src should use https (http embeds may be blocked by modern browsers)',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (el.content.type === 'embed' && el.content.src.startsWith('http://')) {
        out.push({
          rule: this.id,
          severity: 'warn',
          message: `embed '${el.id}' src uses http (not https)`,
          elementId: el.id,
        });
      }
    }
    return out;
  },
  fix(doc, findings) {
    if (findings.length === 0) return null;
    const ids = new Set(findings.map((f) => f.elementId).filter((id): id is string => Boolean(id)));
    if (ids.size === 0) return null;
    let changed = false;
    const elements = doc.elements.map((el) => {
      if (!ids.has(el.id) || el.content.type !== 'embed') return el;
      if (!el.content.src.startsWith('http://')) return el;
      changed = true;
      return { ...el, content: { ...el.content, src: `https://${el.content.src.slice(7)}` } };
    });
    if (!changed) return null;
    return { ...doc, elements };
  },
};

export const chartSeriesLengthMatchesLabels: LintRule = {
  id: 'chart-series-length-matches-labels',
  severity: 'error',
  description: 'every chart series.values.length must equal chart.data.labels.length',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (el.content.type === 'chart') {
        const labels = el.content.data.labels.length;
        for (let i = 0; i < el.content.data.series.length; i++) {
          const series = el.content.data.series[i];
          if (!series) continue;
          if (series.values.length !== labels) {
            out.push({
              rule: this.id,
              severity: 'error',
              message: `chart '${el.id}' series[${i}] '${series.name}' has ${series.values.length} values vs ${labels} labels`,
              elementId: el.id,
            });
          }
        }
      }
    }
    return out;
  },
};

export const chartSeriesNonEmpty: LintRule = {
  id: 'chart-series-non-empty',
  severity: 'warn',
  description: 'chart should have at least one series',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (el.content.type === 'chart' && el.content.data.series.length === 0) {
        out.push({
          rule: this.id,
          severity: 'warn',
          message: `chart '${el.id}' has zero series — nothing to render`,
          elementId: el.id,
        });
      }
    }
    return out;
  },
};

export const tableCellsWithinBounds: LintRule = {
  id: 'table-cells-within-bounds',
  severity: 'error',
  description: 'every table cell (row, col) must fall inside the declared rows × columns grid',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (el.content.type === 'table') {
        const { rows, columns, cells } = el.content;
        for (const cell of cells) {
          if (cell.row >= rows || cell.col >= columns) {
            out.push({
              rule: this.id,
              severity: 'error',
              message: `table '${el.id}' cell at (${cell.row},${cell.col}) escapes grid ${rows}x${columns}`,
              elementId: el.id,
            });
          }
        }
      }
    }
    return out;
  },
};

export const CONTENT_RULES: readonly LintRule[] = [
  textNonEmpty,
  textFontSizeReasonable,
  textColorIsValidCss,
  shapeHasFillOrStroke,
  shapeCustomPathHasPath,
  shapeFillIsValidCss,
  videoPlaybackRateReasonable,
  videoTrimOrderedWhenPresent,
  embedSrcUsesHttps,
  chartSeriesLengthMatchesLabels,
  chartSeriesNonEmpty,
  tableCellsWithinBounds,
] as const;
