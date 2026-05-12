// packages/audience-polleverywhere/src/provider.ts
// `PollEverywhereAudienceProvider` — vendor `AudienceBackendProvider` (T-479)
// wrapping PollEverywhere's hosted REST API. Stub-mode v1 per the P14
// reference-adapter convention; production wire-up (PollEverywhere REST
// integration) is gated on T-481a (PollEverywhere enterprise credentials +
// OAuth audit pending).
//
// All 4 methods throw `NotYetImplementedError` in production mode.
// Tests run against stub-mode which delegates to an injected stub
// client (mirrors `KokoroTtsProvider`'s mode discriminator pattern).

import type {
  AggregationSnapshot,
  AudienceBackendProvider,
  CloseSessionCall,
  FinalSnapshot,
  OpenSessionCall,
  SessionHandle,
  SubmitVoteCall,
  SubscribeCall,
  VoteAck,
} from '@stageflip/audience-contract';

import { audiencePollEverywhereDescriptor } from './descriptor.js';

/**
 * Discriminator for the provider mode.
 *
 * - `'stub'` (v1 default): synthesizes deterministic responses for
 *   tests. Production REST calls are NOT executed.
 * - `'production'`: real PollEverywhere REST API calls. NOT IMPLEMENTED in
 *   T-479 — methods throw `NotYetImplementedError`. Gated on T-481a.
 */
export type PollEverywhereProviderMode = 'stub' | 'production';

/**
 * Thrown by `PollEverywhereAudienceProvider` methods in `'production'` mode
 * until T-481a wires the PollEverywhere REST integration.
 */
export class NotYetImplementedError extends Error {
  override readonly name = 'NotYetImplementedError';
}

/** Construction options. Defaults to `{ mode: 'stub' }`. */
export interface PollEverywhereAudienceProviderOptions {
  readonly mode?: PollEverywhereProviderMode;
  /**
   * PollEverywhere API base URL. Defaults to the public hosted endpoint;
   * tenants with custom hosted plans override via this field.
   */
  readonly baseUrl?: string;
  /**
   * Injectable wall-clock for deterministic tests. Defaults to
   * `Date.now`.
   */
  readonly now?: () => number;
}

const DEFAULT_BASE_URL = 'https://api.polleverywhere.com/v1';

/**
 * Build the PollEverywhere `AudienceBackendProvider`. In `'stub'` mode, methods
 * return synthetic deterministic responses; in `'production'` mode,
 * methods throw `NotYetImplementedError` until T-481a ships the REST
 * integration.
 */
export function createPollEverywhereAudienceProvider(
  options: PollEverywhereAudienceProviderOptions = {},
): AudienceBackendProvider {
  const mode: PollEverywhereProviderMode = options.mode ?? 'stub';
  const _baseUrl: string = options.baseUrl ?? DEFAULT_BASE_URL;
  void _baseUrl; // reserved for T-481a production wire-up
  const now = options.now ?? (() => Date.now());

  function unsupportedKind(kind: string): boolean {
    return kind === 'heatmap' || kind === 'reaction-stream' || kind === 'audience-ai-prompt';
  }

  async function openSession(call: OpenSessionCall): Promise<SessionHandle> {
    if (unsupportedKind(call.clipKind)) {
      throw new Error(
        `audience-polleverywhere: clipKind '${call.clipKind}' not supported by PollEverywhere`,
      );
    }
    if (mode === 'production') {
      throw new NotYetImplementedError('PollEverywhere REST integration pending T-481a');
    }
    return {
      sessionId: call.sessionId,
      joinUrl: `https://app.polleverywhere.com/join/${call.sessionId}`,
      joinCode: call.sessionId.slice(0, 6).toUpperCase(),
    };
  }

  async function submitVote(call: SubmitVoteCall): Promise<VoteAck> {
    if (mode === 'production') {
      throw new NotYetImplementedError('PollEverywhere REST integration pending T-481a');
    }
    const serverTimestamp = new Date(now()).toISOString();
    return {
      eventId: `polleverywhere-evt-${serverTimestamp}-${call.voterToken.slice(0, 6)}`,
      serverTimestamp,
      accepted: true,
    };
  }

  function subscribe(_call: SubscribeCall): AsyncIterable<AggregationSnapshot> {
    if (mode === 'production') {
      throw new NotYetImplementedError('PollEverywhere REST integration pending T-481a');
    }
    // stub mode: yields nothing + returns immediately. Tests simulate
    // the subscription stream via an injected client when T-481a wires
    // the real path. Returning an empty `[Symbol.asyncIterator]`
    // implementation rather than an async generator avoids the
    // useYield lint warning since there's nothing to yield.
    return {
      [Symbol.asyncIterator]() {
        return {
          // biome-ignore lint/suspicious/useAwait: stub iterator has nothing to await
          async next() {
            return { value: undefined, done: true };
          },
        };
      },
    };
  }

  async function closeSession(call: CloseSessionCall): Promise<FinalSnapshot> {
    if (mode === 'production') {
      throw new NotYetImplementedError('PollEverywhere REST integration pending T-481a');
    }
    const closedAt = new Date(now()).toISOString();
    return {
      sessionId: call.sessionId,
      frameNo: 0,
      serverTimestamp: closedAt,
      voterCount: 0,
      // PollEverywhere does not report per-clip-kind aggregation shape to the
      // adapter at close; stub returns a placeholder shape downstream
      // consumers can detect by inspecting `closedAt`.
      aggregation: { kind: 'live-poll-multiple-choice' } as AggregationSnapshot['aggregation'],
      closedAt,
      snapshotFrame: 0,
    };
  }

  return {
    ...audiencePollEverywhereDescriptor,
    modality: { kind: 'audience-backend' as const },
    capability:
      audiencePollEverywhereDescriptor.capability as unknown as AudienceBackendProvider['capability'],
    openSession,
    submitVote,
    subscribe,
    closeSession,
  };
}
