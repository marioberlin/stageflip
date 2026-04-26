// packages/import-google-slides/src/parseGoogleSlides.test.ts
// Top-level integration tests against a hand-built ApiPresentation. Pin AC
// #40 (package.json shape) plus the public surface contract.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { GoogleAuthProvider } from './api/client.js';
import type { ApiPresentation } from './api/types.js';
import { StubCvProvider } from './cv/stub.js';
import { parseGoogleSlides } from './parseGoogleSlides.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const auth: GoogleAuthProvider = { getAccessToken: async () => 'tok' };

describe('parseGoogleSlides public surface', () => {
  it('returns a CanonicalSlideTree with assetsResolved=false', async () => {
    const tree = await parseGoogleSlides({
      presentationId: 'p',
      auth,
      cv: new StubCvProvider({ s: { textLines: [], contours: [] } }),
      presentation: {
        pageSize: { width: { magnitude: 9144000 }, height: { magnitude: 5143500 } },
        masters: [{ objectId: 'm', pageType: 'MASTER', pageElements: [] }],
        layouts: [{ objectId: 'l', pageType: 'LAYOUT', pageElements: [] }],
        slides: [{ objectId: 's', pageType: 'SLIDE', pageElements: [] }],
      },
      thumbnails: { s: { bytes: new Uint8Array(0), width: 1600, height: 900 } },
      cvFixtureKeys: { s: 's' },
    });
    expect(tree.assetsResolved).toBe(false);
    expect(tree.slides).toHaveLength(1);
    expect(tree.pendingResolution).toEqual({});
  });

  it('image elements emit ParsedAssetRef.unresolved with the contentUrl as oocxmlPath', async () => {
    const pres: ApiPresentation = {
      pageSize: { width: { magnitude: 9144000 }, height: { magnitude: 5143500 } },
      masters: [],
      layouts: [],
      slides: [
        {
          objectId: 's1',
          pageType: 'SLIDE',
          pageElements: [
            {
              objectId: 'img1',
              size: { width: { magnitude: 1000000 }, height: { magnitude: 1000000 } },
              transform: { scaleX: 1, scaleY: 1, translateX: 100000, translateY: 100000 },
              image: { contentUrl: 'https://lh3.gusercontent.com/abc' },
            },
          ],
        },
      ],
    };
    const tree = await parseGoogleSlides({
      presentationId: 'p',
      auth,
      cv: new StubCvProvider({ s1: { textLines: [], contours: [] } }),
      presentation: pres,
      thumbnails: { s1: { bytes: new Uint8Array(0), width: 1600, height: 900 } },
      cvFixtureKeys: { s1: 's1' },
    });
    const img = tree.slides[0]?.elements[0];
    expect(img?.type).toBe('image');
    if (img?.type === 'image') {
      expect(img.src).toEqual({
        kind: 'unresolved',
        oocxmlPath: 'https://lh3.gusercontent.com/abc',
      });
    }
  });
});

describe('AC #40 — package.json snapshot', () => {
  it('@stageflip/import-google-slides at version 0.1.0', () => {
    const pkgPath = resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name: string; version: string };
    expect(pkg.name).toBe('@stageflip/import-google-slides');
    expect(pkg.version).toBe('0.1.0');
  });
});
