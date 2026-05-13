---
'@stageflip/pack-publish-cli': minor
---

T-501 — New `license <tier-id>` subcommand on `stageflip-pack-publish`
emits canned LICENSE.md / NOTICE.md / MANIFEST_LICENSE_SNIPPET.json
boilerplate for four canonical license tiers:
`commercial-subscription` (maps to `paid-per-tenant`),
`attribution-required` (Apache-2.0), `non-commercial-only` (CC-BY-4.0
as the closest SPDX in `OPEN_LICENSE_SPDX` — true non-commercial is
deferred to a future ADR), and `public-domain` (CC0-1.0). Templates
are inline TypeScript string constants (no separate `.md` files in
`src/templates/`), substituted via a Mustache-light `{{key}}`
replacer that throws on missing keys. Variables (`packName`,
`publisherDisplayName`, `year`, `sku`, `contactEmail`) have sensible
defaults; users override via repeated `--var k=v`. Defaults to
`./license-templates/`; refuses to overwrite existing files unless
`--force` is passed. Programmatic exports (`runLicense`, `TIER_IDS`,
`TEMPLATES`, `substitute`, `renderManifestSnippet`) let CI / build
scripts drive emission in-process. The `enterprise` pricing tier
from ADR-013 §D3 is deliberately not generated — enterprise terms
are negotiated bilaterally; a generated template would mislead.
New `skills/stageflip/concepts/licensing/SKILL.md` documents the
tier ID → `manifest.license.kind` mapping table + the
non-commercial limitation.
