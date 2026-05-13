---
'@stageflip/pack-finance': minor
---

T-525 — Earnings & Investor Pack: fourth and final substantive
contribution — the **finance-domain semantic-tool bundle reservation**
(`finance-semantic-tools`) replacing the T-521 placeholder slot. UNLIKE
sister T-522 / T-523 (composition-template presets via
`contributes.presets`) and T-524 (data-source-adapter id reservation
via `contributes.adapters`), T-525 is a **tools contribution** — a
manifest-level declaration per ADR-012 §D5 that seeds
`manifest.contributes.tools` with the reserved
`{ bundleName: 'finance-domain', tools: ['finance.format_currency',
'finance.compute_growth_rate', 'finance.bullet_safe_harbor',
'finance.lookup_ticker', 'finance.normalize_eps'] }` entry. The
`finance-domain` bundle name is the NEW semantic-tool namespace under
the Earnings & Investor pack's vendor scope; the five tool names span
the canonical consumer surface — currency formatting + growth math +
Reg FD safe-harbor annotation + ticker resolution + non-GAAP EPS
reconciliation. Two tools (`finance.lookup_ticker`,
`finance.normalize_eps`) declare the `data-source:bloomberg-pro`
permission scope reserved in T-524 for live data lookups with
fixture-replay fallback; all five tools declare the
`llm:tool-bundle:finance-domain` permission scope for per-tenant
LLM-output-quota enforcement. The actual handler-bundle implementation
(`packages/engine/src/handlers/finance-domain/` with payload
normalizers, Zod parameter schemas, throttling discipline, Reg FD
attribution wiring, fixture-replay surface, per-tenant LLM-output-quota
enforcement) lands in a post-Track-A engine-side finance-specific
tools task; the pack manifest declares the bundle name in advance so
downstream consumer specs (cluster-finance compose-tools, runtime-side
LLM-output-quota enforcement) can reference `finance-domain` by name
without waiting on the handler package to ship. Manifest version bumps
0.1.0 → 0.2.0 (additive — new tools contribution + final placeholder
slot filled). **Closes the Earnings & Investor launch pack at v0.2.0
GA.**
