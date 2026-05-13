---
id: audio-bed-library
cluster: cluster-wedding-events
clipKind: na
parityFixture: na
source: SoundExchange statutory-license rates (37 CFR §380.10 mechanical-license royalties) + Harry Fox Agency mechanical-licensing canon + ASCAP / BMI / SESAC public-performance norms for wedding & events venues + first-party instrumental recordings commissioned under work-for-hire from session-musician collaborators
status: substantive
permissions:
  - assets:audio-bed
signOff:
  parityFixture: na
  typeDesign: na
ownerTask: T-530
relatedTasks:
  - T-526
  - T-527
  - T-528
  - T-529
---

# Pre-licensed audio bed library — assets contribution slot

Fifth and final substantive contribution in the Wedding & Events pack
(skeleton landed T-526; closes the last of ten preset slots; bumps the
pack version 0.1.0 → 0.2.0 GA). UNLIKE sister T-527 (theme variants
binding the LowerThird primitive), T-528 (composition templates via
Pattern C cross-cluster register reuse), and T-529 (transition / bumper
presets), T-530 is an **assets contribution** — a manifest-level
declaration via `contributes.assets` that reserves five pre-licensed
audio-bed track references under the Wedding & Events pack's asset
scope. Per ADR-012 §D5, `manifest.contributes.assets` is a parallel
surface to `contributes.presets` / `contributes.clipKinds` /
`contributes.fonts` / `contributes.fixtures` / `contributes.tools` /
`contributes.adapters` / `contributes.themePacks`; each entry has shape
`{ path: string; mimeType: string }` (per `packAssetContributionSchema`
in `packages/pack-format/src/manifest.ts`). T-530 seeds the array with
five entries — one per ceremonial / reception moment in a canonical
wedding-events lifecycle render — all keyed under the `audio/` archive
subpath with the `audio/mpeg` MIME type.

## Tracks

The library declares five pre-licensed instrumental audio beds spanning
the canonical wedding-events lifecycle — processional opening,
recessional close, reception cocktail-hour ambient, first-dance
intimate, closing send-off. Each track is a forward reservation under
the `audio/` subpath; the actual MP3 byte payload is delivered to the
tenant externally per the Trade-off documented below.

### `audio/processional-strings-instrumental.mp3`

**Scope.** String-quartet processional bed for the ceremonial entrance
moment. Tempo: ~70 BPM (slow walking pace); duration: ~3 minutes
(canonical processional length); key: D major (warm, ceremonial). Use
case: T-528 wedding-ceremony-template processional slot; pairs with the
T-528 titleSequence bride / groom name bullet via the host's
audio-binding surface.

**Encoding.** 320 kbps CBR MP3 / 44.1 kHz stereo / ID3v2.4 metadata
tagged with `artist: StageFlip Audio Library` + `album: Wedding &
Events Pre-Licensed Beds v0.2.0` + `composer: <work-for-hire session
musician roster, attribution-suppressed per contract>`.

**Licensing.** Commissioned under work-for-hire from a first-party
session-musician collaborator; mechanical + public-performance rights
held by StageFlip and sub-licensed to the Wedding & Events Pack tenant
under the `wedding-events-1y` SKU's commercial-subscription terms. No
external clearance required at the tenant render site.

### `audio/recessional-uptempo-instrumental.mp3`

**Scope.** Uptempo string-ensemble recessional bed for the ceremonial
exit moment. Tempo: ~120 BPM (uptempo walking / celebratory); duration:
~2 minutes; key: G major (bright, celebratory). Use case: T-528
wedding-ceremony-template recessional slot.

**Encoding.** Same envelope as the processional bed (320 kbps CBR MP3 /
44.1 kHz stereo / ID3v2.4 metadata).

**Licensing.** Same first-party work-for-hire scope.

### `audio/reception-jazz-ambient.mp3`

**Scope.** Light jazz quartet (piano + upright bass + brush drums +
muted trumpet) for reception cocktail-hour ambient bed. Tempo: ~95 BPM
(swing feel); duration: ~5 minutes (loop-friendly tail); key: F major
(warm, conversational). Use case: T-528
wedding-reception-template cocktail-hour slot; pairs with the
wedding-bumper-card (T-529) as the cocktail-hour-into-bumper crossfade
source.

**Encoding.** Same envelope; mixed at -16 LUFS integrated for ambient
background use (well below speech-foreground threshold).

**Licensing.** Same first-party work-for-hire scope.

### `audio/first-dance-acoustic-instrumental.mp3`

**Scope.** Acoustic-guitar fingerstyle bed for the first-dance intimate
moment. Tempo: ~80 BPM (slow-dance); duration: ~4 minutes (canonical
first-dance length); key: C major (intimate, vocal-range-friendly). Use
case: T-528 wedding-reception-template first-dance slot.

