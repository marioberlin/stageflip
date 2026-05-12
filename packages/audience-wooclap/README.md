# `@stageflip/audience-wooclap`

Wooclap vendor `AudienceBackendProvider` adapter per ADR-009 §D8 (T-479).
First of five vendor bridges; bridges StageFlip's audience clip family
to Wooclap's hosted REST API.

## Posture

- **Stub mode** v1 — production REST integration gated on T-483a
  (Wooclap enterprise credentials + OAuth audit pending).
- **Capability**: 8 of 11 `AudienceClipKind` discriminants (omits the
  three motion-native differentiators per ADR-010 §D7 vendor parity
  matrix).
- **License**: `proprietary-byo` — tenants supply Wooclap API credentials
  via `TenantAdapterCredentialsStore` (T-444).
- **Sandbox**: `remote-network`.

## Usage

```ts
import { createWooclapAudienceProvider } from '@stageflip/audience-wooclap';

const provider = createWooclapAudienceProvider({ mode: 'stub' });
```

Production (T-483a):

```ts
const provider = createWooclapAudienceProvider({
  mode: 'production',
  baseUrl: 'https://api.wooclap.com/v1',
});
```
