---
'@stageflip/scripts': patch
---

T-488 — Phase 15 GA readiness criteria. Extends `check-ga-readiness` with
Category 9 (12 criteria covering ADR ratification, 11 audience clip families,
6 audience-backend adapters, 6 Cluster I presets, 2 P15 CI gates, quiz
fairness, Firestore persistence, latency + SLA test scaffolds, parity-fixture
skeletons, and the human-gated security review). Inaugural report: 10 PASS /
1 FAIL / 1 WARN — sole FAIL is 9.1 (ADR-009/010 status flip is orchestrator
action); sole WARN is 9.12 (security review is human-gated).