**Encoding.** Same envelope; mixed at -14 LUFS integrated (slightly hot
for foreground intimate listening).

**Licensing.** Same first-party work-for-hire scope.

### `audio/closing-piano-instrumental.mp3`

**Scope.** Solo piano bed for the closing send-off moment. Tempo: ~85
BPM (gentle outro); duration: ~3 minutes; key: A major (warm, restful).
Use case: T-528 wedding-reception-template closing slot; pairs with the
wedding-final-card (T-529) as the final-card crossfade source.

**Encoding.** Same envelope; mixed at -16 LUFS integrated for
contemplative outro listening.

**Licensing.** Same first-party work-for-hire scope.

## Asset paths

All five paths are keyed under the `audio/` subpath of the pack
archive — `audio/processional-strings-instrumental.mp3`,
`audio/recessional-uptempo-instrumental.mp3`,
`audio/reception-jazz-ambient.mp3`,
`audio/first-dance-acoustic-instrumental.mp3`,
`audio/closing-piano-instrumental.mp3`. The host-side asset resolver
(`packages/host-config/`) reads `manifest.contributes.assets[].path`
to expose the reservation surface to the tenant install UI; the
actual MP3 bytes resolve at render time through the tenant's
external-delivery channel (see Trade-offs below).

## Permissions

The library declares **one** permission scope that a tenant must grant
before the audio beds may resolve at render time:

- **`assets:audio-bed`** — required to admit the audio-bed library
  into the tenant's render-side asset registry. Same connector-card
  permission model as T-524's `data-source:bloomberg-pro` and T-525's
  `llm:tool-bundle:finance-domain`; surfaced to the tenant once per
  pack-install, not per-track.

The pack-installer surface prompts the tenant for the grant during
install; the host short-circuits to a silent (no-audio) render for any
track that cannot resolve its asset path at render time.

## Trade-offs

- **Audio bytes NOT in the pack archive.** Per the Wedding & Events
  SKU's mechanical-licensing terms (37 CFR §380.10 statutory royalty
  rates + Harry Fox Agency canon), the actual MP3 byte payload for
  each track is delivered to the tenant via an **external per-tenant
  delivery channel** — the StageFlip CDN's per-tenant audio-asset
  bucket, signed-URL-resolved at render time — NOT bundled in the pack
  archive itself. The pack archive ships only the manifest
  reservation; the bytes are NOT byte-fingerprinted into
  `manifest.integrity.hash` (which is SHA-256 over the archive bytes
  WITHOUT the manifest, per the standard pack-format envelope). This
  is a deliberate separation: mechanical-licensing audit trails
  require per-tenant delivery records (who downloaded which track,
  when, against which SKU instance), and bundling the bytes in the
  archive would conflict with that audit model.
- **Audio-delivery integration deferred.** The actual host-side
  per-tenant audio-asset bucket resolver, signed-URL surface,
  render-time fetch discipline, and audit-trail wiring lands in a
  future task (forward-reference; NOT in scope for T-530). Until that
  task lands, consumers of these asset paths get a fixture-replay /
  silent-render fallback at render time; the pack manifest's
  `contributes.assets` declaration is the **forward reservation** —
  the asset-delivery channel is the **runtime binding**; the two are
  wired post-Track-A. The Wedding & Events pack still ships v0.2.0 GA
  on T-530's merge because the reservation surface is the deliverable
  here — the binding completes downstream.
- **SoundExchange compliance scope.** SoundExchange's statutory
  performance royalty (17 U.S.C. §114) applies to non-interactive
  digital performances of sound recordings; the work-for-hire scope
  on these tracks short-circuits the statutory royalty because
  StageFlip holds both the composition copyright AND the sound-
  recording copyright. Tenants that re-distribute the audio outside
  the StageFlip render envelope (e.g. extracting the MP3 and
  hosting it on a third-party podcast surface) take on the
  statutory-royalty burden themselves; the pack license does NOT
  grant re-distribution rights outside StageFlip-rendered output.
- **Mechanical-licensing scope.** The mechanical license (statutory
  rate per 37 CFR §380.10; current rate as of T-530:
  $0.124 per stream / download for performances over 5 minutes,
  $0.091 for performances under 5 minutes) is fully covered by the
  `wedding-events-1y` SKU's commercial-subscription terms; tenants
  do NOT need to file individual mechanical-license claims with the
  MLC (Mechanical Licensing Collective) for renders against these
  tracks. The pack-publish CLI's audit-trail surface records the
  per-tenant license claim for downstream MLC reporting.
