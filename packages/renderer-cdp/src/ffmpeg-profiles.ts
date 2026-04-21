// packages/renderer-cdp/src/ffmpeg-profiles.ts
// Encoder profile definitions per T-085. Each profile is a static record
// describing the codec, container extension, pixel format, alpha support,
// CRF range, and quality default. Rendered into ffmpeg argv by
// `ffmpeg-encoder.ts`.
//
// Default CRF values: the ffmpeg defaults for the respective codecs
// (libx264=23, libx265=28, libvpx-vp9=31 with -b:v 0 "constant quality"
// mode). ProRes is not CRF-based — it uses a fixed profile level; the
// `crf` knob is ignored.

export type EncoderProfileId = 'h264' | 'h265' | 'vp9' | 'prores-4444';

export interface EncoderProfile {
  readonly id: EncoderProfileId;
  /** Output container extension, including the leading dot. */
  readonly containerExt: '.mp4' | '.webm' | '.mov';
  /** Whether the pixel format carries an alpha channel. */
  readonly supportsAlpha: boolean;
  /**
   * Static codec-selection flags (before the output path). Does not
   * include CRF or rate-control flags — those are added per-call based
   * on caller knobs.
   */
  readonly codecArgs: readonly string[];
  /**
   * CRF range. Lower is higher quality / larger file. null means the
   * profile does not use CRF (ProRes).
   */
  readonly crfRange: {
    readonly min: number;
    readonly max: number;
    readonly default: number;
  } | null;
}

export const PROFILE_H264: EncoderProfile = {
  id: 'h264',
  containerExt: '.mp4',
  supportsAlpha: false,
  codecArgs: ['-c:v', 'libx264', '-pix_fmt', 'yuv420p'],
  crfRange: { min: 0, max: 51, default: 23 },
} as const;

export const PROFILE_H265: EncoderProfile = {
  id: 'h265',
  containerExt: '.mp4',
  supportsAlpha: false,
  codecArgs: ['-c:v', 'libx265', '-pix_fmt', 'yuv420p', '-tag:v', 'hvc1'],
  crfRange: { min: 0, max: 51, default: 28 },
} as const;

export const PROFILE_VP9: EncoderProfile = {
  id: 'vp9',
  containerExt: '.webm',
  supportsAlpha: false,
  // `-b:v 0` unlocks constant-quality mode; without it libvpx-vp9 treats
  // CRF as a ceiling on a two-pass bitrate target.
  codecArgs: ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-b:v', '0'],
  crfRange: { min: 0, max: 63, default: 31 },
} as const;

export const PROFILE_PRORES_4444: EncoderProfile = {
  id: 'prores-4444',
  containerExt: '.mov',
  supportsAlpha: true,
  // `-profile:v 4` = ProRes 4444. `yuva444p10le` preserves the alpha
  // channel at 10 bits per sample — StageFlip's over-the-top / alpha-
  // compositing target.
  codecArgs: ['-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le'],
  crfRange: null,
} as const;

export const ENCODER_PROFILES: Readonly<Record<EncoderProfileId, EncoderProfile>> = {
  h264: PROFILE_H264,
  h265: PROFILE_H265,
  vp9: PROFILE_VP9,
  'prores-4444': PROFILE_PRORES_4444,
};

/** Look up a profile by id. Throws on unknown id. */
export function getEncoderProfile(id: EncoderProfileId): EncoderProfile {
  const profile = ENCODER_PROFILES[id];
  if (profile === undefined) {
    throw new Error(`getEncoderProfile: unknown profile id '${id}'`);
  }
  return profile;
}
