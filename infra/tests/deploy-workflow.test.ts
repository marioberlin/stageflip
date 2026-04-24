// infra/tests/deploy-workflow.test.ts
// T-231 — deploy workflow shape checks. Guards against common drift
// (secret gate missing, wrong service list, skipping the Artifact
// Registry push) without running the workflow.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const yaml = readFileSync(path.join(ROOT, '.github/workflows/deploy.yml'), 'utf8');

describe('.github/workflows/deploy.yml', () => {
  it('guards on the GCP_WORKLOAD_IDENTITY_PROVIDER + GCP_SERVICE_ACCOUNT secrets', () => {
    expect(yaml).toContain('GCP_WORKLOAD_IDENTITY_PROVIDER');
    expect(yaml).toContain('GCP_SERVICE_ACCOUNT');
    expect(yaml).toMatch(/has_secrets/);
  });

  it('includes both Cloud Run targets in the deploy matrix', () => {
    expect(yaml).toContain('stageflip-api');
    expect(yaml).toContain('stageflip-render-worker');
  });

  it('references both Dockerfiles', () => {
    expect(yaml).toContain('apps/api/Dockerfile');
    expect(yaml).toContain('apps/render-worker/Dockerfile');
  });

  it('pushes to Artifact Registry before deploy', () => {
    const pushIdx = yaml.indexOf('docker push');
    const deployIdx = yaml.indexOf('gcloud run deploy');
    expect(pushIdx).toBeGreaterThan(-1);
    expect(deployIdx).toBeGreaterThan(-1);
    expect(pushIdx).toBeLessThan(deployIdx);
  });

  it('tags images with github.sha', () => {
    expect(yaml).toContain('github.sha');
  });

  it('uses federated auth (workload identity), not a long-lived key', () => {
    expect(yaml).toContain('google-github-actions/auth@v2');
    expect(yaml).toContain('workload_identity_provider');
    expect(yaml).not.toContain('credentials_json');
  });
});
