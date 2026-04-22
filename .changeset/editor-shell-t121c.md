---
"@stageflip/editor-shell": minor
---

T-121c: `<EditorShell>` composition + localStorage persistence + i18n scaffold.

Completes the T-121 family. With this, every Phase 6 component port can
mount a real shell and depend on every hook resolving.

- **`<EditorShell>`** — one-component tree root composing
  `ShortcutRegistryProvider` → `DocumentProvider` → `AuthProvider`
  (outer → inner). Optional `initialDocument` seeds `documentAtom`;
  `initialLocale` flips the i18n catalog once on mount; `autosave`
  (off by default) enables debounced localStorage writes.

- **Persistence** — per-doc localStorage slots keyed by docId, a
  bounded recent-documents index (cap = `MAX_RECENT_DOCUMENTS` / 10),
  deduplication on re-save, graceful degradation (SSR, Safari private
  browsing, quota exceeded — every entry point swallows errors and
  returns a safe default). `useAutosaveDocument({ delayMs, serialize,
  enabled })` hook debounces document changes through
  `documentAtom` and writes via `JSON.stringify` (or a custom
  serializer). Schema validation deferred to the consumer — this
  layer is bytes-only.

- **i18n** — flat `Map<string, string>` catalog with `setLocale`,
  `getLocale`, `t(key, fallback?)`. Seeded with 80+ keys from the
  SlideMotion editor audit §8 (nav, common, export, onboarding,
  cloud, properties, shortcuts, copilot, command-palette, status).
  SlideMotion / Remotion branded strings rewritten as generic
  StageFlip copy — T-134 branding pass can edit any of them
  without touching call sites. Pseudo-localization mode
  (`setLocale('pseudo')`) renders every key as `⟦key⟧` for QA.

34 new tests; 125/125 total across editor-shell.
