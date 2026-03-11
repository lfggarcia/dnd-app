/**
 * prng.ts — Shared PRNG utility for the entire TORRE project.
 *
 * Algorithm: djb2 hash + LCG (Linear Congruential Generator)
 * Used in: combatEngine, dungeonGraphService, worldSimulator,
 *          moralSystem, encounterService, essenceService, etc.
 *
 * NEVER define makePRNG inline in any service — always import from here.
 * NI-03: this file is the single source of truth for deterministic RNG.
 */

export type PRNG = {
  /** Returns a float in [0.0, 1.0) */
  float(): number;
  /** Returns an integer in [min, max] inclusive */
  next(min: number, max: number): number;
  /** Returns true with the given probability [0, 1] */
  bool(probability: number): boolean;
};

/**
 * Creates a deterministic PRNG seeded from a string.
 * The same seed always produces the same sequence.
 *
 * @example
 * const rng = makePRNG('world_seed_combat_room_42');
 * const roll = rng.next(1, 20);  // always same for this seed
 */
export function makePRNG(seed: string): PRNG {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 33) ^ seed.charCodeAt(i)) >>> 0;
  }
  let s = h >>> 0;

  const advance = (): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s;
  };

  return {
    float(): number {
      return advance() / 0x100000000;
    },
    next(min: number, max: number): number {
      return Math.floor(this.float() * (max - min + 1)) + min;
    },
    bool(probability: number): boolean {
      return this.float() < probability;
    },
  };
}
