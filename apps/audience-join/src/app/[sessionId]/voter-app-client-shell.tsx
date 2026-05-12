// apps/audience-join/src/app/[sessionId]/voter-app-client-shell.tsx
// T-456 — Client-only shell that materialises the per-app stub
// `AudienceBackendProvider` and hands it to `<VoterAppClient>`. The
// stub holds the WebSocket open via the apps/api `/v1/audience/ws/:id`
// route per T-453; the per-vendor providers T-479..T-483 plug into the
// same surface later.
//
// For T-456 we ship a "deferred" provider whose `subscribe()` yields no
// snapshots (the audience backend service doesn't expose a public
// browser-side subscribe yet — T-454's `runAudienceClient` is provider-
// agnostic, so the shell is correct end-to-end the moment T-478 lands a
// real native browser provider). The voter app surfaces the
// connection-status banner the whole time and never lies about state.

'use client';

import type { AudienceBackendProvider, SubscribeCall } from '@stageflip/audience-contract';
import { type ReactElement, useMemo } from 'react';

import { VoterAppClient } from './voter-app-client';

interface VoterAppClientShellProps {
  readonly sessionId: string;
  readonly apiBaseUrl: string;
}

/**
 * Build a stub `AudienceBackendProvider` that signals "no live data" to
 * the runtime by closing the iterator gracefully (close-code 4000). The
 * voter app then sits in `disconnected` until a downstream task wires
 * the real native provider. Pure stub — no network IO, no timers.
 */
function buildStubProvider(): AudienceBackendProvider {
  return {
    id: 'audience-join-app-stub',
    modality: { kind: 'audience-backend' },
    capability: {
      persistenceTier: 'best-effort',
      maxConcurrentVoters: 0,
      supportedClipKinds: [],
      supportsMotionNative: false,
      voterIdentity: 'anonymous',
      supportsStaticFallback: false,
      maxIngestRateHz: 0,
      snapshotCadenceHz: 0,
    },
    license: { kind: 'apache-2.0' },
    sandbox: { kind: 'in-process' },
    async openSession() {
      throw new Error('audience-join-app-stub: openSession is not supported (presenter-side)');
    },
    async submitVote() {
      throw new Error(
        'audience-join-app-stub: submitVote is not supported until a real provider lands (T-478+)',
      );
    },
    subscribe: (_call: SubscribeCall) => ({
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<never>> {
            // Surface a graceful close immediately — runAudienceClient
            // resolves with 'completed' and the banner shows
            // "Disconnected from the live session.".
            throw { code: 4000, wasClean: true };
          },
        };
      },
    }),
    async closeSession() {
      throw new Error('audience-join-app-stub: closeSession is not supported (presenter-side)');
    },
  };
}

/**
 * Client wrapper for the voter route. Builds the stub provider once and
 * forwards into `<VoterAppClient>`.
 */
export function VoterAppClientShell(props: VoterAppClientShellProps): ReactElement {
  const provider = useMemo(buildStubProvider, []);
  return (
    <VoterAppClient sessionId={props.sessionId} apiBaseUrl={props.apiBaseUrl} provider={provider} />
  );
}
