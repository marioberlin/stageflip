# Render farm vendor evaluation (T-266)

Status: draft
Last updated: 2026-04-27
Owner: T-266
Related: `packages/render-farm/`, `services/blender-worker/`, ADR-003

The render-farm adapter pattern (`@stageflip/render-farm`) decouples the bake
worker (T-265) from any specific GPU-cloud vendor. This document evaluates
the candidate vendors and records the v1 recommendation. Whoever ships the
real K8s adapter implementation (whenever the first prod load demands it) is
free to revisit this — it captures current best-guess only.

## Adapter contract recap

The contract is `RenderFarmAdapter` in `packages/render-farm/src/contract.ts`.
A vendor implementation provides:

- `submitJob(job)` — schedule a bake on the vendor's compute.
- `cancelJob(jobId)` — best-effort cancellation.
- `getJobStatus(jobId)` — query lifecycle state.
- `streamLogs(jobId, opts?)` — optional; vendors without log streaming may omit.
- `capabilities` — static description: GPU types, fast scale-up, max concurrency.
- `vendor` — identifier emitted in OTel spans.

The selector (`getRenderFarmAdapter(env)`) reads
`STAGEFLIP_RENDER_FARM_ADAPTER` and returns the configured implementation.
Defaults to `'in-memory'` for local dev and CI.

The bake worker (T-265) emits state markers
(`STAGEFLIP_RENDER_FARM_STARTED bakeId=…` and `…_FINISHED bakeId=… status=…`)
to stdout. The in-memory adapter parses these to drive lifecycle transitions.
Real K8s adapters ignore them — they read pod status from the Kubernetes API.

## Candidate vendors

### CoreWeave Cloud

- **Cost / GPU-hr**: $0.40 (A40) – $2.40 (H100). Cheapest GPU/hr in the
  candidate set.
- **GPU types**: A40, A100, H100, RTX A4000/A5000/A6000.
- **Fast scale**: <30s typical pod start (warm pool).
- **Ops surface**: medium — their managed Kubernetes plus a CLI (`kubectl`
  with their context). Some CoreWeave-specific CRDs.
- **Lock-in risk**: **low**. CoreWeave is K8s-native, so the underlying Pod
  spec ports cleanly to GKE / EKS. Their CRDs (Virtual Server) are an
  abstraction we don't strictly need for batch bakes.
- **Notable**: known for ML-training workloads; bakes (Cycles renders) are
  similar profile (GPU-bound, deterministic, idempotent).
- **Reference**: <https://docs.coreweave.com/>

### Paperspace Gradient (DigitalOcean)

- **Cost / GPU-hr**: $0.30 (A4000) – $3.00 (H100). Comparable to CoreWeave on
  the low end; pricier on H100.
- **GPU types**: A4000, A5000, A6000, A100, H100.
- **Fast scale**: ~60s pod start (no warm pool exposed).
- **Ops surface**: low — fully managed Gradient platform with a REST API + a
  hosted Web UI. Less control over the Kubernetes layer.
- **Lock-in risk**: **medium**. Gradient is a higher-level abstraction —
  their job spec is Paperspace-specific. Migration would require rewriting
  the adapter, but only the adapter (the contract is stable).
- **Notable**: simplest ops surface; good fit if we don't want to run K8s.
- **Reference**: <https://docs.digitalocean.com/products/paperspace/>

### Self-hosted K8s (GKE / EKS / AKS)

- **Cost / GPU-hr**: varies — provisioned cost (commit) plus per-instance
  GPU pricing. GKE Autopilot with spot A100s lands around $0.60–1.20 / hr.
- **GPU types**: any GPU the underlying cloud offers (we'd start with
  T4/A100 on GCP).
- **Fast scale**: depends on cluster autoscaler config. With node-auto-
  provisioning and warm spare capacity, ~45–90s.
