/**
 * prng.test.ts — Unit tests for the deterministic PRNG utility.
 */

import { makePRNG } from '../src/utils/prng';

describe('makePRNG', () => {
  test('same seed always produces the same sequence', () => {
    const rng1 = makePRNG('test_seed');
    const rng2 = makePRNG('test_seed');

    for (let i = 0; i < 20; i++) {
      expect(rng1.float()).toBe(rng2.float());
    }
  });

  test('different seeds produce different sequences', () => {
    const rng1 = makePRNG('seed_a');
    const rng2 = makePRNG('seed_b');
    const vals1 = Array.from({ length: 10 }, () => rng1.float());
    const vals2 = Array.from({ length: 10 }, () => rng2.float());
    expect(vals1).not.toEqual(vals2);
  });

  test('float() returns values in [0, 1)', () => {
    const rng = makePRNG('bounds_test');
    for (let i = 0; i < 1000; i++) {
      const v = rng.float();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test('next(min, max) returns integers within [min, max]', () => {
    const rng = makePRNG('range_test');
    for (let i = 0; i < 500; i++) {
      const v = rng.next(1, 20);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  test('bool(1) always returns true', () => {
    const rng = makePRNG('bool_test');
    for (let i = 0; i < 50; i++) {
      expect(rng.bool(1)).toBe(true);
    }
  });

  test('bool(0) always returns false', () => {
    const rng = makePRNG('bool_zero');
    for (let i = 0; i < 50; i++) {
      expect(rng.bool(0)).toBe(false);
    }
  });

  test('bool(0.5) approximates 50% over many samples', () => {
    const rng = makePRNG('bool_half');
    let trueCount = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) {
      if (rng.bool(0.5)) trueCount++;
    }
    // Expect within 5% of 50%
    expect(trueCount / N).toBeGreaterThan(0.45);
    expect(trueCount / N).toBeLessThan(0.55);
  });

  test('deterministic across next() calls with known seed', () => {
    const rng = makePRNG('known_seed_42');
    const first = rng.next(1, 100);
    const second = rng.next(1, 100);
    // Verify reproducibility
    const rng2 = makePRNG('known_seed_42');
    expect(rng2.next(1, 100)).toBe(first);
    expect(rng2.next(1, 100)).toBe(second);
  });
});
