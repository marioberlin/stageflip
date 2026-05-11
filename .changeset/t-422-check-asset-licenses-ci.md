---
---

T-422 — `check-asset-licenses` CI gate (Phase 14 α; precondition for
T-426..T-434 reference adapters).

Pure Node CLI at `scripts/check-asset-licenses.ts` enforcing ADR-008
§D13's per-modality license whitelist against every adapter discoverable
in the workspace. Mirrors `scripts/check-licenses.ts` (the existing
dep-license gate from ADR-001 §D4) in shape and slots into the same
`typecheck · lint · test · gates` job in `.github/workflows/ci.yml` as
a sibling step (`Gate - check-asset-licenses`).

Failure modes caught:

- `license.kind === 'gpl-incompatible'` — always FORBIDDEN per ADR-007
  §D3 + CLAUDE.md §3 invariant.
- `license.kind` not in the per-modality whitelist for the adapter's
  `modality.kind` — FORBIDDEN.
- `license.kind === 'proprietary-vendored'` without an ADR reference
  recorded in `PROPRIETARY_OK` — NEEDS-ADR (FAIL).
- Package matches the adapter naming convention but exports neither
  `descriptor` nor `descriptors` — MISSING-DESCRIPTOR (FAIL).
- `parseAdapterDescriptor` rejects the descriptor (Zod error) —
  PARSE-ERROR (FAIL).

Inaugural state: 0 adapter packages exist on `main` (no reference
adapters yet — T-426..T-434 will ship them); script exits 0 with
"0 adapters registered; whitelist not yet exercised". Documented in
`scripts/check-asset-licenses.ts` header.

No publishable package version bumps — repo-root tooling change only.
Adds `@stageflip/adapters-core` as a workspace dep on
`@stageflip/scripts` so the script can import the registry types.

§13 (structural extension): NOT a structural extension — pure CI gate
over the existing `AdapterDescriptor` contract from T-418 + T-419. No
runtime behavior changes; render verification N/A.
