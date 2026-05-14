// packages/on-device-player-packaging/src/package-os.test.ts
// Tests for per-OS package descriptor schema + first-class partitioning.

import { describe, expect, it } from 'vitest';

import {
  FIRST_CLASS_TARGETS,
  type PackageOsTarget,
  isFirstClass,
  packageDescriptorSchema,
  packageOsTargetSchema,
} from './package-os.js';

describe('packageOsTargetSchema', () => {
  it('accepts each of the 7 declared targets', () => {
    const allTargets: PackageOsTarget[] = [
      'linux-x64',
      'linux-arm64',
      'embedded-linux-arm',
      'darwin-x64',
      'darwin-arm64',
      'win32-x64',
      'android-arm64',
    ];
    for (const target of allTargets) {
      expect(packageOsTargetSchema.safeParse(target).success, target).toBe(true);
    }
  });
  it('rejects unknown targets', () => {
    expect(packageOsTargetSchema.safeParse('linux-mips').success).toBe(false);
  });
});

describe('FIRST_CLASS_TARGETS', () => {
  it('contains exactly the 3 Linux variants', () => {
    expect(FIRST_CLASS_TARGETS).toEqual(['linux-x64', 'linux-arm64', 'embedded-linux-arm']);
    expect(FIRST_CLASS_TARGETS).toHaveLength(3);
  });
});

describe('isFirstClass', () => {
  it('returns true for first-class Linux targets', () => {
    expect(isFirstClass('linux-x64')).toBe(true);
    expect(isFirstClass('linux-arm64')).toBe(true);
    expect(isFirstClass('embedded-linux-arm')).toBe(true);
  });
  it('returns false for stub targets', () => {
    expect(isFirstClass('darwin-x64')).toBe(false);
    expect(isFirstClass('darwin-arm64')).toBe(false);
    expect(isFirstClass('win32-x64')).toBe(false);
    expect(isFirstClass('android-arm64')).toBe(false);
  });
});

describe('packageDescriptorSchema', () => {
  it('accepts a first-class Linux descriptor', () => {
    const r = packageDescriptorSchema.safeParse({
      target: 'linux-x64',
      binaryPath: 'bin/stageflip-player',
      manifestPath: 'manifest.json',
      format: 'tar.gz',
      tier: 'first-class',
    });
    expect(r.success).toBe(true);
  });

  it('accepts a stub macOS descriptor', () => {
    const r = packageDescriptorSchema.safeParse({
      target: 'darwin-arm64',
      binaryPath: 'StageFlip Player.app/Contents/MacOS/stageflip-player',
      manifestPath: 'StageFlip Player.app/Contents/Resources/manifest.json',
      format: 'dmg',
      tier: 'stub',
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown format', () => {
    const r = packageDescriptorSchema.safeParse({
      target: 'linux-x64',
      binaryPath: 'bin/stageflip-player',
      manifestPath: 'manifest.json',
      // biome-ignore lint/suspicious/noExplicitAny: deliberate bad input
      format: 'snap' as any,
      tier: 'first-class',
    });
    expect(r.success).toBe(false);
  });

  it('rejects extra keys (.strict())', () => {
    const r = packageDescriptorSchema.safeParse({
      target: 'linux-x64',
      binaryPath: 'bin/stageflip-player',
      manifestPath: 'manifest.json',
      format: 'tar.gz',
      tier: 'first-class',
      extraneous: 'oops',
    });
    expect(r.success).toBe(false);
  });
});
