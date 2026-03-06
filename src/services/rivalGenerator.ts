/**
 * Deterministic rival group generator for TORRE.
 *
 * Names are derived from single-word D&D 5e monster names stored in the
 * local SQLite DB ('monsters' endpoint). Falls back to a curated SRD pool
 * when the DB hasn't been synced yet.
 *
 * Format: PREFIX_CREATURE  (terminal code style, ALL_CAPS)
 * Example: PACTO_BASILISCO · ORDEN_WYVERN · LEGIÓN_LICH
 */

import { getResourcesByEndpoint } from '../database';

// ─── Types ────────────────────────────────────────────────

export type RivalEntry = {
  name: string;
  floor: number;
  status: 'waiting' | 'active' | 'defeated';
  rep: number;
};

// ─── Fallback creature pool (D&D 5e SRD, Hispanicized) ───
// Used when the 'monsters' DB table hasn't been synced yet.

const FALLBACK_CREATURES: readonly string[] = [
  'HIDRA',    'BASILISCO', 'WYVERN',   'MANTÍCORA', 'QUIMERA',
  'MEDUSA',   'MINOTAURO', 'HARPIA',   'GÁRGOLA',   'NAGA',
  'LICH',     'VAMPIRO',   'GHOUL',    'ESPECTRO',  'TARRASCA',
  'GIGANTE',  'TROLL',     'OGRO',     'GRIFO',     'HIPOGRIFO',
  'KRAKÉN',   'LAMIA',     'GNOLL',    'PERYTON',   'ROPER',
  'SOMBRA',   'MOMIA',     'ESQUELETO','ZOMBI',     'GORGONA',
  'SÁTIRO',   'COUATL',    'BEHIR',    'ABOLETO',   'COCATRIZ',
  'BULETTE',  'ETTERCAPO', 'ESFINGE',  'RAKSHASA',  'BEHOLDER',
];

const FACTION_PREFIXES: readonly string[] = [
  'ORDEN',    'PACTO',    'LEGIÓN',   'GUARDIA',  'GARRA',
  'FUERZA',   'ALIANZA',  'CULTO',    'COFRADÍA', 'VANGUARDIA',
  'CONSEJO',  'TORMENTA', 'SANGRE',   'SELLO',    'MARCA',
];

// ─── Deterministic PRNG (LCG) ─────────────────────────────

function hashString(str: string): number {
  // djb2 variant — fast and well-distributed for short strings
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0;
  }
  return h;
}

type PRNG = { next: () => number; pickIndex: (len: number) => number };

function makePRNG(seed: number): PRNG {
  // Linear Congruential Generator — deterministic, no external deps
  let s = seed >>> 0;
  return {
    next(): number {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 0x100000000;
    },
    pickIndex(len: number): number {
      return Math.floor(this.next() * len);
    },
  };
}

// ─── Fisher-Yates shuffle using PRNG ─────────────────────

function shuffle<T>(arr: readonly T[], rng: PRNG): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.pickIndex(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── DB-backed creature pool ──────────────────────────────
// Queries the local SQLite 'monsters' endpoint (synchronous).
// Returns null if the DB is empty or an error occurs.

function loadCreaturesFromDB(): string[] | null {
  try {
    const resources = getResourcesByEndpoint('monsters');
    if (resources.length === 0) return null;

    // Single-word monster names are the iconic ones (Wyvern, Aboleth, Banshee…).
    // Multi-word entries ("Adult Black Dragon") produce poor code names.
    const names = resources
      .filter(r => !r.name.includes(' '))
      .map(r => r.name.toUpperCase());

    // Need a minimum pool to guarantee 5 unique rivals
    return names.length >= 10 ? names : null;
  } catch {
    return null;
  }
}

// ─── Build rival name pool ────────────────────────────────
// Returns up to 10 unique faction codes for a given seedHash.

export function buildRivalPool(seedHash: string): string[] {
  const rng = makePRNG(hashString(seedHash + '_rivals'));

  // Prefer live DB data; fall back to static SRD pool
  const creatures = loadCreaturesFromDB() ?? FALLBACK_CREATURES;

  const shuffledCreatures = shuffle(creatures, rng);
  const shuffledPrefixes  = shuffle(FACTION_PREFIXES, rng);

  const names: string[] = [];
  for (let i = 0; i < 10 && i < shuffledCreatures.length; i++) {
    names.push(`${shuffledPrefixes[i % shuffledPrefixes.length]}_${shuffledCreatures[i]}`);
  }
  return names;
}

// ─── Main export ──────────────────────────────────────────
// Drop-in replacement for the inline generateRivals in VillageScreen.

export function generateRivals(
  seedHash: string,
  playerFloor: number,
  playerCycle: number,
): RivalEntry[] {
  const rng  = makePRNG(hashString(seedHash + '_state'));
  const pool = buildRivalPool(seedHash);

  return pool.slice(0, 5).map((name, i) => {
    const isNew = playerCycle <= 1;

    const floor = isNew
      ? 0
      : Math.max(0, playerFloor - 1 + Math.floor(rng.next() * 3) - (i % 2));

    const status: RivalEntry['status'] = isNew ? 'waiting' : 'active';

    const rep = isNew
      ? 0
      : Math.min(99, Math.max(5, 20 + playerCycle * 2 - i * 8 + Math.floor(rng.next() * 10)));

    return { name, floor, status, rep };
  });
}
