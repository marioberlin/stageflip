---
'@stageflip/runtimes-interactive': minor
'@stageflip/schema': minor
---

T-393 — `WebEmbedClip` `liveMount` (fourth γ-live family).

- New `webEmbedClipPropsSchema` on `@stageflip/schema` for `family: 'web-embed'` props (`url`, `sandbox` tokens, `allowedOrigins`, optional width/height overrides, `posterFrame`).
- New `webEmbedClipFactory` on `@stageflip/runtimes-interactive`. **No provider seam** — the browser's `<iframe>` element IS the runtime; the factory just creates and disposes the DOM. Mounts a single sandboxed iframe under the supplied root with `src` / `sandbox` / `width` / `height` attributes.
- `WebEmbedClipMountHandle` exposes `reload()` / `postMessage(msg)` / origin-filtered `onMessage(handler)`. `postMessage` forwards `targetOrigin = origin(props.url)` (NOT `'*'`).
- Two-stage inbound message filter: `event.source === iframe.contentWindow` AND `event.origin ∈ allowedOrigins`. Drops emit `web-embed-clip.message.dropped` with distinct `reason: 'source-mismatch' | 'origin-not-allowed' | ...` for security observability.
- 5-step dispose: remove window listener → `iframe.src='about:blank'` BEFORE detach → remove from DOM → clear handlers → emit telemetry. Idempotent.
- Telemetry privacy: `byteLength` integer + `targetOrigin` / `origin` / `url` ONLY — postMessage payload bodies NEVER in attributes (D-T393-8 / AC #17). Same posture as T-389 / T-391. `safeByteLength` wraps `JSON.stringify` in try/catch defensively against non-serializable data (Blob / ArrayBuffer / circular).
- `check-preset-integrity` gains invariant 13 for `family: 'web-embed'`.
- Skill expansion: `skills/stageflip/runtimes/web-embed/SKILL.md` placeholder → substantive; `concepts/runtimes/SKILL.md` adds fourth-family entry + reaffirms `ProviderSeam<T>` ruling at four shapes (no extraction); `concepts/clip-elements/SKILL.md` adds the `web-embed` row.

Pairs with T-394 (poster-screenshot staticFallback). After T-394 lands, `family: 'web-embed'` is structurally complete.
