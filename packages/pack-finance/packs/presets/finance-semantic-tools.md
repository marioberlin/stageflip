---
id: finance-semantic-tools
cluster: cluster-finance
clipKind: na
parityFixture: na
source: Bloomberg Professional Services + Refinitiv financial-data normalization conventions (real-time NBBO + non-GAAP EPS reconciliation) + SEC Regulation FD safe-harbor + forward-looking-statement disclosure norms (https://www.sec.gov/rules/final/33-7881.htm) + Reg G non-GAAP reconciliation rules (https://www.sec.gov/rules/final/33-8176.htm) + Bloomberg Open Symbology (BBGID / FIGI) ticker-resolution canon
status: substantive
permissions:
  - data-source:bloomberg-pro
  - llm:tool-bundle:finance-domain
signOff:
  parityFixture: na
  typeDesign: na
ownerTask: T-525
relatedTasks:
  - T-521
  - T-522
  - T-523
  - T-524
---

# Finance-domain semantic-tool extensions — bundle contribution slot

Fourth and final substantive contribution in the Earnings & Investor pack (skeleton landed T-521; closes the last of four placeholder slots; bumps the pack version 0.1.0 → 0.2.0 GA). UNLIKE sister T-522 / T-523 (composition-template presets via `contributes.presets`) and T-524 (data-source-adapter id reservation via `contributes.adapters`), T-525 is a **tools contribution** — a manifest-level declaration via `contributes.tools` that reserves a NEW semantic-tool bundle name (`finance-domain`) under the Earnings & Investor pack's vendor scope. Per ADR-012 §D5, `manifest.contributes.tools` is a parallel surface to `contributes.presets` / `contributes.clipKinds` / `contributes.fonts` / `contributes.fixtures` / `contributes.assets` / `contributes.adapters` / `contributes.themePacks`; each entry has shape `{ bundleName: string; tools: string[] }` (per `packToolContributionSchema` in `packages/pack-format/src/manifest.ts`). T-525 seeds the array with a single entry: `{ bundleName: 'finance-domain', tools: ['finance.format_currency', 'finance.compute_growth_rate', 'finance.bullet_safe_harbor', 'finance.lookup_ticker', 'finance.normalize_eps'] }`. This preset markdown documents the reservation — the actual tool-handler implementations (engine-side bundles under `packages/engine/src/handlers/finance-domain/` with payload normalizers, throttling discipline, Reg FD attribution wiring, fixture-replay surface for the parity harness) land in a post-Track-A finance-specific tools task, NOT here. The pack manifest declares the bundle name in advance so the downstream consumer specs (cluster-finance compose-tools that wire the bundle into clip-binding flows, runtime-side LLM-output-quota enforcement, future Reg FD compliance gates) can reference `finance-domain` by name without waiting on the handler package to ship.

## Tools

The bundle declares five tool names spanning the canonical Earnings & Investor pack consumer surface — number formatting + growth math + forward-looking-statement compliance annotation + ticker resolution + non-GAAP reconciliation. Each is a forward reservation under the `finance.` namespace; the actual handler signatures, parameter Zod schemas, JSON-output shapes, and rate-limit envelopes land with the handler-bundle implementation.

### `finance.format_currency`

**Scope.** Format a numeric metric as a currency value rendered in editorial-magazine financial canon — e.g. `1230000000 → "$1.23B"`, `47500000 → "$47.5M"`, `2400 → "$2.4K"`, with locale + currency-code parameterization for non-USD payloads (`€`, `£`, `¥`, `CHF`, etc.) and explicit rounding-mode discipline (banker's-rounding default; truncation + half-up override). Distinct from the host-side `Intl.NumberFormat` because the editorial canon truncates to 2-3 significant figures with a magnitude suffix (`B`/`M`/`K`/`T`), NOT 2 decimal places. Consumers: T-522 earnings-call-template revenue / net-income / EPS metric slot, T-523 investor-deck-template TAM / SAM / ARR slot.

**I/O.** Input: `{ value: number; currency: ISO4217; locale: string; rounding?: 'banker' | 'truncate' | 'half-up' }`. Output: `{ formatted: string; magnitude: 'T' | 'B' | 'M' | 'K' | null; rawDigits: string }`.

**Auth.** None — pure formatting; no live data.

### `finance.compute_growth_rate`

**Scope.** Compute year-over-year (YoY) or quarter-over-quarter (QoQ) growth from raw revenue / metric tokens — e.g. `{ current: 56_500_000, prior: 52_300_000 } → +8.0%`. Supports CAGR over multi-period samples, three-year-rolling growth, and TTM (trailing-twelve-month) comparison. Distinct from the trivial `((curr - prior) / prior) * 100` because the editorial canon: (a) returns "+" / "-" sign prefix for ALL growth values (not just negative), (b) rounds to 1 decimal place unless the magnitude is below 1.0%, (c) emits "n/a" for prior=0 to avoid divide-by-zero render glitches, (d) emits "(loss → profit)" / "(profit → loss)" sign-flip annotations for crossing-zero cases. Consumers: T-522 YoY growth slot (`'+8% YoY'`), T-523 CAGR slot (`'35% CAGR'`).

**I/O.** Input: `{ current: number; prior: number; periodLabel?: 'YoY' | 'QoQ' | 'CAGR' | 'TTM'; precision?: number }`. Output: `{ rate: number; formatted: string; isLossToProfit: boolean; isProfitToLoss: boolean }`.

**Auth.** None — pure math; no live data.

### `finance.bullet_safe_harbor`

**Scope.** Annotate a forward-looking statement (FLS) bullet — e.g. a Q4 revenue-guidance line in T-522's earnings-call template — with the canonical SEC Reg FD safe-harbor disclaimer. Per Reg FD §10b-5 + Private Securities Litigation Reform Act of 1995 §27A, an issuer's forward-looking-statement disclosures qualify for the statutory safe harbor only when accompanied by meaningful cautionary language identifying material risk factors. This tool wraps a bullet with the standard cautionary preamble (`"This statement contains forward-looking information within the meaning of …"`) and a footnote-style references-to-10-K-risk-factors anchor. The handler does NOT generate the bullet content; it ONLY wraps existing copy with the compliance scaffolding. Distinct from a static template-insert because the tool also classifies the bullet category (guidance / projection / opinion / aspiration) and selects the matching cautionary form. Consumers: T-522 earnings-call guidance bullets, T-523 investor-deck market-projection bullets.

**I/O.** Input: `{ bulletText: string; category?: 'guidance' | 'projection' | 'opinion' | 'aspiration'; jurisdictionISIN: string }`. Output: `{ wrapped: string; cautionaryPreamble: string; footnoteAnchor: string; detectedCategory: string }`.

**Auth.** None — pure annotation; jurisdiction is a static lookup table internal to the handler.

### `finance.lookup_ticker`

**Scope.** Resolve a stock ticker (e.g. `'AAPL'`, `'TSLA'`, `'BRK.B'`) to canonical company metadata — legal entity name, primary listing exchange, sector / industry classification (GICS), market-cap bucket (large / mid / small / micro), and Bloomberg Open Symbology (BBGID / FIGI) cross-reference identifiers. Distinct from a generic name lookup because the editorial canon enforces the **primary listing** disambiguation (e.g. `'BABA'` → NYSE ADR vs HK 9988 dual-listing) and surfaces the issuer's reporting-currency for downstream `finance.format_currency` calls. Consumers: T-522 earnings-call template issuer-header slot, T-523 investor-deck template comparable-companies slots.

**I/O.** Input: `{ ticker: string; preferredExchange?: 'NYSE' | 'NASDAQ' | 'LSE' | 'TYO' | 'HKEX' | 'XETR' | 'TSX' | 'auto' }`. Output: `{ ticker: string; legalName: string; primaryExchange: string; reportingCurrency: ISO4217; sector: string; industry: string; marketCapBucket: 'large' | 'mid' | 'small' | 'micro'; bbgid: string; figi: string }`.

**Auth.** **`data-source:bloomberg-pro`** — uses the `bloomberg-pro` data-source adapter reserved in T-524 to resolve ticker → entity metadata. Falls back to fixture-replay if the connector card is unavailable. The free-tier `bloomberg` adapter (not declared in this pack) would degrade-to-delayed-snapshot at the same handler level.

### `finance.normalize_eps`

**Scope.** Apply non-GAAP earnings-per-share reconciliation guidance per SEC Reg G — surface the GAAP EPS alongside the non-GAAP adjustment line items (stock-based compensation, acquisition-related amortization, restructuring, tax-effect adjustments) so the editorial render can show both figures with the required reconciliation table. Per Reg G §244.100, public companies disclosing non-GAAP measures MUST include a quantitative reconciliation to the most-directly-comparable GAAP measure in the same disclosure surface; this tool generates the reconciliation table from a raw adjustment list. Distinct from a static template because the handler validates: (a) the GAAP figure is the SEC-filed prior-period restated figure, NOT a press-release pro-forma, (b) the adjustment list sums to the non-GAAP delta within rounding tolerance, (c) the tax-effect line is computed at the issuer's effective rate, not a static 21% assumption. Consumers: T-522 earnings-call template non-GAAP EPS slot, T-523 investor-deck template historical-results slot.

**I/O.** Input: `{ ticker: string; period: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY'; year: number; gaapEps: number; adjustments: Array<{ category: string; perShareImpact: number; taxEffect: number }> }`. Output: `{ gaapEps: number; nonGaapEps: number; reconciliation: Array<{ label: string; perShareImpact: string }>; effectiveTaxRate: number; isReconciled: boolean; warnings: string[] }`.

**Auth.** **`data-source:bloomberg-pro`** — uses the `bloomberg-pro` adapter to verify the GAAP figure against the filed 10-Q / 10-K. Falls back to fixture-replay; warnings include `"unverified-gaap-figure"` when adapter is unavailable.

## Bundle name

**`finance-domain`** — the NEW semantic-tool bundle namespace under the Earnings & Investor pack's vendor scope. Parallel to the 27 existing engine-side semantic-tool bundles under `packages/engine/src/handlers/` (e.g. `data-source-bindings`, `audience-engagement`, `cluster-i-compose`), but pack-contributed rather than core. Per the engine's tool-router registration convention, a pack-contributed bundle is keyed by `<packId>:<bundleName>` at runtime — so the full router key for this bundle is `finance:finance-domain`. The bundle name `finance-domain` follows the engine's hyphenated-domain naming convention (compare `data-source-bindings`, `cluster-i-compose`); the `finance.` prefix on individual tool names is the customary engine-side namespacing.

## Implementation pointer

The actual handler-bundle implementation lands in a post-Track-A finance-specific tools task in the engine repo. The expected target:

```
packages/engine/src/handlers/finance-domain/
├── format_currency.ts       — handler for finance.format_currency
├── compute_growth_rate.ts   — handler for finance.compute_growth_rate
├── bullet_safe_harbor.ts    — handler for finance.bullet_safe_harbor
├── lookup_ticker.ts         — handler for finance.lookup_ticker
├── normalize_eps.ts         — handler for finance.normalize_eps
├── index.ts                 — bundle barrel export
└── README.md                — handler-bundle skill (skills/stageflip/tools/finance-domain/SKILL.md mirror)
```

The handler bundle registers itself via the engine's tool-router registry (`packages/engine/src/handlers/registry.ts`); the `pnpm gen:tool-skills` target then regenerates the corresponding skill file under `skills/stageflip/tools/finance-domain/SKILL.md`. The pack manifest's `contributes.tools` entry is the **forward reservation** — the handler bundle's registry entry is the **runtime binding**; the two are wired at pack-install-time by the host (`packages/host-config/` resolves `<packId>:<bundleName>` to the matching handler bundle and exposes the bundle's tool names to the LLM tool router).

## Permissions

The bundle declares **two** permission scopes that a tenant must grant before the handlers may resolve at render time:

- **`data-source:bloomberg-pro`** — required by `finance.lookup_ticker` + `finance.normalize_eps` for live ticker + filed-GAAP-figure lookups. Same connector-card permission as T-524's adapter reservation; surfaced to the tenant once per pack-install, not per-handler.
- **`llm:tool-bundle:finance-domain`** — required by ALL five tools to admit the bundle into the LLM's tool-router exposure at render time. Per the engine's per-tenant LLM-output-quota discipline, each tool call against this bundle counts against the tenant's monthly token budget for the `finance-domain` namespace. Default budget: **50,000 tool-call invocations / month** (Bloomberg-pro tier; covers ≈ 100 earnings calls or 20 investor decks at typical bullet density). Hard ceiling: **100,000 / month** with overage billing per the `finance-1y` SKU's overage schedule (post-Track-A; ADR-013 §D3).

The pack-installer surface prompts the tenant for both grants during install; the host short-circuits to fixture-replay for any handler that cannot resolve its required scope at render time.

## Trade-offs

- **Reg FD compliance.** Tools `finance.bullet_safe_harbor` + `finance.normalize_eps` MUST be invoked on EVERY forward-looking-statement + non-GAAP-EPS render against the Earnings & Investor pack; missing-call discipline is enforced at the engine-side bundle-handler level, NOT at this preset's manifest-side declaration. Pack consumers that bypass these tools (e.g. by hard-coding numeric metrics in a one-off preset) take on the Reg FD compliance burden themselves; the bundle's handler-level enforcement only catches the call-path it intercepts.
- **Forward-looking-statement (FLS) risk.** Even WITH `finance.bullet_safe_harbor` annotation, an FLS bullet that materially misstates an issuer's risk factors is not safe-harbor-protected; the tool generates compliance scaffolding, not legal review. Pack consumers MUST surface a manual review surface (e.g. a tenant-side compliance-officer approval step) before publishing renders containing FLS bullets. The handler-bundle's output includes a `requiresHumanReview: true` flag on every FLS-classified bullet; consumers that suppress this flag take on the unreviewed-FLS risk themselves.
- **Tool-call latency.** `finance.lookup_ticker` + `finance.normalize_eps` involve live Bloomberg-pro queries; latency budget is bounded by the adapter's rate-limit envelope (≈ 1000 calls/minute hard / 5000/minute burst per T-524) and the per-render parallelism cap. For a typical earnings-call render with 6-8 ticker / EPS slots, expected per-render adapter-call budget is 10-15 calls — well under the per-minute ceiling but adds 200-400 ms tail latency vs the pure-format / pure-math tools. Consumers that need lower tail latency MUST pre-resolve tickers in a background pre-fetch step before the render starts.
- **Non-GAAP reconciliation hygiene.** `finance.normalize_eps` validates the adjustment list sums to the non-GAAP delta within rounding tolerance; consumers that submit a malformed adjustment list (e.g. missing tax-effect line, wrong sign on stock-based-comp adjustment) get a `warnings: ['unreconciled-adjustment-list']` flag but the render proceeds. Hard-fail on malformed reconciliation is deliberately NOT the default — the editorial canon prefers a labelled-as-unreconciled render over a blocked render — but consumers that need fail-closed semantics MUST gate on `isReconciled: true` at the engine-handler-invocation site.

## Out of scope

- **The actual handler-bundle implementation** — payload normalizers, Zod parameter schemas, throttling discipline, Reg FD attribution wiring, fixture-replay surface, per-tenant LLM-output-quota enforcement — lands in a post-Track-A engine-side finance-domain tools task. T-525 is manifest-side declaration only.
- **The free-tier finance-domain bundle** — a separate engine-side handler-bundle task; not declared in this pack manifest. The free-tier bundle likely lives under the engine's system-level handler registry; the premium-tier `finance-domain` bundle specifically scopes to the paid Earnings & Investor pack.
- **Cluster-finance compose-tools that wire the bundle into clip-binding flows** — owned by a future cluster-finance compose-tools task; not duplicated here. The bundle's tool-names are exposed to the LLM's tool-router via `<packId>:<bundleName>` keying; cluster-finance compose-tools resolve the binding at clip-instantiation time.
- **Live binding into T-522 / T-523 snapshot constants** — both composition templates currently hard-code their numerical-metric and growth-curve numerals in their snapshot strings (`'+8% YoY'`, `'$50M ARR'`, `'$10B TAM, $2B SAM, 35% CAGR'`). Live binding via these tools lands at the future cluster-finance compose-tools task with the Bloomberg-pro adapter (T-524) as the data-source scope and the `finance-domain` bundle (this preset) as the tool-router surface.
- **Skill file under `skills/stageflip/tools/finance-domain/SKILL.md`** — generated by `pnpm gen:tool-skills` AFTER the handler bundle lands. Until then, `pnpm gen:tool-skills:check` does NOT enforce a skill for this bundle because the pack manifest's `contributes.tools` declaration is content-side metadata, not an engine-side registry entry; the skill-drift gate walks `packages/engine/src/handlers/<bundle>/` directories, not pack manifests.

## References

- ADR-012 §D2 — pack manifest schema (`packContributionsSchema.tools` shape: `z.array(packToolContributionSchema).optional()`)
- ADR-012 §D5 — tool contributions (`packToolContributionSchema`: `{ bundleName: string.min(1), tools: z.array(z.string().min(1)).min(1) }`)
- ADR-013 §D3 — paid-per-tenant commercial-subscription tier (`finance-1y` SKU; the Earnings & Investor pack's license tier carries the `finance-domain` tool-bundle entitlement)
- SEC Regulation FD safe-harbor — forward-looking-statement disclosure norms (https://www.sec.gov/rules/final/33-7881.htm)
- SEC Regulation G — non-GAAP reconciliation rules (https://www.sec.gov/rules/final/33-8176.htm)
- Bloomberg Open Symbology (BBGID / FIGI) — ticker-resolution canonical-id reference
- T-280..T-285 — adapter-source-of-truth registry + adapter-sandbox connector-card scaffolding (where the bloomberg-pro adapter implementation referenced by `finance.lookup_ticker` + `finance.normalize_eps` lands)
- T-521 — Earnings & Investor pack skeleton (this preset's parent pack; landed the four placeholder cluster-finance preset slots)
- T-522 — Earnings-call composition template (future consumer of `finance.format_currency` + `finance.compute_growth_rate` + `finance.bullet_safe_harbor` + `finance.lookup_ticker` + `finance.normalize_eps`)
- T-523 — Investor-deck composition template (future consumer of the same five tools)
- T-524 — Bloomberg-pro adapter premium-tier contribution slot (sister cluster-finance contribution; the `bloomberg-pro` adapter id reserved there is the data-source scope for `finance.lookup_ticker` + `finance.normalize_eps`)
- T-525 — Finance-domain semantic-tool extensions (this PR; closes the fourth and final cluster-finance placeholder slot and CLOSES the Earnings & Investor launch pack at v0.2.0 GA)
