---
'@stageflip/runtimes-frame-runtime-bridge': minor
---

T-131d.4 — `animated-map` (SVG fallback only). Closes reference-clip
coverage at 32/32 (`ALL_BRIDGE_CLIPS` → 31).

Reference's `mapbox-gl` real-tiles branch deliberately NOT ported:
network tile fetches + imperative `useEffect` DOM mutation on a
canvas element both violate frame-runtime determinism invariants. A
bridge-tier preview clip gated on a Mapbox account token is also the
wrong posture regardless — real Mapbox belongs in a future bake-tier
`animated-map-real` clip that pre-renders tiles during export, not in
a determinism-scoped preview clip. The SVG fallback — what the
reference itself renders whenever no token is supplied — is the sole
implementation here.

Zero new runtime deps → no `THIRD_PARTY.md` change.

- `animated-map` — SVG grid + dashed route line drawn from a fixed
  start anchor to an eased-progress endpoint, camera center/zoom
  linearly interpolated by an in-out-cubic bezier progress value,
  pulse ring around the advancing dot (`0.3 + sin(frame * 0.3) *
  0.3` opacity — deterministic). Three hand-tuned palettes via the
  `style` enum (`dark` / `light` / `satellite`); three of the four
  palette-overridable colour props (`backgroundColor`, `accentColor`,
  `textColor`) participate in `themeSlots` (background / primary /
  foreground). `gridColor` is overrideable but deliberately NOT a
  theme slot (hand-tuned tonal shift off the style's background —
  mapping to arbitrary theme roles produces wrong contrast).

KNOWN_KINDS allowlist, cdp-host-bundle clip-count test (30 → 31),
parity fixture, and plan row all updated. SKILL tranche ledger
updated with a new `animated-map` row and the provenance note that
reference-clip coverage is now 32/32.
