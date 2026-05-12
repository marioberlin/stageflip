# `@stageflip/audience-vevox`

Vevox vendor `AudienceBackendProvider` adapter per ADR-009 §D8 (T-479).
First of five vendor bridges; bridges StageFlip's audience clip family
to Vevox's hosted REST API.

## Posture

- **Stub mode** v1 — production REST integration gated on T-482a
  (Vevox enterprise credentials + OAuth audit pending).
- **Capability**: 8 of 11 `AudienceClipKind` discriminants (omits the
  three motion-native differentiators per ADR-010 §D7 vendor parity
  matrix).
- **License**: `proprietary-byo` — tenants supply Vevox API credentials
  via `TenantAdapterCredentialsStore` (T-444).
- **Sandbox**: `remote-network`.

## Usage

```ts
import { createVevoxAudienceProvider } from '@stageflip/audience-vevox';

const provider = createVevoxAudienceProvider({ mode: 'stub' });
```

Production (T-482a):

```ts
const provider = createVevoxAudienceProvider({
  mode: 'production',
  baseUrl: 'https://api.vevox.com/v1',
});
```
