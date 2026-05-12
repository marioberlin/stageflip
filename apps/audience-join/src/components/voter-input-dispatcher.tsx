// apps/audience-join/src/components/voter-input-dispatcher.tsx
// T-456 — Per-clip-kind voter UI dispatcher. Switches on `clipKind` and
// renders the registered voter input component, or a generic
// `<UnregisteredKindFallback>` for kinds not yet wired (T-461..T-471
// each register their per-kind UI alongside the clip definition).
//
// T-456 ships an EMPTY registry — every kind currently falls through to
// the placeholder. The shape mirrors `audienceClipRegistry` from
// `@stageflip/runtimes-audience` so the registration call site is
// consistent across editor + voter app.

'use client';

import type { AudienceClipKind } from '@stageflip/audience-contract';
import type { ComponentType, ReactElement } from 'react';

/**
 * Props handed to every per-kind voter input. The dispatcher itself is
 * shape-agnostic; per-kind components widen the contract as needed.
 */
export interface VoterInputProps {
  readonly sessionId: string;
  readonly clipKind: AudienceClipKind;
}

/**
 * Inputs for `<VoterInputDispatcher>`. The registry is supplied so
 * tests can inject stubs without polluting the module-level singleton.
 * Production callers pass `defaultVoterInputRegistry`.
 */
export interface VoterInputDispatcherProps extends VoterInputProps {
  readonly registry?: VoterInputRegistry;
}

/** Type of the per-kind voter input registry. */
export type VoterInputRegistry = ReadonlyMap<AudienceClipKind, ComponentType<VoterInputProps>>;

/**
 * Default registry — empty in T-456. T-461..T-471 add entries as their
 * per-kind UIs land. Exported so the voter app's `<VoterAppClient>` can
 * pass it in, and so tests can verify the empty-default contract.
 */
export const defaultVoterInputRegistry: VoterInputRegistry = new Map<
  AudienceClipKind,
  ComponentType<VoterInputProps>
>();

/**
 * Generic placeholder rendered when no per-kind component is registered
 * for the supplied `clipKind`. Will fire for every kind in T-456; the
 * registry fills in over T-461..T-471.
 */
export function UnregisteredKindFallback(props: VoterInputProps): ReactElement {
  return (
    <section data-testid="voter-input-unregistered" data-clip-kind={props.clipKind}>
      <h2>Voting unavailable</h2>
      <p>
        Voting for clip kind <code>{props.clipKind}</code> is not yet available in this build.
      </p>
    </section>
  );
}

/**
 * Renders the per-kind voter input for `clipKind`, falling back to
 * `<UnregisteredKindFallback>` when no registry entry is present.
 */
export function VoterInputDispatcher(props: VoterInputDispatcherProps): ReactElement {
  const { registry = defaultVoterInputRegistry, sessionId, clipKind } = props;
  const Component = registry.get(clipKind);
  if (Component === undefined) {
    return <UnregisteredKindFallback sessionId={sessionId} clipKind={clipKind} />;
  }
  return <Component sessionId={sessionId} clipKind={clipKind} />;
}
