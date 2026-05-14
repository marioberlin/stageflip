---
'@stageflip/runtimes-interactive': minor
---

Close T-403 residual risk R-4: ThreeSceneClip dynamic-import allowlist. setup-resolver.ts now requires the requested modulePath to match a prefix in SETUP_REF_TRUSTED_MODULE_PREFIXES before invoking dynamic `import()`. Empty default = deny-all (fail-closed); extendTrustedModulePrefixes() startup hook seeds the list. Mirrors T-404 R-1's LiveData SSRF allowlist convention per PO decision (Codex security review).
