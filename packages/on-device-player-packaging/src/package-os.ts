// packages/on-device-player-packaging/src/package-os.ts
// Per-OS package descriptor (T-400). Declares the seven recognised OS
// targets and partitions them into a `'first-class'` set (Linux x64,
// Linux ARM64, embedded Linux ARM — the DOOH / signage workhorses per
// ADR-005 §D4 + L141) and a `'stub'` set (macOS, Windows, Android —
// declared so the manifest schema is forward-compatible, but the
// downstream build pipeline does not produce these artifacts at MVP).

import { z } from 'zod';

/** Recognised package OS targets. */
export const packageOsTargetSchema = z.enum([
  'linux-x64',
  'linux-arm64',
  'embedded-linux-arm',
  'darwin-x64',
  'darwin-arm64',
  'win32-x64',
  'android-arm64',
]);

export type PackageOsTarget = z.infer<typeof packageOsTargetSchema>;

/**
 * Per-target package descriptor. `tier` is informational metadata for
 * the downstream build pipeline + the operator dashboard — the
 * production binary itself does not branch on `tier`. The downstream
 * build pipeline emits artifacts only for `'first-class'` targets;
 * `'stub'` descriptors document intent but produce no binary today.
 */
export const packageDescriptorSchema = z
  .object({
    target: packageOsTargetSchema,
    binaryPath: z.string().min(1),
    manifestPath: z.string().min(1),
    format: z.enum(['tar.gz', 'deb', 'apk', 'dmg', 'msi']),
    tier: z.enum(['first-class', 'stub']),
  })
  .strict();

export type PackageDescriptor = z.infer<typeof packageDescriptorSchema>;

/**
 * The three OS targets the on-device player ships as first-class at MVP
 * per ADR-005 §D4: Linux x64 + Linux ARM64 + embedded-Linux ARM cover
 * DOOH / digital signage / in-venue screens. The other four (macOS x2,
 * Windows x64, Android ARM64) are declared so the manifest is forward-
 * compatible but produce no artifact today.
 */
export const FIRST_CLASS_TARGETS: readonly PackageOsTarget[] = [
  'linux-x64',
  'linux-arm64',
  'embedded-linux-arm',
] as const;

/** Pure predicate. */
export function isFirstClass(target: PackageOsTarget): boolean {
  return FIRST_CLASS_TARGETS.includes(target);
}
