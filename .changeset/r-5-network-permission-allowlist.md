---
'@stageflip/runtimes-interactive': minor
---

Close T-403 residual risk R-5: network permission no-op grant replaced
with a global host allowlist + warn-then-enforce rollout (30-day grace
window, ENFORCEMENT_STARTS_AT 2026-06-13). Adds `network-allowlist.ts`
(extendNetworkAllowedHosts hook, evaluateNetworkGate pure function,
isNetworkHostAllowed predicate). PermissionShim.requestPermission(`network`)
still returns true during the warn window but now records the gate
decision via lastNetworkGateDecision for telemetry. PO decision
(2026-05-14) via Codex security review.
