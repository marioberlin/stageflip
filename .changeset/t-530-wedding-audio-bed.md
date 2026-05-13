---
'@stageflip/pack-wedding-events': minor
---

T-530 — Wedding & Events Pack: fifth and final substantive
contribution — the **pre-licensed audio bed library**
(`audio-bed-library`) replacing the T-526 placeholder slot. UNLIKE
sister T-527 (theme variants binding the LowerThird primitive), T-528
(composition templates via PRESET_ID_BINDINGS Pattern C cross-cluster
register reuse), and T-529 (transition / bumper presets via cluster-D
titleSequence binding), T-530 is an **assets contribution** — a
manifest-level declaration per ADR-012 §D5 that seeds
`manifest.contributes.assets` with five pre-licensed audio-bed track
references: `audio/processional-strings-instrumental.mp3` (string
quartet processional, ~70 BPM D major, ~3 min),
`audio/recessional-uptempo-instrumental.mp3` (uptempo string ensemble
recessional, ~120 BPM G major, ~2 min),
`audio/reception-jazz-ambient.mp3` (light jazz quartet reception
cocktail-hour ambient, ~95 BPM F major, ~5 min loop-friendly),
`audio/first-dance-acoustic-instrumental.mp3` (acoustic-guitar
fingerstyle first-dance, ~80 BPM C major, ~4 min),
`audio/closing-piano-instrumental.mp3` (solo piano closing send-off,
~85 BPM A major, ~3 min). All five tracks are first-party
work-for-hire commissions; StageFlip holds both composition and
sound-recording copyrights, sub-licensed to the tenant under the
`wedding-events-1y` SKU's commercial-subscription terms. The library
declares one permission scope (`assets:audio-bed`) granted once per
pack-install. **The actual MP3 byte payloads are NOT shipped in the
pack archive** — they're delivered per-tenant externally via the
StageFlip CDN's per-tenant audio-asset bucket (signed-URL-resolved at
render time) per mechanical-licensing audit-trail requirements (37
CFR §380.10; Harry Fox Agency canon). The host-side audio-delivery
integration (per-tenant signed-URL resolver, render-time fetch
discipline, audit-trail wiring, MLC reporting surface) lands in a
future post-Track-A task; T-530 is manifest-side declaration only —
the forward reservation. Manifest version bumps 0.1.0 → 0.2.0
(additive — new assets contribution + final placeholder slot filled).
**Closes the Wedding & Events launch pack at v0.2.0 GA.**
