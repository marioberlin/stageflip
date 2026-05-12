# `@stageflip/audience-slido`

Slido vendor `AudienceBackendProvider` adapter per ADR-009 §D8 (T-479).
First of five vendor bridges; bridges StageFlip's audience clip family
to Slido's hosted REST API.

## Posture

- **Stub mode** v1 — production REST integration gated on T-479a
  (Slido enterprise credentials + OAuth audit pending).
- **Capability**: 8 of 11 `AudienceClipKind` discriminants (omits the
  three motion-native differentiators per ADR-010 §D7 vendor parity
  matrix).
- **License**: `proprietary-byo` — tenants supply Slido API credentials
  via `TenantAdapterCredentialsStore` (T-444).
- **Sandbox**: `remote-network`.

## Usage

```ts
import { createSlidoAudienceProvider } from '@stageflip/audience-slido';

const provider = createSlidoAudienceProvider({ mode: 'stub' });
```

Production (T-479a):

```ts
const provider = createSlidoAudienceProvider({
  mode: 'production',
  baseUrl: 'https://api.slido.com/v1',
});
```
