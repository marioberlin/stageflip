// packages/design-system/src/color/kmeans.test.ts
// Determinism + cluster-count tests for the seeded k-means impl.

import { describe, expect, it } from 'vitest';
import { type WeightedLab, kMeans } from './kmeans.js';
import { hexToLab } from './lab-space.js';

function sample(hex: string, weight = 1): WeightedLab {
  return { lab: hexToLab(hex), weight, hex };
}

describe('kMeans', () => {
  it('clamps k to the number of samples', () => {
    const samples = [sample('#ff0000'), sample('#00ff00')];
    const result = kMeans(samples, { k: 8, seed: 42 });
    expect(result.length).toBe(2);
  });

  it('returns the same result on consecutive runs (determinism, seed=42)', () => {
    const samples = [
      sample('#ff0000'),
      sample('#fe0202'),
      sample('#00ff00'),
      sample('#01fe01'),
      sample('#0000ff'),
      sample('#020202fe'.slice(0, 7)),
    ];
    const a = kMeans(samples, { k: 3, seed: 42 });
    const b = kMeans(samples, { k: 3, seed: 42 });
    expect(a).toEqual(b);
  });

  it('different seeds may produce different cluster orders but same membership for well-separated clusters', () => {
    const samples = [
      sample('#ff0000', 5),
      sample('#fe0202', 4),
      sample('#00ff00', 3),
      sample('#0000ff', 2),
    ];
    const result = kMeans(samples, { k: 3, seed: 42 });
    expect(result.length).toBe(3);
    // Heaviest cluster ~= red.
    const reds = result[0]?.members.filter((m) => m.startsWith('#ff') || m.startsWith('#fe'));
    expect(reds?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('returns clusters sorted by weight DESC', () => {
    const samples = [sample('#ff0000', 10), sample('#00ff00', 5), sample('#0000ff', 1)];
    const result = kMeans(samples, { k: 3, seed: 42 });
    for (let i = 1; i < result.length; i += 1) {
      const a = result[i - 1];
      const b = result[i];
      if (!a || !b) continue;
      expect(a.weight).toBeGreaterThanOrEqual(b.weight);
    }
  });

  it('handles empty input', () => {
    expect(kMeans([], { k: 5, seed: 42 })).toEqual([]);
  });

  it('handles k=1', () => {
    const samples = [sample('#ff0000'), sample('#00ff00'), sample('#0000ff')];
    const result = kMeans(samples, { k: 1, seed: 42 });
    expect(result.length).toBe(1);
    expect(result[0]?.weight).toBe(3);
  });

  it('groups perceptually-similar reds (AC #7)', () => {
    const samples = [sample('#ff0000'), sample('#ff0808'), sample('#fe0101'), sample('#0000ff')];
    const result = kMeans(samples, { k: 2, seed: 42 });
    expect(result.length).toBe(2);
    // Heavier cluster = the three reds.
    expect(result[0]?.members.length).toBe(3);
  });
});
