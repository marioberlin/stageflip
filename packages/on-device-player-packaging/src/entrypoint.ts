// packages/on-device-player-packaging/src/entrypoint.ts
// Boot scaffold (T-400). The on-device player binary's `main()` calls
// `bootOnDevicePlayer(...)` exactly once at startup. The scaffold:
//   1. Reads + validates the manifest (throws → 'manifest-invalid').
//   2. Verifies the binary's signature against
//      `manifest.codeSigningPolicy` (caller-supplied verifier — the
//      production binary wires the OS-specific signature-fetch path).
//   3. Checks the device's `DisplayDeviceCapability` against the
//      manifest's `enabledClipFamilies` (e.g. shader enabled but device
//      has no GPU → 'capability-mismatch').
//   4. Constructs the runtime shim, calls `boot()`, returns the handle.

import type {
  DisplayDeviceCapability,
  OnDevicePlayerShim,
  TelemetryEvent,
} from '@stageflip/runtime-on-device-player';

import type { SignatureVerifyResult } from './code-signing.js';
import {
  type OnDeviceBinaryManifest,
  OnDeviceBinaryManifestParseError,
  readManifest,
} from './manifest.js';

/** Result of `bootOnDevicePlayer`. */
export interface EntrypointBootResult {
  readonly status: 'booted' | 'manifest-invalid' | 'signature-rejected' | 'capability-mismatch';
  readonly shim?: OnDevicePlayerShim;
  readonly reason?: string;
}

/** Arguments to `bootOnDevicePlayer`. */
export interface BootOnDevicePlayerArgs {
  readonly manifestPath: string;
  readonly device: DisplayDeviceCapability;
  readonly emitTelemetry: (event: TelemetryEvent) => void;
  readonly clock: () => number;
  /**
   * Optional injected signature verifier. The production binary wires
   * the OS-specific download-+-verify path against the policy in the
   * manifest. Tests inject a stub. When omitted, the default rejects
   * with `'signature-missing'` because the scaffold does not download
   * binary bytes itself.
   */
  readonly verifySignature?: (manifest: OnDeviceBinaryManifest) => SignatureVerifyResult;
  /**
   * Optional shim factory. Production wires the real
   * `createOnDevicePlayerShim` with a binary-built `InteractiveMount
   * Harness`. Tests inject stubs. When omitted, the scaffold throws
   * because no harness is available in this layer.
   */
  readonly createShim?: () => OnDevicePlayerShim;
}

/**
 * Per-family hardware requirement table. Restated here rather than
 * imported from the runtime shim's internal table so the capability-
 * pre-check on boot is independent of the shim's per-mount gate. The
 * two tables MUST agree; the test suite cross-checks the manifest's
 * `enabledClipFamilies` reachability via this table.
 */
const FAMILY_REQUIREMENTS: Readonly<Record<string, ReadonlyArray<keyof DisplayDeviceCapability>>> =
  {
    shader: ['hasGpu'],
    'three-scene': ['hasGpu'],
    voice: ['hasMicrophone'],
    'ai-chat': ['hasNetwork'],
    'live-data': ['hasNetwork'],
    'web-embed': ['hasNetwork'],
    'ai-generative': ['hasNetwork'],
  };

/**
 * Check that the device's capability bits cover every enabled clip
 * family in the manifest. Returns `null` on success; otherwise an
 * object naming the first family + missing capability bit so the
 * binary can surface a precise operator diagnostic.
 */
function evaluateCapabilityCoverage(args: {
  readonly device: DisplayDeviceCapability;
  readonly enabledClipFamilies: ReadonlyArray<string>;
}): { readonly family: string; readonly missing: string } | null {
  for (const family of args.enabledClipFamilies) {
    const required = FAMILY_REQUIREMENTS[family] ?? [];
    for (const key of required) {
      if (args.device[key] !== true) {
        return { family, missing: key };
      }
    }
  }
  return null;
}

const DEFAULT_VERIFY_SIGNATURE: (manifest: OnDeviceBinaryManifest) => SignatureVerifyResult = (
  _manifest,
) => ({ verified: false, reason: 'signature-missing' });

function defaultCreateShim(): OnDevicePlayerShim {
  throw new Error(
    'bootOnDevicePlayer: no `createShim` injected. The production binary must supply a factory that constructs the runtime shim against a binary-built InteractiveMountHarness.',
  );
}

/**
 * The on-device player binary's boot scaffold. See module header for
 * the four-step sequence.
 */
export async function bootOnDevicePlayer(
  args: BootOnDevicePlayerArgs,
): Promise<EntrypointBootResult> {
  // Step 1 — manifest.
  let manifest: OnDeviceBinaryManifest;
  try {
    manifest = readManifest(args.manifestPath);
  } catch (err) {
    if (err instanceof OnDeviceBinaryManifestParseError) {
      return { status: 'manifest-invalid', reason: err.message };
    }
    throw err;
  }

  // Step 2 — signature.
  const verifySignature = args.verifySignature ?? DEFAULT_VERIFY_SIGNATURE;
  const sig = verifySignature(manifest);
  if (!sig.verified) {
    // `enforce === 'warn'` is handled by the caller's verifier (it
    // returns `verified: true, reason: 'verified'` and emits its own
    // warning telemetry); `'off'` short-circuits inside the verifier;
    // `'strict'` is the only mode that reaches this branch.
    return {
      status: 'signature-rejected',
      reason: `code-signing rejected: ${sig.reason}`,
    };
  }

  // Step 3 — capability coverage.
  const cap = evaluateCapabilityCoverage({
    device: args.device,
    enabledClipFamilies: manifest.enabledClipFamilies,
  });
  if (cap !== null) {
    return {
      status: 'capability-mismatch',
      reason: `enabled clip family '${cap.family}' requires device capability '${cap.missing}'`,
    };
  }

  // Step 4 — shim boot.
  const createShim = args.createShim ?? defaultCreateShim;
  const shim = createShim();
  shim.boot({
    device: args.device,
    emitTelemetry: args.emitTelemetry,
    clock: args.clock,
  });
  return { status: 'booted', shim };
}
