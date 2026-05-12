# `@stageflip/audience-native`

First concrete `AudienceBackendProvider` implementation per ADR-009
§D2 — the audience-modality analog of the 9 P14 reference adapters
(T-426..T-434). Wraps the `AudienceResultsStore` from T-453 (in-memory)
+ T-474 (Firestore).

## Posture

- **Stub mode** v1 — matches the P14 reference-adapter convention.
  Production HTTP-transport wire-up (for non-co-located deployments)
  is gated on T-478a.
- **Capability**: supports all 11 `AudienceClipKind` discriminants
  including the three motion-native differentiators (Heatmap /
  ReactionStream / AudienceAiPrompt) — native is the ONLY adapter
  that reaches motion-native per ADR-010 §D7.
- **SLA**: matches ADR-009 §D4 — `maxConcurrentVoters: 1000`,
  `snapshotCadenceHz: 30`, `maxIngestRateHz: 100`.

## Usage

```ts
import { createAudienceNativeProvider } from '@stageflip/audience-native';
import { InMemoryAudienceResultsStore } from '@stageflip/storage';

const provider = createAudienceNativeProvider({
  store: new InMemoryAudienceResultsStore({ pepper: process.env.AUDIENCE_PEPPER! }),
});

await provider.openSession({
  tenantId: 'tenant-1',
  projectId: 'proj-1',
  sessionId: 'sess-x',
  clipKind: 'live-poll-multiple-choice',
});
```

Production: swap the in-memory store for `createFirebaseAudienceResultsStore`
from `@stageflip/storage-firebase` (T-474).
