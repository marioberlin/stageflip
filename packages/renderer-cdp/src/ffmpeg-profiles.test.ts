// packages/renderer-cdp/src/ffmpeg-profiles.test.ts

import { describe, expect, it } from 'vitest';

import {
  ENCODER_PROFILES,
  PROFILE_H264,
  PROFILE_H265,
  PROFILE_PRORES_4444,
  PROFILE_VP9,
  getEncoderProfile,
} from './ffmpeg-profiles';

describe('encoder profiles', () => {
  it('covers the four codecs T-085 promises', () => {
    expect(Object.keys(ENCODER_PROFILES).sort()).toEqual(['h264', 'h265', 'prores-4444', 'vp9']);
  });

  it('only prores-4444 carries alpha', () => {
    expect(PROFILE_H264.supportsAlpha).toBe(false);
    expect(PROFILE_H265.supportsAlpha).toBe(false);
    expect(PROFILE_VP9.supportsAlpha).toBe(false);
    expect(PROFILE_PRORES_4444.supportsAlpha).toBe(true);
  });

  it('containers are the codec-appropriate extensions', () => {
    expect(PROFILE_H264.containerExt).toBe('.mp4');
    expect(PROFILE_H265.containerExt).toBe('.mp4');
    expect(PROFILE_VP9.containerExt).toBe('.webm');
    expect(PROFILE_PRORES_4444.containerExt).toBe('.mov');
  });

  it('h264/h265/vp9 have CRF ranges; prores does not', () => {
    expect(PROFILE_H264.crfRange?.default).toBe(23);
    expect(PROFILE_H265.crfRange?.default).toBe(28);
    expect(PROFILE_VP9.crfRange?.default).toBe(31);
    expect(PROFILE_PRORES_4444.crfRange).toBeNull();
  });

  it('vp9 codec args include "-b:v 0" to unlock constant-quality mode', () => {
    // Without -b:v 0, libvpx-vp9 treats CRF as a ceiling on bitrate.
    // Leaving this out silently produces worse-looking videos at a given
    // CRF.
    const args = PROFILE_VP9.codecArgs;
    const idx = args.indexOf('-b:v');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(args[idx + 1]).toBe('0');
  });

  it('prores-4444 args select profile 4 with a 10-bit alpha pixel format', () => {
    const args = PROFILE_PRORES_4444.codecArgs;
    expect(args).toContain('prores_ks');
    expect(args).toContain('yuva444p10le');
    const profileIdx = args.indexOf('-profile:v');
    expect(profileIdx).toBeGreaterThanOrEqual(0);
    expect(args[profileIdx + 1]).toBe('4'); // 4 = ProRes 4444
  });

  it('getEncoderProfile looks up by id; throws on unknown', () => {
    expect(getEncoderProfile('h264')).toBe(PROFILE_H264);
    expect(getEncoderProfile('prores-4444')).toBe(PROFILE_PRORES_4444);
    // @ts-expect-error — intentional bad id
    expect(() => getEncoderProfile('av1')).toThrow(/unknown profile/);
  });
});
