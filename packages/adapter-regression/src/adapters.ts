// packages/adapter-regression/src/adapters.ts
// Wires the 9 reference adapter packages into the `RegressableAdapter`
// shape the snapshot-runner consumes (T-435).
//
// Each adapter constructor accepts an optional options object; we
// instantiate in stub mode (the default). Each adapter has a different
// invocation method (`synthesize` for TTS; `generate` for video/music/
// sfx/three-d) — this module unifies them behind `invoke()`.

import { MeshyThreeDProvider, meshyDescriptor } from '@stageflip/3d-meshy';
import { TripoThreeDProvider, tripoDescriptor } from '@stageflip/3d-tripo';
import { AceStepMusicProvider, aceStepDescriptor } from '@stageflip/music-acestep';
import { YueMusicProvider, yueDescriptor } from '@stageflip/music-yue';
import { StableAudioSfxProvider, stableAudioDescriptor } from '@stageflip/sfx-stable-audio';
import { FishSpeechTtsProvider, fishSpeechDescriptor } from '@stageflip/tts-fish-speech';
import { KokoroTtsProvider, kokoroDescriptor } from '@stageflip/tts-kokoro';
import { RunwayVideoProvider, runwayDescriptor } from '@stageflip/video-runway';
import { SeedanceVideoProvider, seedanceDescriptor } from '@stageflip/video-seedance';

import type { AdapterId } from './canonical-input.js';
import type { CanonicalInput } from './canonical-input.js';
import type { RegressableAdapter } from './snapshot-runner.js';

/**
 * Build a `RegressableAdapter` for `adapterId`. The provider is
 * instantiated in stub mode; the `invoke()` wrapper dispatches to the
 * modality-specific method (`synthesize` / `generate`).
 *
 * Throws if `adapterId` is not one of the 9 in-tree reference adapters.
 */
export function buildAdapter(adapterId: AdapterId): RegressableAdapter {
  switch (adapterId) {
    case 'kokoro': {
      const provider = new KokoroTtsProvider();
      return {
        id: 'kokoro',
        descriptor: kokoroDescriptor,
        invoke: async (input) => provider.synthesize(toTtsCall(input)),
      };
    }
    case 'fish-speech': {
      const provider = new FishSpeechTtsProvider();
      return {
        id: 'fish-speech',
        descriptor: fishSpeechDescriptor,
        invoke: async (input) => provider.synthesize(toTtsCall(input)),
      };
    }
    case 'tripo': {
      const provider = new TripoThreeDProvider();
      return {
        id: 'tripo',
        descriptor: tripoDescriptor,
        invoke: async (input) => provider.generate(toThreeDCall(input)),
      };
    }
    case 'meshy': {
      const provider = new MeshyThreeDProvider();
      return {
        id: 'meshy',
        descriptor: meshyDescriptor,
        invoke: async (input) => provider.generate(toThreeDCall(input)),
      };
    }
    case 'seedance': {
      const provider = new SeedanceVideoProvider();
      return {
        id: 'seedance',
        descriptor: seedanceDescriptor,
        invoke: async (input) => provider.generate(toVideoCall(input)),
      };
    }
    case 'runway': {
      const provider = new RunwayVideoProvider();
      return {
        id: 'runway',
        descriptor: runwayDescriptor,
        invoke: async (input) => provider.generate(toVideoCall(input)),
      };
    }
    case 'ace-step': {
      const provider = new AceStepMusicProvider();
      return {
        id: 'ace-step',
        descriptor: aceStepDescriptor,
        invoke: async (input) => provider.generate(toMusicCall(input)),
      };
    }
    case 'yue': {
      const provider = new YueMusicProvider();
      return {
        id: 'yue',
        descriptor: yueDescriptor,
        invoke: async (input) => provider.generate(toMusicCall(input)),
      };
    }
    case 'stable-audio-open': {
      const provider = new StableAudioSfxProvider();
      return {
        id: 'stable-audio-open',
        descriptor: stableAudioDescriptor,
        invoke: async (input) => provider.generate(toSfxCall(input)),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Per-modality input-shape narrowing
// ---------------------------------------------------------------------------
// The canonical-input fixtures are typed as `Record<string, unknown>`
// (modality-discriminated by adapter id, not by TypeScript). These
// narrowing helpers re-type each fixture to the strict per-call shape
// each provider expects.

interface TtsCallShape {
  readonly tenantId: string;
  readonly voiceId: string;
  readonly text: string;
  readonly outputFormat: 'wav';
  readonly sampleRate: number;
  readonly seed?: number;
}

interface VideoCallShape {
  readonly prompt: string;
  readonly aspectRatio: string;
  readonly frameRate: number;
  readonly durationS: number;
  readonly outputFormat: 'mp4';
  readonly seed?: number;
}

interface MusicCallShape {
  readonly prompt: string;
  readonly durationS: number;
  readonly outputFormat: 'wav';
  readonly seed?: number;
}

interface SfxCallShape {
  readonly prompt: string;
  readonly durationS: number;
  readonly outputFormat: 'wav';
  readonly sampleRate: number;
  readonly seed?: number;
}

interface ThreeDCallShape {
  readonly prompt: string;
  readonly rig?: boolean;
  readonly seed?: number;
}

function toTtsCall(input: CanonicalInput): TtsCallShape {
  return {
    tenantId: input.tenantId as string,
    voiceId: input.voiceId as string,
    text: input.text as string,
    outputFormat: input.outputFormat as 'wav',
    sampleRate: input.sampleRate as number,
    ...(input.seed !== undefined ? { seed: input.seed as number } : {}),
  };
}

function toVideoCall(input: CanonicalInput): VideoCallShape {
  return {
    prompt: input.prompt as string,
    aspectRatio: input.aspectRatio as string,
    frameRate: input.frameRate as number,
    durationS: input.durationS as number,
    outputFormat: input.outputFormat as 'mp4',
    ...(input.seed !== undefined ? { seed: input.seed as number } : {}),
  };
}

function toMusicCall(input: CanonicalInput): MusicCallShape {
  return {
    prompt: input.prompt as string,
    durationS: input.durationS as number,
    outputFormat: input.outputFormat as 'wav',
    ...(input.seed !== undefined ? { seed: input.seed as number } : {}),
  };
}

function toSfxCall(input: CanonicalInput): SfxCallShape {
  return {
    prompt: input.prompt as string,
    durationS: input.durationS as number,
    outputFormat: input.outputFormat as 'wav',
    sampleRate: input.sampleRate as number,
    ...(input.seed !== undefined ? { seed: input.seed as number } : {}),
  };
}

function toThreeDCall(input: CanonicalInput): ThreeDCallShape {
  return {
    prompt: input.prompt as string,
    ...(input.rig !== undefined ? { rig: input.rig as boolean } : {}),
    ...(input.seed !== undefined ? { seed: input.seed as number } : {}),
  };
}
