// packages/render-farm/src/state-markers.test.ts
// State-marker protocol unit tests (T-266 D-T266-5).

import { describe, expect, it } from 'vitest';

import { buildFinishedMarker, buildStartedMarker, parseMarkerLine } from './state-markers.js';

describe('state-markers', () => {
  describe('buildStartedMarker', () => {
    it('formats as STAGEFLIP_RENDER_FARM_STARTED bakeId=<id>', () => {
      expect(buildStartedMarker('bake-1')).toBe('STAGEFLIP_RENDER_FARM_STARTED bakeId=bake-1');
    });
  });

  describe('buildFinishedMarker', () => {
    it('formats success', () => {
      expect(buildFinishedMarker({ bakeId: 'b', status: 'succeeded' })).toBe(
        'STAGEFLIP_RENDER_FARM_FINISHED bakeId=b status=succeeded',
      );
    });
    it('formats failure with error', () => {
      expect(buildFinishedMarker({ bakeId: 'b', status: 'failed', error: 'boom' })).toBe(
        'STAGEFLIP_RENDER_FARM_FINISHED bakeId=b status=failed error=boom',
      );
    });
    it('strips newlines from error', () => {
      expect(buildFinishedMarker({ bakeId: 'b', status: 'failed', error: 'line1\nline2' })).toBe(
        'STAGEFLIP_RENDER_FARM_FINISHED bakeId=b status=failed error=line1 line2',
      );
    });
  });

  describe('parseMarkerLine', () => {
    it('parses started markers', () => {
      expect(parseMarkerLine('STAGEFLIP_RENDER_FARM_STARTED bakeId=abc')).toEqual({
        kind: 'started',
        bakeId: 'abc',
      });
    });
    it('parses finished succeeded markers', () => {
      expect(parseMarkerLine('STAGEFLIP_RENDER_FARM_FINISHED bakeId=abc status=succeeded')).toEqual(
        { kind: 'finished', bakeId: 'abc', status: 'succeeded' },
      );
    });
    it('parses finished failed markers with error', () => {
      expect(
        parseMarkerLine('STAGEFLIP_RENDER_FARM_FINISHED bakeId=abc status=failed error=oops'),
      ).toEqual({ kind: 'finished', bakeId: 'abc', status: 'failed', error: 'oops' });
    });
    it('parses error= as the rest-of-line (allows spaces)', () => {
      expect(
        parseMarkerLine('STAGEFLIP_RENDER_FARM_FINISHED bakeId=x status=failed error=a b c'),
      ).toEqual({ kind: 'finished', bakeId: 'x', status: 'failed', error: 'a b c' });
    });
    it('returns null for non-marker lines', () => {
      expect(parseMarkerLine('regular log line')).toBeNull();
      expect(parseMarkerLine('')).toBeNull();
      expect(parseMarkerLine('   ')).toBeNull();
    });
    it('rejects malformed status', () => {
      expect(parseMarkerLine('STAGEFLIP_RENDER_FARM_FINISHED bakeId=x status=bogus')).toBeNull();
    });
    it('tolerates leading whitespace', () => {
      expect(parseMarkerLine('   STAGEFLIP_RENDER_FARM_STARTED bakeId=x')).toEqual({
        kind: 'started',
        bakeId: 'x',
      });
    });
    it('returns null when bakeId missing', () => {
      expect(parseMarkerLine('STAGEFLIP_RENDER_FARM_STARTED')).toBeNull();
      expect(parseMarkerLine('STAGEFLIP_RENDER_FARM_FINISHED status=succeeded')).toBeNull();
    });
  });
});
