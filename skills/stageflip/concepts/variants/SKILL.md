---
title: Variants — message × locale matrix over RIR
id: skills/stageflip/concepts/variants
tier: concept
status: substantive
last_updated: 2026-04-29
owner_task: T-386
related:
  - skills/stageflip/concepts/rir/SKILL.md
  - skills/stageflip/concepts/schema/SKILL.md
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/tools/arrange-variants/SKILL.md
---

# Variants — message × locale matrix over RIR

Variant generation is the StageFlip primitive that turns **one** canonical
Document into **N** transformed Documents per a `VariantMatrixSpec`. It is
the differentiator for ad-tech / marketing / display-mode workflows where
teams ship hundreds of permutations from a single source. Per ADR-005 §D6
variant-gen operates over RIR trees that may include interactive clips;
the export-matrix routing layer (T-408) consumes variant outputs and
routes per ADR-003 §D4.

## Where it lives

- `@stageflip/variant-gen` — the transformation library. Browser-safe;
  editor surfaces import it directly.
- `@stageflip/schema/variants` — `variantMatrixSpecSchema` +
  `Document.variantSlots` Zod surfaces. Pure Zod, browser-safe.
- `@stageflip/engine`'s `arrange-variants` bundle — the agent-tool surface
  (`arrange_variants`) for the planner/executor loop.

## Axes (T-386 v1)

Two axes ship today; size is deferred to T-386a.

| Axis | Field | Effect |
|---|---|---|
| **Message** | `messages[].slots[name]` | Substitutes per-slot text overrides. |
| **Locale** | `locales[].tag` | Routes the substituted text through a `LocaleProvider` for translation. BCP-47-shaped tag. |
| ~~Size~~ | _out of scope_ | T-386a follow-up. The TS interface carries `size?: never` so authors get an authoring-time error; the Zod schema is `strict()` so passing it at runtime fails parse. |

Output shape per coordinate:

```ts
interface VariantOutput {
  coordinate: { messageId?: string; locale?: string };
  document: CanonicalDocument;
  cacheKey: string; // sha256(sourceDocId + coordinate)
}
```

Row-major iteration: `(m1,l1), (m1,l2), …, (m_n, l_m)`.

## Slot binding

A Document marks text content as variant-bound via `variantSlots`:

```ts
{
  // ...
  variantSlots: {
    headline: { elementId: 'el-headline', path: 'text' },
    cta:      { elementId: 'el-cta',      path: 'text' },
  }
}
```

Each slot is a pointer: an Element ID + property-path inside that
element. `@stageflip/variant-gen` substitutes per-coordinate at
generation time. Documents without `variantSlots` round-trip unchanged
(invariant pinned by `document.test.ts`).

## Locale-provider seam

Translation is a pluggable seam:

```ts
interface LocaleProvider {
  translate(args: { tag: string; key: string; source: string }): string;
}
```

T-386 ships two implementations:

- `InMemoryLocaleProvider({ catalogue })` — for tests; takes a pre-built
  catalogue of `{ tag → { key → translation } }`.
- `StaticBundleLocaleProvider({ bundle })` — reads a serialised JSON
  bundle of the same shape. Browser-safe.

Network-fetching providers (Google Translate / DeepL / in-house TMS) are
deferred to T-415 (Phase 14 ADR-006 provider-seam pattern).

## Determinism

Variant-gen is subject to the broad §3 determinism rule. Pure
transformation over inputs:

- No `Date.now`, no `Math.random`, no rAF.
- The `cacheKey` is content-addressed: `sha256(sourceDocId + coordinate)`.
  Identical inputs → identical keys across processes / runs / machines.
  Pure-JS sync sha256 implementation; no Node-only `crypto` import, no
  async Web Crypto.

This is the foundation T-408 (export-matrix routing) needs to dedupe
variants across runs.

## Performance — structural sharing

A variant whose only difference from the source is one substituted text
slot satisfies: every Element in the variant whose ID does not match the
substituted slot's `elementId` is **reference-equal** to the source's
corresponding Element. Pinned by `generate.test.ts` on a 100-element
source. Implementation constructs new objects only along the path from
root to substituted slot; siblings retain identity.

## Cap behaviour

`maxVariants` (default 100) prevents combinatorial blow-ups. Exceeding
the cap throws `VariantMatrixCapExceededError` **synchronously**, before
any variant is yielded. No partial output.

The agent-tool boundary maps the throw to a typed
`{ ok: false, reason: 'matrix_cap_exceeded' }` response (no patches
emitted, no documents persisted).

## Decoupling — variant-gen vs export-matrix

Variant-gen produces transformed Documents + cache keys. It does **not**
know how its output is rendered. The export-matrix routing layer (T-408)
consumes `Iterable<VariantOutput>` and routes per ADR-003 §D4 (frame-
deterministic vs interactive vs bake tier per target). This is the
correct decoupling boundary.

## Out of scope (T-386 v1)

| Item | Owner |
|---|---|
| Size axis (aspect-ratio variants) | T-386a |
| Per-variant rendering / export pipeline | T-408 |
| Translation-provider plumbing (Google / DeepL / TMS) | T-415 |
| Variant deduplication (e.g. identical translation = source) | future optimisation |
| Agent-driven variant ideation ("suggest 5 messages") | T-407 |
| Variant preview UI in the editor | future editor task |

## Related

- `concepts/rir/SKILL.md` — RIR is the frozen, rebuilt-per-render
  intermediate; variant-gen operates on Documents that compile to RIR.
- `concepts/schema/SKILL.md` — `Document.variantSlots` is the schema
  hook for slot binding.
- `tools/arrange-variants/SKILL.md` — the agent-tool surface.
- ADR-005 §D6 — variant generation deliverable.
- ADR-003 §D4 — export matrix routing per target tier.
- Task: T-386
