---
'@stageflip/runtimes-shader': patch
'@stageflip/runtimes-frame-runtime-bridge': minor
---

Phase 6 polish follow-ups (three items carried from `docs/handover-phase6-mid-6.md` §5.4).

**1. Shader compile-failure dev-mode `console.warn`.**
`ShaderClipHost` (T-131d.2) silent-fallbacked on shader compile/link failure by design — a bad GLSL prop shouldn't crash the surrounding deck. But authors hitting the fallback had no way to know WHY the canvas was blank. This adds a `console.warn` guarded by `NODE_ENV !== 'production'` that surfaces the GL info log. Production stays silent to avoid spam from decks shipping intentional-stub fragments.

**2. `commentaryMode: 'inline'` now renders distinctly from `'rail'` (financial-statement).**
T-131f.3's `financial-statement` clip advertised `commentaryMode: 'rail' | 'inline' | 'none'` in its schema but rendered the side rail for both `rail` and `inline`. The rail layout keeps the side panel; the new inline layout lays the comments as a horizontal strip below the table. Each layout carries its own data-testid (`financial-statement-comments-rail` / `financial-statement-comments-inline`) so downstream tooling can distinguish the two. `CommentsRail` gains a `layout?: 'rail' | 'inline'` prop.

**3. Currency prefix expanded to 13 ISO currencies + sensible fallback.**
Both `financial-statement` and `sales-dashboard` used a local 2-entry map (USD / EUR) and silently rendered bare numbers for anything else. Consolidated to a shared `currencyPrefix` helper in `_dashboard-utils.ts` that maps USD, EUR, GBP, JPY, CNY, INR, KRW, CHF, CAD, AUD, HKD, SGD, NZD to short display prefixes; unknown codes fall through to `<CODE> ` (e.g. `BRL 100K`) so the number is never unlabelled. Two clips now import from one source — drops duplicate code and fixes the silent-no-symbol bug.

All three changes are backward-compatible. The currency schema stays `z.string().optional()` (enum narrowing would reject decks using the still-valid ISO fallback); the rail/inline split keeps `rail` as the default; the shader warn fires only when the clip was already silently failing.
