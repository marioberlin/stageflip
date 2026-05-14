---
'@stageflip/pack-discovery': minor
---

T-546 — Add editor-side recommendation surface to `@stageflip/pack-discovery`:
`ClusterUsageTracker` observes which clusters the tenant's clips
belong to, `rankRecommendationsForEditor` wraps the T-504 base
recommender with that signal, `RecommendationCache` provides a TTL
cache for re-ranking on every document change, and
`makeDiscoveryEvent` constructs typed telemetry events
(`impression` / `click` / `install` / `dismiss`) the editor emits on
user interaction with recommendation rows. The base scoring rules
remain untouched in `recommender.ts`.
