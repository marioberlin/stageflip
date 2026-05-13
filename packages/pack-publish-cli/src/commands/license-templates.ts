// packages/pack-publish-cli/src/commands/license-templates.ts
// T-501 — Inline LICENSE/NOTICE/manifest-snippet templates for the
// four canonical license tiers used by `stageflip-pack-publish license`.
//
// Content is shipped as TypeScript template-literal string constants
// (no separate `.md` files in `src/templates/`) so the package's dist
// is self-contained: no filesystem-relative resolution from a compiled
// `.js` whose cwd is not the publisher's pack directory. The `{{key}}`
// substituter is a Mustache-light pure function — no logic, no
// partials, just `vars[key]` replacement.
//
// Determinism perimeter: this package lives OUTSIDE.

/** The four canonical license tier IDs supported by `license <tier>`. */
export const TIER_IDS = [
  'commercial-subscription',
  'attribution-required',
  'non-commercial-only',
  'public-domain',
] as const;

/** Discriminated string union of supported tier IDs. */
export type TierId = (typeof TIER_IDS)[number];

/** Bundle of generated artefacts produced for a single tier. */
export interface TierTemplates {
  /** Markdown body for `LICENSE.md`. */
  readonly licenseMarkdown: string;
  /** Markdown body for `NOTICE.md`. */
  readonly noticeMarkdown: string;
  /** Object to drop under `manifest.license` (already valid per pack-format). */
  readonly manifestSnippet: Readonly<Record<string, unknown>>;
  /** SPDX identifier or `LicenseRef-*` for non-standard tiers. */
  readonly spdxOrLicenseRef: string;
  /** Variable keys the tier requires when rendering (after defaults are applied). */
  readonly requiredVars: readonly string[];
}

// ----------------------------------------------------------------------------
// Substituter
// ----------------------------------------------------------------------------

/**
 * Replace every `{{key}}` occurrence in `template` with `vars[key]`.
 *
 * Repeated occurrences are all replaced. Text outside `{{...}}` is
 * untouched. Throws `Error` (message includes the missing key) when a
 * `{{key}}` has no entry in `vars` — the caller is expected to layer
 * defaults underneath user-supplied vars before calling.
 *
 * @param template Raw template body containing zero or more `{{key}}`.
 * @param vars Variable lookup table (string → string).
 * @returns Rendered string with every placeholder replaced.
 */
export function substitute(template: string, vars: Readonly<Record<string, string>>): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) {
      throw new Error(`substitute: missing template variable '${key}'`);
    }
    return vars[key] ?? '';
  });
}

// ----------------------------------------------------------------------------
// commercial-subscription
// ----------------------------------------------------------------------------

const COMMERCIAL_LICENSE = `# {{packName}} — Commercial License

Copyright (c) {{year}} {{publisherDisplayName}}

SPDX-License-Identifier: LicenseRef-StageFlip-Commercial-1.0

This pack ({{packName}}, SKU: {{sku}}) is licensed under a commercial
subscription. Use of this pack on a StageFlip-compatible platform
requires a valid, paid entitlement issued to the using tenant by
{{publisherDisplayName}} or an authorised reseller.

1. **Grant.** Subject to payment of the applicable fees and continued
   compliance with these terms, {{publisherDisplayName}} grants the
   tenant a non-exclusive, non-transferable, revocable licence to use
   the pack on the platform for the duration of the subscription.

2. **Restrictions.** The tenant MUST NOT redistribute the pack,
   sub-license it, or use it on behalf of any third party not covered
   by the entitlement. The tenant MUST NOT remove or alter copyright,
   trademark, or attribution notices.

3. **Termination.** This licence terminates automatically on
   non-payment, expiry, or revocation of the entitlement. On
   termination the runtime is required to refuse to load the pack;
   any cached pack assets must not be used.

4. **No warranty.** The pack is provided "AS IS", without warranty of
   any kind, express or implied. {{publisherDisplayName}} disclaims
   all liability arising from use of the pack to the maximum extent
   permitted by applicable law.

5. **Trademarks.** "{{publisherDisplayName}}" and the {{packName}}
   name are trademarks of {{publisherDisplayName}}. Nothing in this
   licence grants the tenant any right to use those marks except as
   strictly required to identify the source of the pack.

For licensing inquiries contact: {{contactEmail}}
`;