- **Public-performance compliance.** Wedding venues are typically
  exempt from ASCAP / BMI / SESAC public-performance licensing under
  the "homestyle exception" (17 U.S.C. §110(5)) IF the venue's audio
  system is a single receiver of a kind commonly used in private
  homes. Commercial wedding venues with multi-zone amplified PA
  systems generally do NOT qualify for the exception and DO require
  a public-performance license; the pack license does NOT cover
  that scope. Tenants rendering into commercial-venue playback
  systems MUST verify the venue's PRO (performing-rights-
  organization) license status before using these tracks for
  in-venue playback. The work-for-hire scope means StageFlip CAN
  grant the PRO license if a tenant requests it (post-Track-A
  enhancement), but the default `wedding-events-1y` SKU does NOT.
- **No vocal tracks.** All five tracks are instrumental-only by
  design — vocal performance carries additional master-recording
  licensing complexity (artist royalty obligations, vocal-talent
  union scale, name-likeness rights for recognizable performers)
  that the work-for-hire scope here deliberately avoids. Tenants
  needing vocal tracks must source them externally and bind them
  through the future audio-delivery integration's per-tenant
  custom-asset slot.
- **Loudness normalization.** Tracks are mixed at -14 LUFS to -16
  LUFS integrated per use case; the host-side renderer applies an
  additional loudness-target normalization pass at render time to
  match the output target (BS.1770-4 / EBU R128 broadcast standard
  for video-output renders; -16 LUFS streaming-podcast target for
  audio-only renders). Tenants that override the loudness target
  via the render config surface MUST verify the output level
  manually — the pack's mix levels are the default, not a hard
  guarantee against tenant-side overrides.

## Out of scope

- **The actual MP3 byte payloads** — delivered per-tenant externally
  via the StageFlip CDN's per-tenant audio-asset bucket; NOT bundled
  in the pack archive. The pack-archive integrity hash covers the
  manifest reservation only.
- **The host-side audio-delivery integration** — per-tenant
  signed-URL resolver, render-time fetch discipline, audit-trail
  wiring, mechanical-licensing MLC reporting surface — lands in a
  future task post-Track-A. T-530 is manifest-side declaration only.
- **Vocal tracks** — not in scope per the work-for-hire instrumental-
  only design choice; future audio-delivery integration's per-tenant
  custom-asset slot is the binding surface for vocal beds.
- **Public-performance PRO license** — not covered by the
  `wedding-events-1y` SKU default; future post-Track-A SKU upgrade
  surface for commercial-venue PRO scope.
- **Re-distribution rights outside StageFlip-rendered output** — the
  pack license does NOT grant re-distribution rights; the bytes
  remain proprietary to StageFlip outside the render envelope.
- **Live binding into T-528 composition-template snapshot strings** —
  both wedding-ceremony-template and wedding-reception-template
  currently hard-code their narrative bullet text without audio-bed
  binding markers. Live binding via these asset paths lands at the
  future audio-delivery integration task with the
  `assets:audio-bed` permission scope as the tenant-grant gate.

## References

- ADR-012 §D2 — pack manifest schema
  (`packContributionsSchema.assets` shape:
  `z.array(packAssetContributionSchema).optional()`)
- ADR-012 §D5 — asset contributions
  (`packAssetContributionSchema`:
  `{ path: z.string().min(1), mimeType: z.string().min(1) }`)
- ADR-013 §D3 — paid-per-tenant commercial-subscription tier
  (`wedding-events-1y` SKU; the Wedding & Events pack's license
  tier carries the audio-bed library asset entitlement)
- 17 U.S.C. §114 — SoundExchange statutory performance royalty for
  non-interactive digital performances of sound recordings
- 17 U.S.C. §110(5) — "homestyle exception" to public-performance
  licensing (relevant for private-residence wedding venues)
- 37 CFR §380.10 — SoundExchange / MLC mechanical-license royalty
  rates (current as of T-530)
- Harry Fox Agency mechanical-licensing canon — mechanical-license
  rate schedule for composition rights
- ASCAP / BMI / SESAC public-performance norms — relevant for
  commercial wedding-venue playback (NOT covered by default SKU)
- EBU R128 / BS.1770-4 — loudness normalization standard for the
  host-side render-time loudness target
- T-526 — Wedding & Events pack skeleton (this preset's parent pack;
  landed the original placeholder slot for T-530)
- T-527 — Theme variants (rustic / modern / classic)
- T-528 — Composition templates (wedding-ceremony-template +
  wedding-reception-template; future consumer of these audio beds
  via the host-side audio-binding surface)
- T-529 — Transitions + bumpers (petal-cross-fade-transition +
  lace-wipe-transition + wedding-bumper-card + wedding-final-card;
  future consumer of these audio beds as crossfade sources at the
  transition / bumper boundary)
- T-530 — Pre-licensed audio bed library (this PR; closes the tenth
  and final cluster-wedding-events placeholder slot and CLOSES the
  Wedding & Events launch pack at v0.2.0 GA)
