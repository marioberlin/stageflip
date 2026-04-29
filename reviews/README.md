# reviews/

Per-cluster review documents authored by specialist agents under
[CLAUDE.md §6](../CLAUDE.md) escalation paths. Today the only inhabitant is
the **type-design consultant** (see
[`skills/stageflip/agents/type-design-consultant/SKILL.md`](../skills/stageflip/agents/type-design-consultant/SKILL.md)).

## Convention

- One file per cluster: `type-design-consultant-cluster-<letter>.md`
  (letter ∈ {A, B, D, F, G} per ADR-004 §D4).
- Frontmatter:
  - `title`, `id`, `reviewedAt` (YYYY-MM-DD)
  - `clusterPresets: [<preset-id>, ...]`
  - `signedOff: false` initially; flipped to `true` (or appended with
    `signed:YYYY-MM-DD`) when the user signs off.
- Body follows the structure documented in the agent SKILL.md §"Outputs".

## Tooling

The skeleton + assembled prompt are produced by:

```
pnpm invoke-type-design-consultant --cluster=<A|B|D|F|G>
```

See [`scripts/invoke-type-design-consultant.ts`](../scripts/invoke-type-design-consultant.ts).

The script does NOT call any LLM — it assembles the consultant's inputs and
writes a placeholder document. The Orchestrator (or a future automation)
runs the agent and fills the skeleton in.

## Re-trigger guard

Per the type-design-consultant SKILL.md §"Gate", re-review is required when:

- Any preset in the cluster changes its `preferredFont`.
- The license-cleared registry adds or removes a font this cluster depends on.
- A fallback font's license posture changes.

When overwriting an existing review, pass `--reason="<text>"` to the script;
the reason is captured at the top of the regenerated document.

## Out of scope

Clusters C (weather), E (data), and H (AR) are exempt. Individual presets in
those clusters that cite bespoke type escalate one-off (CLAUDE.md §6) — they
do **not** receive a batch review here.