const COMMERCIAL_NOTICE = `# {{packName}} — Notice

This pack is distributed under a commercial subscription licence
issued by {{publisherDisplayName}}. See LICENSE.md for the full terms.

## Attribution required

Tenants displaying content rendered by this pack are not required to
display attribution unless their entitlement specifies otherwise.

## Open-source dependencies

This pack may bundle open-source components. Each such component
retains its original licence; the relevant texts (where required) are
reproduced in the directory \`vendor/\` of this pack. The presence of
open-source components does not affect the commercial licensing of
the pack as a whole.

## Trademark notice

"{{publisherDisplayName}}", "{{packName}}", and all related names,
logos, and marks are trademarks of {{publisherDisplayName}}. Use of
these marks outside the scope of identifying the source of this pack
requires prior written permission.

For all enquiries contact: {{contactEmail}}
`;

// ----------------------------------------------------------------------------
// attribution-required (Apache-2.0)
// ----------------------------------------------------------------------------

const ATTRIBUTION_LICENSE = `# {{packName}} — License

SPDX-License-Identifier: Apache-2.0

Copyright (c) {{year}} {{publisherDisplayName}}

Licensed under the Apache License, Version 2.0 (the "License"); you
may not use this pack except in compliance with the License. You may
obtain a copy of the License at:

  https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied. See the License for the specific language governing
permissions and limitations under the License.

This pack is a "Derivative Work" under §1 of the Apache 2.0 License
when bundled with the StageFlip runtime; the NOTICE.md file in this
pack MUST be preserved verbatim in any redistribution per §4(d).

## Trademark disclaimer

Apache 2.0 §6 disclaims any trademark licence. "{{publisherDisplayName}}"
and "{{packName}}" remain trademarks of {{publisherDisplayName}}.
`;

const ATTRIBUTION_NOTICE = `# {{packName}} — Notice

{{packName}}
Copyright (c) {{year}} {{publisherDisplayName}}

This product includes software developed by {{publisherDisplayName}}.
Redistribution in source or binary form must reproduce this NOTICE
file in accordance with §4(d) of the Apache License, Version 2.0.

## Attribution required

Tenants displaying content rendered by this pack should include the
following attribution string in a credits panel or equivalent UI
surface visible to the end user:

  "{{packName}}" by {{publisherDisplayName}}, licensed Apache-2.0

## Open-source dependencies

This pack may bundle additional open-source components. Each such
component retains its original licence; the relevant texts are
reproduced under \`vendor/\`. The Apache-2.0 licence applies to the
pack content itself, not to bundled third-party components.

## Trademark notice

"{{packName}}" is a trademark of {{publisherDisplayName}}. The
Apache-2.0 licence does not grant rights to use the {{packName}} or
{{publisherDisplayName}} names, logos, or marks.
`;

// ----------------------------------------------------------------------------
// non-commercial-only (CC-BY-4.0 closest SPDX in OPEN_LICENSE_SPDX)
// ----------------------------------------------------------------------------

const NON_COMMERCIAL_LICENSE = `# {{packName}} — License

SPDX-License-Identifier: CC-BY-4.0

Copyright (c) {{year}} {{publisherDisplayName}}

This pack is licensed under the Creative Commons Attribution 4.0
International License ("CC-BY-4.0"). You may obtain a copy of the
license at:

  https://creativecommons.org/licenses/by/4.0/legalcode

Under CC-BY-4.0 you are free to share and adapt the pack for any
purpose, including commercial purposes, provided you give appropriate
credit, provide a link to the license, and indicate if changes were
made.

## Non-commercial intent rider

The pack author's INTENT is non-commercial use. CC-BY-4.0 is the
closest SPDX identifier in the StageFlip OPEN_LICENSE_SPDX whitelist
("MIT", "Apache-2.0", "CC-BY-4.0", "CC0-1.0") that requires
attribution; a true "non-commercial-only" licence (CC-BY-NC-4.0) is
not currently representable in the pack-format LicenseClaim
discriminated union. This limitation is deferred to a future ADR
that grows the union.

Until then, tenants intending to use this pack in a commercial
context are asked to contact the publisher first.

## Trademark disclaimer

CC-BY-4.0 §2(b) disclaims trademark licensing. "{{publisherDisplayName}}"
and "{{packName}}" remain trademarks of {{publisherDisplayName}}.
`;

const NON_COMMERCIAL_NOTICE = `# {{packName}} — Notice

{{packName}}
Copyright (c) {{year}} {{publisherDisplayName}}

Licensed under CC-BY-4.0.

## Attribution required

Tenants displaying content rendered by this pack MUST include the
following attribution string in a credits panel or equivalent UI
surface visible to the end user:

  "{{packName}}" by {{publisherDisplayName}} (CC-BY-4.0)

## Open-source dependencies

This pack may bundle additional open-source components. Each such
component retains its original licence; the relevant texts are
reproduced under \`vendor/\`.

## Trademark notice

"{{packName}}" is a trademark of {{publisherDisplayName}}. The
CC-BY-4.0 licence does not grant rights to use the {{packName}} or
{{publisherDisplayName}} names, logos, or marks.
`;

