---
'@stageflip/schema': minor
---

Add font-license registry (T-307) per ADR-004 §D3. New surface:

- **Browser-safe** (`@stageflip/schema`): `FONT_LICENSE_ATOMS` 12-element
  enum, `fontLicenseAtomSchema`, `parseFontLicenseExpression` for free-form
  composite license strings (`'apache-2.0 + ofl'`, `'apache-2.0 / ofl /
  commercial-byo'`).
- **Node-only** (`@stageflip/schema/presets/node`): `FontLicenseRegistry` —
  builds a deduplicated index of every `(family, license)` pair across the
  loaded `PresetRegistry`, with `validateAgainstWhitelist` + audit-flag
  surfaces for downstream gates.

`scripts/check-licenses.ts` is extended with a font-license validation block;
unknown atoms now fail the gate. Additive — no breaking changes to T-304's
loader/registry surface.
