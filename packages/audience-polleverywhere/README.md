# `@stageflip/audience-polleverywhere`

PollEverywhere vendor `AudienceBackendProvider` adapter per ADR-009 §D8 (T-479).
First of five vendor bridges; bridges StageFlip's audience clip family
to PollEverywhere's hosted REST API.

## Posture

- **Stub mode** v1 — production REST integration gated on T-481a
  (PollEverywhere enterprise credentials + OAuth audit pending).
- **Capability**: 8 of 11 `AudienceClipKind` discriminants (omits the
  three motion-native differentiators per ADR-010 §D7 vendor parity
  matrix).
- **License**: `proprietary-byo` — tenants supply PollEverywhere API credentials
  via `TenantAdapterCredentialsStore` (T-444).
- **Sandbox**: `remote-network`.

## Usage

```ts
import { createPollEverywhereAudienceProvider } from '@stageflip/audience-polleverywhere';

const provider = createPollEverywhereAudienceProvider({ mode: 'stub' });
```

Production (T-481a):

```ts
const provider = createPollEverywhereAudienceProvider({
  mode: 'production',
  baseUrl: 'https://api.polleverywhere.com/v1',
});
```