// ----------------------------------------------------------------------------
// public-domain (CC0-1.0)
// ----------------------------------------------------------------------------

const PUBLIC_DOMAIN_LICENSE = `# {{packName}} — License

SPDX-License-Identifier: CC0-1.0

Copyright (c) {{year}} {{publisherDisplayName}}

To the extent possible under law, {{publisherDisplayName}} has waived
all copyright and related or neighbouring rights to this pack under
the Creative Commons CC0 1.0 Universal Public Domain Dedication. The
pack is dedicated to the public domain worldwide.

You may obtain a copy of the dedication at:

  https://creativecommons.org/publicdomain/zero/1.0/legalcode

You can copy, modify, distribute, and perform the pack, even for
commercial purposes, all without asking permission.

## Trademark disclaimer

CC0-1.0 expressly does NOT waive trademark rights.
"{{publisherDisplayName}}" and "{{packName}}" remain trademarks of
{{publisherDisplayName}}; the public-domain dedication does not grant
any right to use those marks.
`;

const PUBLIC_DOMAIN_NOTICE = `# {{packName}} — Notice

{{packName}}
Copyright (c) {{year}} {{publisherDisplayName}}

Dedicated to the public domain under CC0-1.0.

## Attribution required

No attribution is required to use, copy, modify, or redistribute
this pack. Attribution is appreciated but not legally compelled.

## Open-source dependencies

This pack may bundle additional open-source components. Each such
component retains its original licence (which may differ from CC0-1.0);
the relevant texts are reproduced under \`vendor/\`. The CC0-1.0
dedication applies to the pack content itself, not to bundled
third-party components.

## Trademark notice

"{{packName}}" is a trademark of {{publisherDisplayName}}. The
CC0-1.0 dedication does not grant rights to use the {{packName}} or
{{publisherDisplayName}} names, logos, or marks.
`;

// ----------------------------------------------------------------------------
// Templates registry
// ----------------------------------------------------------------------------

/**
 * Registry of templates keyed by tier ID. Every entry contains the
 * LICENSE markdown, NOTICE markdown, the manifest snippet, the SPDX
 * identifier, and the set of required substitution variables.
 */
export const TEMPLATES: Readonly<Record<TierId, TierTemplates>> = {
  'commercial-subscription': {
    licenseMarkdown: COMMERCIAL_LICENSE,
    noticeMarkdown: COMMERCIAL_NOTICE,
    manifestSnippet: {
      kind: 'paid-per-tenant',
      sku: '{{sku}}',
      entitlementType: 'subscription',
    },
    spdxOrLicenseRef: 'LicenseRef-StageFlip-Commercial-1.0',
    requiredVars: ['packName', 'publisherDisplayName', 'year', 'sku', 'contactEmail'],
  },
  'attribution-required': {
    licenseMarkdown: ATTRIBUTION_LICENSE,
    noticeMarkdown: ATTRIBUTION_NOTICE,
    manifestSnippet: {
      kind: 'open',
      spdx: 'Apache-2.0',
    },
    spdxOrLicenseRef: 'Apache-2.0',
    requiredVars: ['packName', 'publisherDisplayName', 'year'],
  },
  'non-commercial-only': {
    licenseMarkdown: NON_COMMERCIAL_LICENSE,
    noticeMarkdown: NON_COMMERCIAL_NOTICE,
    manifestSnippet: {
      kind: 'open',
      spdx: 'CC-BY-4.0',
    },
    spdxOrLicenseRef: 'CC-BY-4.0',
    requiredVars: ['packName', 'publisherDisplayName', 'year'],
  },
  'public-domain': {
    licenseMarkdown: PUBLIC_DOMAIN_LICENSE,
    noticeMarkdown: PUBLIC_DOMAIN_NOTICE,
    manifestSnippet: {
      kind: 'open',
      spdx: 'CC0-1.0',
    },
    spdxOrLicenseRef: 'CC0-1.0',
    requiredVars: ['packName', 'publisherDisplayName', 'year'],
  },
};

/**
 * Render a tier's manifest snippet with `{{sku}}` substituted (for
 * commercial-subscription) or returned unchanged (for the open tiers).
 *
 * @param tier Tier ID.
 * @param vars Substitution map; only `sku` is consulted.
 * @returns Plain object suitable for embedding under `manifest.license`.
 */
export function renderManifestSnippet(
  tier: TierId,
  vars: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const snippet = TEMPLATES[tier].manifestSnippet;
  const rendered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(snippet)) {
    if (typeof v === 'string') {
      rendered[k] = substitute(v, vars);
    } else {
      rendered[k] = v;
    }
  }
  return rendered;
}
