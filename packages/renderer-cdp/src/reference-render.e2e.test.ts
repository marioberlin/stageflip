// packages/renderer-cdp/src/reference-render.e2e.test.ts
// End-to-end reference render smoke (T-090). Guarded by
// `canRunReferenceRenders()` — skipped cleanly when Chrome, ffmpeg, or
// ffprobe are missing. Opt into the suite by:
//   - installing Chrome/Chromium at a standard path OR setting
//     PUPPETEER_EXECUTABLE_PATH=/path/to/chromium;
//   - having `ffmpeg` + `ffprobe` on PATH.
// CI wires these via the `render-e2e` job (T-119); `pnpm test` on a
// bare host runs only the unit + stub suites.
//
// When STAGEFLIP_E2E_ARTIFACT_DIR is set to a non-empty path, the
// rendered MP4s land there instead of a tmpdir and the cleanup step
// is skipped — CI uses this to upload the outputs as a build artifact.

import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { REFERENCE_FIXTURES, type ReferenceFixtureName } from './reference-fixtures';
import { canRunReferenceRenders, renderReferenceFixture } from './reference-render';

const capability = await canRunReferenceRenders();
const artifactDir = process.env.STAGEFLIP_E2E_ARTIFACT_DIR;
const keepArtifacts = artifactDir !== undefined && artifactDir.length > 0;

// If we can't run the real thing, skip the whole suite with a clear
// reason on the vitest output.
describe.skipIf(!capability.ok)(`reference render e2e (${capability.reason ?? 'ready'})`, () => {
  let workDir: string;

  beforeAll(async () => {
    if (keepArtifacts) {
      workDir = artifactDir as string;
      await mkdir(workDir, { recursive: true });
    } else {
      workDir = await mkdtemp(join(tmpdir(), 'stageflip-t090-e2e-'));
    }
  });

  afterAll(async () => {
    if (!keepArtifacts) {
      await rm(workDir, { recursive: true, force: true });
    }
  });

  for (const name of Object.keys(REFERENCE_FIXTURES) as readonly ReferenceFixtureName[]) {
    it(`renders ${name} end-to-end and emits a valid MP4 with matching stream metadata`, async () => {
      const doc = REFERENCE_FIXTURES[name];
      const outputPath = join(workDir, `${name}.mp4`);

      const { export: exportResult, probe } = await renderReferenceFixture({
        document: doc,
        outputPath,
        ...(capability.chromePath !== null ? { chromePath: capability.chromePath } : {}),
        ...(capability.ffmpegPath !== null ? { ffmpegPath: capability.ffmpegPath } : {}),
        ...(capability.ffprobePath !== null ? { ffprobePath: capability.ffprobePath } : {}),
      });

      // Exit criterion 1: every frame was rendered.
      expect(exportResult.framesRendered).toBe(doc.durationFrames);
      expect(exportResult.preflight.blockers).toHaveLength(0);

      // Exit criterion 2: the output file exists and is non-empty.
      const st = await stat(outputPath);
      expect(st.size).toBeGreaterThan(0);

      // Exit criterion 3: ffprobe reports a valid MP4 with the right
      // dimensions, frame rate, and duration.
      expect(probe.format.formatName).toContain('mp4');
      const video = probe.streams.find((s) => s.codecType === 'video');
      expect(video).toBeDefined();
      expect(video?.codecName).toBe('h264');
      expect(video?.width).toBe(doc.width);
      expect(video?.height).toBe(doc.height);
      expect(video?.pixFmt).toBe('yuv420p');

      // Duration should be within one frame of (durationFrames / fps).
      const expectedSec = doc.durationFrames / doc.frameRate;
      const tolerance = 1 / doc.frameRate;
      expect(probe.format.durationSec ?? 0).toBeGreaterThan(expectedSec - tolerance);
      expect(probe.format.durationSec ?? 0).toBeLessThan(expectedSec + tolerance);
    }, 60_000);
  }
});
