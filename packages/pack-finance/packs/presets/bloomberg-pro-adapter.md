---
id: bloomberg-pro-adapter
cluster: cluster-finance
clipKind: na
parityFixture: na
source: Bloomberg Professional Services data-license tier conventions (https://www.bloomberg.com/professional/product/market-data/) + Bloomberg Terminal redistribution canon (B-PIPE / SAPI / Server-API; Reg FD compliance for material non-public information redistribution) + Refinitiv / S&P Capital IQ comparable premium-tier financial-data-adapter conventions
status: substantive
permissions:
  - data-source:bloomberg-pro
signOff:
  parityFixture: na
  typeDesign: na
ownerTask: T-524
relatedTasks:
  - T-521
  - T-522
  - T-523
  - T-525
---

# Bloomberg-pro adapter — premium-tier data-source contribution slot

Third substantive contribution in the Earnings & Investor pack (skeleton landed T-521; closes the third of four placeholder slots opened by T-521). UNLIKE sister T-522 / T-523 (composition-template presets that bind existing primitives via PRESET_ID_BINDINGS Pattern C), T-524 is an **adapter-pack contribution** — a manifest-level declaration that reserves the `bloomberg-pro` premium-tier data-source adapter id under the Earnings & Investor pack's vendor scope. Per ADR-012 §D5, `manifest.contributes.adapters` is a parallel surface to `contributes.presets` / `contributes.clipKinds` / `contributes.fonts` / `contributes.fixtures` / `contributes.assets` / `contributes.tools` / `contributes.themePacks`; each entry has shape `{ id: string; modality: string }`. T-524 seeds the array with a single entry: `{ id: 'bloomberg-pro', modality: 'data-source' }`. This preset markdown documents the reservation — the actual adapter implementation (real-time + delayed quote payload normalizers, rate-limit shaping, retry semantics, error mapping, fixture replay surface for the parity harness) lands in a post-Track-A adapter-package task in the T-280-family follow-up, NOT here. The pack manifest declares the contribution slot in advance so the downstream consumer specs (semantic-tool extensions that bind to Bloomberg-pro data, future cluster-finance compose-tools that wire the adapter into the engine handlers, runtime-side connector-card UI) can reference `bloomberg-pro` by id without waiting on the adapter package to ship.

## What `bloomberg-pro` reserves

The `bloomberg-pro` id is the **premium-tier variant** of the Bloomberg financial-data adapter family. A future free-tier `bloomberg` adapter (canonical delayed-quote feed; 15-minute lag on intraday data; equities-only payload shape; rate-limit ~100 calls/minute; best-effort SLA) is the expected complement; the premium-tier `bloomberg-pro` extends with:

- **Real-time quotes** (sub-second tick latency for Level-1 NBBO; vs free-tier 15-minute delayed)
- **Pre-market + after-hours data** (extended-hours session coverage 04:00 – 20:00 US/Eastern; vs free-tier 09:30 – 16:00 regular-session only)
- **Options chain payloads** (full chain depth across all listed expirations with Greeks computed at NBBO; vs free-tier omits options entirely)
- **Futures + commodities + FX cross-rates** (CME / ICE / EUREX session data with auto-rollover discipline; vs free-tier omits non-equities)
- **Higher rate-limit ceiling** (≈ 1000 calls/minute hard / 5000/minute burst; vs free-tier ≈ 100/minute)
- **SLA-backed availability** (99.95% monthly uptime per Bloomberg Professional Services TOS; vs free-tier best-effort no-SLA)

The Reg FD redistribution discipline is the same across both tiers — adapter consumers must respect Bloomberg's material non-public information rules, the snapshot-license attribution requirement (`"Source: Bloomberg L.P., $TIMESTAMP"` watermark on derivative renders), and the no-warehouse-no-resell clause. The premium-tier upgrade does NOT relax these; it expands the payload surface and shortens the latency, no more.

## Why a manifest-declared slot before the adapter ships

The adapter-package task lives in the T-280-family adapter-source-of-truth registry (`packages/adapters-core/` adapter-registry plus the connector cards in `packages/adapter-sandbox/`). Per ADR-012 §D5, content packs MAY declare adapter contributions ahead of the adapter-package ship date — the manifest entry is a **forward reservation**, not a runtime dependency. The pack-format schema (`packAdapterContributionSchema` in `packages/pack-format/src/manifest.ts`) accepts `{ id, modality }` as a structurally complete contribution; no adapter-package import is required at manifest-build time. Downstream consumers that need the adapter (cluster-finance semantic-tool handlers in T-525, future cluster-finance compose-tools that wire ticker-feed clipKinds, future engine-side fixture-replay surface) reference `bloomberg-pro` by id and fall back to fixture-replay until the real adapter lands.

This decouples the **pack v0.2.0 ship** from the **adapter-package ship** — the pack ships its contribution-slot declarations under v0.2.0 (T-525 closes the pack and bumps the version), the adapter-package ships independently on its own cadence under the adapters-core registry, and the runtime resolves the binding at consumer-spec wire-time.

## Permissions

- **`data-source:bloomberg-pro`** — the connector-card permission scope a tenant must grant before the cluster-finance semantic-tool handlers (T-525) may resolve live Bloomberg-pro payloads at render time. The permission is declared on this preset's frontmatter (`permissions: [data-source:bloomberg-pro]`) so the pack-installer surface can prompt the tenant for the explicit grant during install. Same connector-card permission discipline as the broader adapter-sandbox model (T-285 et al).

## Rate-limit + SLA norms

- **Rate-limit**: ≈ 1000 calls/minute hard / 5000/minute burst (Bloomberg B-PIPE Professional Services TOS). The cluster-finance semantic-tool handlers (T-525) MUST throttle outbound queries via the adapter-sandbox rate-limiter (T-285) to stay within the per-tenant ceiling; bursts exceeding the burst-ceiling fail-soft to fixture-replay rather than rejecting the render.
- **SLA**: 99.95% monthly uptime per Bloomberg Professional Services TOS. Adapter availability falls under the per-tenant connector-card health-monitoring surface; pack-side semantic-tool handlers degrade-to-fixture on adapter-unavailable rather than blocking the render.
- **Reg FD compliance**: derivative renders that surface real-time Bloomberg-pro payloads MUST include the snapshot-license attribution (`"Source: Bloomberg L.P., $TIMESTAMP"`) and MUST NOT cache material non-public-information payloads beyond the rendering session. The cluster-finance semantic-tool handlers (T-525) enforce both at handler-bundle-level; this preset's manifest-side declaration carries no enforcement, only intent.

## Out of scope

- **The actual adapter implementation** — payload normalizers, retry semantics, error mapping, fixture-replay surface, connector-card UI — lands in a post-Track-A adapter-package task in the T-280-family follow-up. T-524 is manifest-side declaration only.
- **The free-tier `bloomberg` adapter** — a separate adapter-package task; not declared in this pack manifest. The free-tier adapter likely lives under a free-tier pack or under a system-level adapters-core default registration; the premium-tier `bloomberg-pro` id specifically scopes to the paid Earnings & Investor pack.
- **Cluster-finance semantic-tool handlers that consume `bloomberg-pro`** — owned by T-525 (the fourth and final placeholder slot in this pack); not duplicated here.
- **Live data binding into the T-522 earnings-call-template or T-523 investor-deck-template snapshot constants** — both composition templates currently hard-code their numerical-metric and growth-curve numerals in their snapshot strings (`'+8% YoY'`, `'$50M ARR'`, `'$10B TAM, $2B SAM, 35% CAGR'`). Live binding lands as a cluster-finance semantic-tool extension in T-525 with the adapter id `bloomberg-pro` as the data-source scope.

## References

- ADR-012 §D2 — pack manifest schema (`packContributionsSchema.adapters` shape: `z.array(packAdapterContributionSchema).optional()`)
- ADR-012 §D5 — adapter contributions (`packAdapterContributionSchema`: `{ id: string.min(1), modality: string.min(1) }`)
- ADR-013 §D3 — paid-per-tenant commercial-subscription tier (`finance-1y` SKU; the Earnings & Investor pack's license tier carries the `bloomberg-pro` adapter entitlement)
- Bloomberg Professional Services data-license conventions (https://www.bloomberg.com/professional/product/market-data/) — premium-tier feed-tier specification
- Bloomberg B-PIPE / SAPI / Server-API redistribution canon — Reg FD compliance discipline + snapshot-license attribution norms
- T-280..T-285 — adapter-source-of-truth registry + adapter-sandbox connector-card scaffolding (where the actual adapter implementation lands in a post-Track-A follow-up)
- T-285 — adapter-sandbox rate-limiter (consumer-side throttling for the `bloomberg-pro` connector card)
- T-356 — `bloomberg-ticker` preset (existing cluster-A `newsTicker` consumer in scroll-mode finance-register; thematically adjacent — both bind the Bloomberg name to a visual register — but a separate concern: T-356 binds a clipKind, T-524 reserves a data-source adapter id)
- T-521 — Earnings & Investor pack skeleton (this preset's parent pack; landed the four placeholder cluster-finance preset slots)
- T-522 — Earnings-call composition template (closes the first placeholder slot; future consumer of `bloomberg-pro` data via T-525 semantic-tool extensions)
- T-523 — Investor-deck composition template (closes the second placeholder slot; future consumer of `bloomberg-pro` data via T-525 semantic-tool extensions)
- T-524 — Bloomberg-pro adapter premium-tier contribution slot (this PR; closes the third of four cluster-finance placeholder slots)
- T-525 — Finance-domain semantic-tool extensions (sister cluster-finance contribution; binds to the `bloomberg-pro` adapter id reserved here; closes the Earnings & Investor pack v0.2.0)
