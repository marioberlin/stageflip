---
'@stageflip/pack-finance': patch
---

T-524 — Earnings & Investor Pack: third substantive contribution — the
**Bloomberg-pro adapter premium-tier contribution slot**
(`bloomberg-pro-adapter`) replacing the T-521 placeholder slot. UNLIKE
sister T-522 / T-523 (composition-template presets that bind existing
primitives via PRESET_ID_BINDINGS Pattern C), T-524 is an
**adapter-pack contribution** — a manifest-level declaration per
ADR-012 §D5 that seeds `manifest.contributes.adapters` with the
reserved `{ id: 'bloomberg-pro', modality: 'data-source' }` entry. The
`bloomberg-pro` id is the premium-tier variant of the Bloomberg
financial-data adapter family (real-time NBBO + pre/after-hours +
options chain + futures/FX + ≈ 1000 calls/minute rate-limit + 99.95%
SLA per Bloomberg Professional Services TOS), with Reg FD redistribution
discipline (snapshot-license attribution, no-warehouse-no-resell). The
actual adapter implementation (payload normalizers, retry semantics,
error mapping, fixture-replay surface, connector-card UI) lands in a
post-Track-A adapter-package task in the T-280-family follow-up; the
pack manifest declares the contribution slot in advance so the
downstream consumer specs (T-525 finance-domain semantic-tool
extensions) can reference `bloomberg-pro` by id without waiting on the
adapter package to ship. Manifest version stays at 0.1.0 (T-525 closes
the pack and bumps to 0.2.0 GA). T-525 placeholder unchanged.