- **Ops surface**: **high** — full Kubernetes ops responsibility. GKE
  Autopilot reduces this significantly (node management is automated;
  patches roll out on Google's schedule).
- **Lock-in risk**: **none** — vanilla Pod specs port to any Kubernetes.
- **Notable**: single-cloud surface (we're already on GCP for Firebase +
  Storage), full control over GPU type + region, spot instances for non-
  critical bakes.

## Cost / throughput / ops summary

| Vendor              | Cost / GPU-hr | GPU types       | Fast scale | Ops surface | Lock-in |
|---------------------|---------------|------------------|------------|-------------|---------|
| CoreWeave           | $0.40–2.40    | A40, A100, H100  | <30s       | Medium      | Low     |
| Paperspace Gradient | $0.30–3.00    | A4000–H100       | ~60s       | Low         | Medium  |
| GKE Autopilot       | $0.60–1.20    | T4/A100 (any)    | ~45–90s    | High*       | None    |

\* GKE Autopilot reduces node-level ops to near-zero; the "high" rating is
relative to Paperspace, not absolute.

## Recommendation (v1, non-binding)

**Self-hosted K8s on GKE Autopilot** for v1 because:

- Already on GCP (Firebase + Storage + future Cloud SQL) — single-cloud
  surface, single billing, single IAM. Cross-cloud egress costs are
  significant for GB-scale bake outputs.
- GKE Autopilot reduces ops burden to near-zero for batch workloads.
- Spot instances are cheap (~$0.30–0.60 / GPU-hr on T4) for non-urgent bakes.
- Full control over GPU type + region — important for T-271 EU residency.
- Vanilla Pod specs port to CoreWeave / EKS / AKS without rewriting beyond
  the adapter.

**The adapter pattern means we can swap.** If GPU/hr cost dominates we move
to CoreWeave. If ops complexity dominates we move to Paperspace. The
`@stageflip/render-farm` consumer code does not change.

## Migration path between vendors

Switching vendors is a three-step PR:

1. Implement a new adapter, e.g. `CoreWeaveRenderFarmAdapter`, conforming to
   the `RenderFarmAdapter` contract.
2. Extend the selector switch in `packages/render-farm/src/selector.ts` to
   accept `'coreweave'`.
3. Roll out: set `STAGEFLIP_RENDER_FARM_ADAPTER=coreweave` in the worker's
   env. The bake worker (T-265) is unchanged.

There is no rolling cutover at the queue level — the BullMQ queue stays
single-vendor at any moment in time. To migrate without downtime, drain the
existing queue (stop submitting new bakes; let in-flight finish), flip the
env, deploy. BullMQ jobs are idempotent (manifest.json check), so a worker
restart mid-bake retries cleanly.

## Open questions for whoever ships the K8s adapter

- **Container image registry** — GCR, Docker Hub, GitHub Container Registry?
  GCR is simplest given GKE residency.
- **Worker image build pipeline** — currently the worker is in
  `services/blender-worker/`. Image build CI lives in `.github/workflows/`
  and pushes on `main` merges (not yet wired).
- **Job priority / preemption** — bakes are batch; spot instances are fine
  if we add resume-from-frame logic. Cycles' deterministic mode means we
  can resume mid-bake by re-running the worker; the manifest idempotency
  check (T-265 AC #20) handles this for cache-hit paths.
- **Per-org quotas** — currently the BullMQ queue + rate-limit bucket cap
  org concurrency at the submit boundary. K8s-level isolation (namespaces?
  resource quotas?) is a larger conversation.

## Cross-links

- `packages/render-farm/src/contract.ts` — adapter interface.
- `packages/render-farm/src/in-memory.ts` — local-dev adapter (child_process).
- `packages/render-farm/src/k8s-stub.ts` — stub awaiting vendor pick.
- `services/blender-worker/` — the consumer.
- `skills/stageflip/concepts/runtimes/SKILL.md` — runtime tier overview +
  render-farm deployment summary.
- ADR-003 — three-tier runtime model.
