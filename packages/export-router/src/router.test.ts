// packages/export-router/src/router.test.ts
// Router tests — `routeExport()` exhaustive over every `ExportTarget`. Asserts:
//   - exporter-package mapping per target (AC-5)
//   - 'live'-mode targets always emit `{ kind: 'route', mode: 'live' }` (AC-4)
//   - 'static'-mode targets emit `'route' | 'fallback'` based on live clip
//     presence (AC-2 + AC-3)
//   - dependency hygiene: package.json carries no `@stageflip/export-*` dep
//     beyond `@stageflip/schema` (AC-8)

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type ExportTarget, exportTargetSchema } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { routeExport } from './router.js';
import { liveClip, slideDoc, textEl } from './test-fixtures.js';
import type { ExporterPackage } from './types.js';

// ──────────────────────────────────────────────────────────────────────────
// Per-target exporter mapping table — kept in lock-step with router.ts.
// Tests assert this lookup IS the implementation, not a parallel definition:
// every target appears here and the router emits the same package.
// ──────────────────────────────────────────────────────────────────────────

const EXPECTED_EXPORTER: Readonly<Record<ExportTarget, ExporterPackage>> = {
  mp4: '@stageflip/export-video',
  'image-sequence': '@stageflip/export-video',
  'pptx-flat': '@stageflip/export-pptx',
  'html-slides': '@stageflip/export-html5-zip',
  'live-presentation': '@stageflip/export-google-slides',
  'display-pre-rendered': '@stageflip/export-html5-zip',
  'display-interactive': '@stageflip/export-html5-zip',
  'on-device-player': '@stageflip/export-html5-zip',
};

const STATIC_TARGETS: ExportTarget[] = [
  'mp4',
  'image-sequence',
  'pptx-flat',
  'display-pre-rendered',
];
const LIVE_TARGETS: ExportTarget[] = [
  'html-slides',
  'live-presentation',
  'display-interactive',
  'on-device-player',
];

// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────

describe('routeExport', () => {
  describe('AC-1: exhaustive over `ExportTarget` enum', () => {
    it('returns a RoutingDecision for every ExportTarget', () => {
      const doc = slideDoc([[textEl('t1')]]);
      for (const target of exportTargetSchema.options) {
        const decision = routeExport(target, doc);
        expect(decision).toBeDefined();
        expect(decision.target).toBe(target);
      }
    });
  });

  describe('AC-5: per-target exporter package mapping', () => {
    for (const target of exportTargetSchema.options) {
      it(`${target} → ${EXPECTED_EXPORTER[target]}`, () => {
        const doc = slideDoc([[textEl('t1')]]);
        const decision = routeExport(target, doc);
        expect(decision.exporterPackage).toBe(EXPECTED_EXPORTER[target]);
      });
    }
  });

  describe("AC-4: 'live' targets — always route to live mode", () => {
    for (const target of LIVE_TARGETS) {
      it(`${target} routes live regardless of document contents (no live clips)`, () => {
        const doc = slideDoc([[textEl('t1')]]);
        const decision = routeExport(target, doc);
        expect(decision).toEqual({
          kind: 'route',
          target,
          mode: 'live',
          exporterPackage: EXPECTED_EXPORTER[target],
          reason: 'target_is_live_capable',
        });
      });

      it(`${target} routes live regardless of document contents (with live clips)`, () => {
        const doc = slideDoc([[textEl('t1'), liveClip('lc1', 'shader')]]);
        const decision = routeExport(target, doc);
        expect(decision).toEqual({
          kind: 'route',
          target,
          mode: 'live',
          exporterPackage: EXPECTED_EXPORTER[target],
          reason: 'target_is_live_capable',
        });
      });
    }
  });

  describe("AC-2: 'static' targets + no live clips → route static", () => {
    for (const target of STATIC_TARGETS) {
      it(`${target} routes static (no_live_clips_dropped reason)`, () => {
        const doc = slideDoc([[textEl('t1'), textEl('t2')]]);
        const decision = routeExport(target, doc);
        expect(decision).toEqual({
          kind: 'route',
          target,
          mode: 'static',
          exporterPackage: EXPECTED_EXPORTER[target],
          reason: 'target_is_static_only_no_live_clips',
        });
      });
    }
  });

  describe("AC-3: 'static' targets + live clips → fallback with omitted list", () => {
    for (const target of STATIC_TARGETS) {
      it(`${target} emits fallback with liveClipsOmitted`, () => {
        const doc = slideDoc([
          [textEl('t1'), liveClip('lc-shader', 'shader')],
          [liveClip('lc-voice', 'voice')],
        ]);
        const decision = routeExport(target, doc);
        expect(decision).toEqual({
          kind: 'fallback',
          target,
          mode: 'static',
          exporterPackage: EXPECTED_EXPORTER[target],
          reason: 'target_is_static_only',
          liveClipsOmitted: [
            { id: 'lc-shader', family: 'shader' },
            { id: 'lc-voice', family: 'voice' },
          ],
        });
      });
    }
  });

  describe('determinism', () => {
    it('returns structurally-equal decisions for identical inputs', () => {
      const doc = slideDoc([[liveClip('lc1', 'shader')]]);
      const a = routeExport('mp4', doc);
      const b = routeExport('mp4', doc);
      expect(a).toEqual(b);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// AC-8: dependency hygiene — package.json carries no `@stageflip/export-*`
// dep beyond `@stageflip/schema`. The router names exporter packages as
// strings; it MUST NOT import from them.
// ──────────────────────────────────────────────────────────────────────────

describe('AC-8: package.json dep hygiene', () => {
  it('does not depend on any @stageflip/export-* package', () => {
    const pkgPath = resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const offending = Object.keys(allDeps).filter((d) => d.startsWith('@stageflip/export-'));
    expect(offending).toEqual([]);
  });
});
