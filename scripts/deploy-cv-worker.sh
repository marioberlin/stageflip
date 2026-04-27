#!/usr/bin/env bash
# scripts/deploy-cv-worker.sh
# T-244-cv-worker — Cloud Run deploy script. Builds the cv-worker Docker
# image, pushes to Artifact Registry, and deploys as an authenticated Cloud
# Run service. Mirrors T-231's deployment pattern (.github/workflows/deploy.yml).
#
# Usage:
#   GCP_PROJECT_ID=stageflip-prod ./scripts/deploy-cv-worker.sh
#
# Required env vars:
#   GCP_PROJECT_ID       Target GCP project. No default.
#
# Optional env vars:
#   GCP_REGION           Cloud Run region. Default: us-central1.
#   GCP_REPO             Artifact Registry repo. Default: stageflip.
#   SERVICE_NAME         Cloud Run service name. Default: stageflip-cv-worker.
#   ENABLE_SAM2          Pass through to the runtime. Default: false.
#   MIN_INSTANCES        --min-instances. Default: 0 (cost-optimized).
#   MAX_INSTANCES        --max-instances. Default: 10.

set -euo pipefail

: "${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
REGION="${GCP_REGION:-us-central1}"
REPO="${GCP_REPO:-stageflip}"
SERVICE="${SERVICE_NAME:-stageflip-cv-worker}"
ENABLE_SAM2="${ENABLE_SAM2:-false}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
MAX_INSTANCES="${MAX_INSTANCES:-10}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_DIR="${REPO_ROOT}/services/cv-worker"
GIT_SHA="$(git -C "${REPO_ROOT}" rev-parse --short HEAD)"
IMAGE_TAG="$(date -u +%Y%m%d-%H%M%S)-${GIT_SHA}"
IMAGE_URI="${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${REPO}/${SERVICE}:${IMAGE_TAG}"

echo "==> Building image: ${IMAGE_URI}"
docker build -t "${IMAGE_URI}" "${SERVICE_DIR}"

echo "==> Pushing image"
docker push "${IMAGE_URI}"

echo "==> Deploying Cloud Run service: ${SERVICE} (region=${REGION})"
gcloud run deploy "${SERVICE}" \
  --project="${GCP_PROJECT_ID}" \
  --image="${IMAGE_URI}" \
  --region="${REGION}" \
  --platform=managed \
  --memory=4Gi \
  --cpu=2 \
  --concurrency=80 \
  --min-instances="${MIN_INSTANCES}" \
  --max-instances="${MAX_INSTANCES}" \
  --timeout=120 \
  --no-allow-unauthenticated \
  --set-env-vars="ENABLE_SAM2=${ENABLE_SAM2}"

echo "==> Deployed ${SERVICE} @ ${IMAGE_TAG}"
