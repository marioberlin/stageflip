// apps/audience-join/src/app/[sessionId]/voter-app-client.tsx
// T-456 — Client component holding the voter-side WebSocket lifecycle.
// On mount:
//   1. POST /v1/audience/sessions/:sessionId/join → mint a voter token.
//   2. Open `runAudienceClient` against an `AudienceBackendProvider`
//      injected via props (defaults to a thin `fetch` + `EventSource`-
//      style adapter the voter app supplies — but T-456's substrate
//      ships a stub provider that connects via the native WebSocket
//      route the apps/api exposes; the per-vendor providers
//      T-479..T-483 land later).
//   3. Drive the per-clip-kind voter UI through `<VoterInputDispatcher>`
//      once the first aggregation snapshot identifies the kind.
//
// Browser-only. Outside the determinism perimeter (CLAUDE.md §3) — this
// is presentation code in an `apps/**` voter app.

'use client';

import type {
  AggregationSnapshot,
  AudienceBackendProvider,
  AudienceClipKind,
} from '@stageflip/audience-contract';
import { type AudienceLossFlagEmission, runAudienceClient } from '@stageflip/runtimes-audience';
import { type ReactElement, useEffect, useState } from 'react';

import {
  type ConnectionState,
  ConnectionStatusBanner,
} from '../../components/connection-status-banner';
import { VoterInputDispatcher } from '../../components/voter-input-dispatcher';

/** Inputs for `<VoterAppClient>`. */
export interface VoterAppClientProps {
  readonly sessionId: string;
  /**
   * Base URL of the apps/api host (e.g. `https://api.stageflip.app` or
   * `http://localhost:3001` for dev). Used to mint voter tokens.
   */
  readonly apiBaseUrl: string;
  /**
   * Audience backend provider supplying `subscribe()` for the live
   * snapshot stream. In production the routing engine picks the right
   * provider per session; in tests, a stub provider is injected.
   */
  readonly provider: AudienceBackendProvider;
  /**
   * Optional `fetch` override. Defaults to `globalThis.fetch`. Tests
   * inject a stub. Spec'd as a separate option (rather than reading
   * `globalThis.fetch` directly) so the join-call path is explicit and
   * test-injectable.
   */
  readonly fetchFn?: typeof fetch;
}

interface JoinResponse {
  readonly voterToken: string;
  readonly sessionId: string;
}

/**
 * Voter-side React client. Handles join → subscribe → render lifecycle.
 */
export function VoterAppClient(props: VoterAppClientProps): ReactElement {
  const { sessionId, apiBaseUrl, provider, fetchFn = globalThis.fetch } = props;

  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [errorDetail, setErrorDetail] = useState<string>('');
  const [connectionLost, setConnectionLost] = useState(false);
  const [clipKind, setClipKind] = useState<AudienceClipKind | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    async function run(): Promise<void> {
      setConnectionState('joining');
      let voterToken: string;
      try {
        const url = `${apiBaseUrl.replace(/\/+$/, '')}/v1/audience/sessions/${encodeURIComponent(sessionId)}/join`;
        const res = await fetchFn(url, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'content-type': 'application/json' },
        });
        if (!res.ok) {
          throw new Error(`join request failed (${res.status})`);
        }
        const body = (await res.json()) as JoinResponse;
        voterToken = body.voterToken;
      } catch (err) {
        if (controller.signal.aborted) return;
        if (mounted) {
          setConnectionState('error');
          setErrorDetail(err instanceof Error ? err.message : String(err));
        }
        return;
      }

      if (!mounted) return;
      setConnectionState('connecting');

      const onSnapshot = (snapshot: AggregationSnapshot): void => {
        if (!mounted) return;
        // setState with the same value is a no-op, so we don't need
        // to read `clipKind` from the closure (which would be stale).
        setClipKind(snapshot.aggregation.kind as AudienceClipKind);
        setConnectionState('connected');
      };

      const emitLossFlag = (emission: AudienceLossFlagEmission): void => {
        if (!mounted) return;
        if (emission.code === 'LF-AUDIENCE-CONNECTION-LOST') {
          setConnectionLost(true);
        }
      };

      await runAudienceClient({
        provider,
        subscribeCall: { sessionId, authToken: voterToken },
        onSnapshot,
        emitLossFlag,
        signal: controller.signal,
        onReconnectAttempt: () => {
          if (mounted) setConnectionState('reconnecting');
        },
      });

      if (!mounted) return;
      // Both 'completed' and 'budget-exhausted' are terminal — voters
      // see "Disconnected from the live session." The loss-flag span
      // (set via `emitLossFlag` above) distinguishes
      // budget-exhausted from a graceful close.
      setConnectionState('disconnected');
    }

    run();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [sessionId, apiBaseUrl, provider, fetchFn]);

  return (
    <main data-testid="voter-app">
      <h1>StageFlip live session</h1>
      <ConnectionStatusBanner
        state={connectionState}
        detail={errorDetail}
        connectionLost={connectionLost}
      />
      {clipKind !== null ? (
        <VoterInputDispatcher sessionId={sessionId} clipKind={clipKind} />
      ) : null}
    </main>
  );
}
