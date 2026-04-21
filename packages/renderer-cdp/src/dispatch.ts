// packages/renderer-cdp/src/dispatch.ts
// Resolve every clip element in an RIRDocument to its (runtime, clip)
// definition via the shared runtime registry. Tree-order traversal;
// non-clip elements are skipped; nested groups recurse.
//
// This is the shared resolution layer for every CDP-side consumer (export
// adapter, preflight, parity). Decoupled from any browser/Puppeteer code —
// pure data in → pure data out.

import type { RIRDocument, RIRElement } from '@stageflip/rir';
import type { ClipDefinition, ClipRuntime } from '@stageflip/runtimes-contract';
import { findClip } from '@stageflip/runtimes-contract';

/**
 * A clip element whose `(runtime, clip)` pair was found in the registry and
 * whose declared runtime id matches the registered runtime's id.
 */
export interface DispatchedClip {
  readonly element: RIRElement;
  readonly runtime: ClipRuntime;
  readonly clip: ClipDefinition<unknown>;
}

/** Reason a clip element did not yield a DispatchedClip. */
export type UnresolvedReason =
  /** No registered runtime declares the clip kind. */
  | 'unknown-kind'
  /**
   * A registered runtime does declare the kind, but the clip element asks
   * for a different runtime id. This is almost always a compiler bug — the
   * element's `content.runtime` should equal the runtime that owns the
   * resolved kind. Surfaced explicitly so T-084+ can fail loud rather than
   * silently use the "wrong" runtime.
   */
  | 'runtime-mismatch';

export interface UnresolvedClip {
  readonly element: RIRElement;
  readonly reason: UnresolvedReason;
  readonly requestedRuntime: string;
  readonly requestedKind: string;
}

export interface DispatchPlan {
  readonly resolved: readonly DispatchedClip[];
  readonly unresolved: readonly UnresolvedClip[];
}

/**
 * Walk every element in the document (recursing into groups) and produce
 * a dispatch plan. Clip-content elements are resolved via `findClip(kind)`;
 * every other element type is skipped.
 */
export function dispatchClips(document: RIRDocument): DispatchPlan {
  const resolved: DispatchedClip[] = [];
  const unresolved: UnresolvedClip[] = [];

  visit(document.elements, resolved, unresolved);

  return { resolved, unresolved };
}

function visit(
  elements: readonly RIRElement[],
  resolved: DispatchedClip[],
  unresolved: UnresolvedClip[],
): void {
  for (const element of elements) {
    if (element.content.type === 'group') {
      visit(element.content.children, resolved, unresolved);
      continue;
    }

    if (element.content.type !== 'clip') continue;

    const requestedRuntime = element.content.runtime;
    const requestedKind = element.content.clipName;
    const hit = findClip(requestedKind);

    if (hit === null) {
      unresolved.push({
        element,
        reason: 'unknown-kind',
        requestedRuntime,
        requestedKind,
      });
      continue;
    }

    if (hit.runtime.id !== requestedRuntime) {
      unresolved.push({
        element,
        reason: 'runtime-mismatch',
        requestedRuntime,
        requestedKind,
      });
      continue;
    }

    resolved.push({ element, runtime: hit.runtime, clip: hit.clip });
  }
}
