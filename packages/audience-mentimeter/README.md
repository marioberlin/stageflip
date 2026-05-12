# `@stageflip/audience-mentimeter`

Mentimeter vendor `AudienceBackendProvider` adapter per ADR-009 §D8 (T-479).
First of five vendor bridges; bridges StageFlip's audience clip family
to Mentimeter's hosted REST API.

## Posture

- **Stub mode** v1 — production REST integration gated on T-479a
  (Mentimeter enterprise credentials + OAuth audit pending).
- **Capability**: 8 of 11 `AudienceClipKind` discriminants (omits the
  three motion-native differentiators per ADR-010 §D7 vendor parity
  matrix).
- **License**: `proprietary-byo` — tenants supply Mentimeter API credentials
  via `TenantAdapterCredentialsStore` (T-444).
- **Sandbox**: `remote-network`.

## Usage

```ts
import { createMentimeterAudienceProvider } from '@stageflip/audience-mentimeter';

const provider = createMentimeterAudienceProvider({ mode: 'stub' });
```

Production (T-479a):

```ts
const provider = createMentimeterAudienceProvider({
  mode: 'production',
  baseUrl: 'https://api.mentimeter.com/v1',
});
```
