---
'@stageflip/schema': minor
---

Security hardening per T-403 residual-risks register: LiveData SSRF endpoint host allowlist (R-1) + credential-header denylist (R-2) + WebEmbed sandbox-combination guard (R-3) (T-404, addresses §5 R-1 / R-2 / R-3 of `docs/security-review-track-a.md`). New exports: `LIVE_DATA_ALLOWED_HOST_PATTERNS`, `extendAllowedHosts`, `__resetAllowedHostsForTests`, `FORBIDDEN_REQUEST_HEADER_PATTERNS`, `FORBIDDEN_SANDBOX_COMBINATIONS`. Existing `liveDataClipPropsSchema` and `webEmbedClipPropsSchema` consumers MUST seed the host allowlist via `extendAllowedHosts` before parsing — default is deny-all (fail-closed).
