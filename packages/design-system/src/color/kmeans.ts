// packages/design-system/src/color/kmeans.ts
// Seeded k-means in Lab color space. Hand-rolled — no SciPy / ML library
// dep per T-249 "no new TS deps." Determinism: seeded mulberry32 PRNG +
// stable tie-breaking + bounded iteration cap.

import { type Lab, deltaE } from './lab-space.js';

/** A weighted Lab sample (weight = element-coverage count). */
export interface WeightedLab {
  lab: Lab;
  weight: number;
  /** Original hex string — preserved through clustering for centroid-name lookup. */
  hex: string;
}

export interface KMeansClusterResult {
  /** Centroid in Lab. */
  centroid: Lab;
  /** Sum of sample weights assigned to this cluster. */
  weight: number;
  /** Member sample hex strings (deduplicated, sorted ascending). */
  members: string[];
}

export interface KMeansOptions {
  /** Target cluster count. Algorithm aims for `min(samples.length, k)`. */
  k: number;
  /** Seed for the deterministic PRNG. */
  seed: number;
  /** Max iterations before bailing out. Default 100. */
  maxIterations?: number;
  /** Convergence threshold — stop when the largest centroid shift is below this ΔE. Default 0.5. */
  convergenceDeltaE?: number;
}

/**
 * Mulberry32 — small, fast, deterministic 32-bit PRNG. Same algorithm used
 * by countless seeded-random libraries; reimplemented here to avoid a dep.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded k-means in Lab space.
 *
 * Initialization: deterministic k-means++ — pick the first centroid via the
 * seeded PRNG, then each subsequent centroid weighted by squared ΔE to the
 * nearest existing centroid. Stable for byte-identical seed/sample pairs.
 *
 * Stopping: max iterations OR every centroid moved less than
 * `convergenceDeltaE` from the previous iteration.
 *
 * Output ordering: clusters sorted by total weight DESC, then centroid hex
 * ASC for tie-breaking — guarantees a stable order across runs even when
 * cluster contents are identical.
 */
export function kMeans(samples: WeightedLab[], opts: KMeansOptions): KMeansClusterResult[] {
  if (samples.length === 0) return [];
  const k = Math.min(opts.k, samples.length);
  if (k <= 0) return [];
  const maxIter = opts.maxIterations ?? 100;
  const convergence = opts.convergenceDeltaE ?? 0.5;
  const rand = mulberry32(opts.seed);

  // k-means++ initialization.
  const centroids: Lab[] = [];
  // First centroid: weighted-random pick.
  const totalWeight = samples.reduce((s, x) => s + x.weight, 0);
  let pick = rand() * totalWeight;
  let idx = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    if (!sample) continue;
    pick -= sample.weight;
    if (pick <= 0) {
      idx = i;
      break;
    }
  }
  const first = samples[idx];
  if (!first) {
    return [];
  }
  centroids.push({ ...first.lab });

  while (centroids.length < k) {
    const distances = samples.map((s) => {
      let minD = Number.POSITIVE_INFINITY;
      for (const c of centroids) {
        const d = deltaE(s.lab, c);
        if (d < minD) minD = d;
      }
      return minD * minD * s.weight;
    });
    const total = distances.reduce((sum, d) => sum + d, 0);
    if (total <= 0) break;
    let pick2 = rand() * total;
    let pickIdx = 0;
    for (let i = 0; i < distances.length; i += 1) {
      const d = distances[i];
      if (d === undefined) continue;
      pick2 -= d;
      if (pick2 <= 0) {
        pickIdx = i;
        break;
      }
    }
    const next = samples[pickIdx];
    if (!next) break;
    // Avoid duplicate centroids.
    if (centroids.some((c) => deltaE(c, next.lab) < 0.001)) {
      // Fallback: pick the sample with the largest distance.
      let maxD = -1;
      let maxIdx = 0;
      for (let i = 0; i < distances.length; i += 1) {
        const d = distances[i];
        if (d !== undefined && d > maxD) {
          maxD = d;
          maxIdx = i;
        }
      }
      const fallback = samples[maxIdx];
      if (!fallback) break;
      if (centroids.some((c) => deltaE(c, fallback.lab) < 0.001)) break;
      centroids.push({ ...fallback.lab });
    } else {
      centroids.push({ ...next.lab });
    }
  }

  // Lloyd's algorithm.
  let assignments = new Array<number>(samples.length).fill(0);
  for (let iter = 0; iter < maxIter; iter += 1) {
    // Assign each sample to nearest centroid.
    const newAssignments = samples.map((s) => {
      let minD = Number.POSITIVE_INFINITY;
      let bestIdx = 0;
      for (let c = 0; c < centroids.length; c += 1) {
        const centroid = centroids[c];
        if (!centroid) continue;
        const d = deltaE(s.lab, centroid);
        if (d < minD) {
          minD = d;
          bestIdx = c;
        }
      }
      return bestIdx;
    });

    // Recompute centroids as weighted means.
    const newCentroids: Lab[] = centroids.map(() => ({ L: 0, a: 0, b: 0 }));
    const weightSums = new Array<number>(centroids.length).fill(0);
    for (let i = 0; i < samples.length; i += 1) {
      const sample = samples[i];
      const a = newAssignments[i];
      if (!sample || a === undefined) continue;
      const target = newCentroids[a];
      if (!target) continue;
      target.L += sample.lab.L * sample.weight;
      target.a += sample.lab.a * sample.weight;
      target.b += sample.lab.b * sample.weight;
      weightSums[a] = (weightSums[a] ?? 0) + sample.weight;
    }
    for (let c = 0; c < newCentroids.length; c += 1) {
      const target = newCentroids[c];
      const w = weightSums[c] ?? 0;
      if (!target) continue;
      if (w > 0) {
        target.L /= w;
        target.a /= w;
        target.b /= w;
      } else {
        // Empty cluster: keep the previous centroid.
        const prev = centroids[c];
        if (prev) {
          target.L = prev.L;
          target.a = prev.a;
          target.b = prev.b;
        }
      }
    }

    // Convergence check.
    let maxShift = 0;
    for (let c = 0; c < centroids.length; c += 1) {
      const prev = centroids[c];
      const next = newCentroids[c];
      if (!prev || !next) continue;
      const shift = deltaE(prev, next);
      if (shift > maxShift) maxShift = shift;
    }

    for (let c = 0; c < centroids.length; c += 1) {
      const target = newCentroids[c];
      if (target) centroids[c] = target;
    }
    assignments = newAssignments;

    if (maxShift < convergence) break;
  }

  // Build output clusters.
  const buckets: KMeansClusterResult[] = centroids.map((c) => ({
    centroid: c,
    weight: 0,
    members: [],
  }));
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    const a = assignments[i];
    if (!sample || a === undefined) continue;
    const bucket = buckets[a];
    if (!bucket) continue;
    bucket.weight += sample.weight;
    if (!bucket.members.includes(sample.hex)) {
      bucket.members.push(sample.hex);
    }
  }
  // Drop empty clusters.
  const nonEmpty = buckets.filter((b) => b.weight > 0);
  // Sort members for stability.
  for (const b of nonEmpty) {
    b.members.sort();
  }
  // Sort clusters: weight DESC, centroid-L ASC for ties (stable).
  nonEmpty.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (a.centroid.L !== b.centroid.L) return a.centroid.L - b.centroid.L;
    if (a.centroid.a !== b.centroid.a) return a.centroid.a - b.centroid.a;
    return a.centroid.b - b.centroid.b;
  });
  return nonEmpty;
}
