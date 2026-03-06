/**
 * Deterministic floor-map generator for TORRE.
 *
 * Generates a fixed-topology 8-node DAG (branching path from entry to boss)
 * where node **types** and **labels** vary deterministically from the run's
 * seedHash and the current floor number.
 *
 * Topology (fixed positions, seed-determined types):
 *
 *   1(ENTRANCE)──┬──▶ 2 ──┬──▶ 4 ──▶ 6 ──┐
 *               │         └──▶ 5 ──┬──▶ 7 ──▶ 8(BOSS)
 *               └──▶ 3 ──────▶ 5 ──┘
 *
 * PRNG: djb2 hash + LCG — identical algorithm to rivalGenerator.ts, ensuring
 * all deterministic systems in the game share the same PRNG family.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type NodeType = 'COMBAT' | 'EVENT' | 'SAFE_ZONE' | 'BOSS' | 'UNKNOWN';

export type MapNode = {
  id: number;
  type: NodeType;
  pos: { x: number; y: number };
  status: 'CLEAR' | 'CURRENT' | 'LOCKED' | 'AVAILABLE';
  label?: string;
  connections: number[];
};

// ─── Fixed topology ───────────────────────────────────────────────────────────
// Positions (% of container) and connectivity are constant across all seeds.
// Only types and labels change.

const TOPOLOGY: Pick<MapNode, 'id' | 'pos' | 'connections'>[] = [
  { id: 1, pos: { x: 12, y: 83  }, connections: [2, 3] },  // Entry (always SAFE_ZONE)
  { id: 2, pos: { x: 32, y: 58  }, connections: [4, 5] },  // Branch A high
  { id: 3, pos: { x: 32, y: 108 }, connections: [5]    },  // Branch B low
  { id: 4, pos: { x: 52, y: 38  }, connections: [6]    },  // Path A inner
  { id: 5, pos: { x: 52, y: 83  }, connections: [6, 7] },  // Convergence
  { id: 6, pos: { x: 72, y: 55  }, connections: [8]    },  // Pre-boss high
  { id: 7, pos: { x: 72, y: 108 }, connections: [8]    },  // Pre-boss low
  { id: 8, pos: { x: 88, y: 78  }, connections: []     },  // Boss (always BOSS)
];

// ─── Label pools by node type ─────────────────────────────────────────────────

const LABELS: Record<NodeType, readonly string[]> = {
  COMBAT: [
    'UNDEAD_PATROL',   'AMBUSH_POINT',    'DARK_GARRISON',   'TRAP_CORRIDOR',
    'SPECTRAL_LAIR',   'CURSED_SHRINE',   'BLOOD_ALTAR',     'FORGOTTEN_CRYPT',
    'PHANTOM_CROSSING','WARRIOR_TOMB',    'SHADOW_ENCLAVE',  'BONE_FORTRESS',
    'RITUAL_GROUND',   'DEMONIC_OUTPOST', 'GRAVEYARD',
  ],
  SAFE_ZONE: [
    'CAMP', 'REST_POINT', 'HIDDEN_ALCOVE', 'ANCIENT_FOUNTAIN',
    'COLLAPSED_HALL', 'SUPPLY_CACHE', 'MYSTIC_SEAL',
  ],
  EVENT: [
    'STRANGE_ALTAR',   'ARCANE_TRAP',    'LOST_MERCHANT',   'MYSTERIOUS_RUNES',
    'WHISPERING_TOMB', 'DARK_CONTRACT',  'ANCIENT_RIDDLE',  'CURSED_CHEST',
    'HAUNTED_MIRROR',
  ],
  BOSS: [
    'FLOOR_GUARDIAN', 'DARK_ENTITY',      'UNDEAD_OVERLORD', 'ABYSSAL_WARDEN',
    'HORROR_SOVEREIGN','BLOOD_TYRANT',    'ETERNAL_LICH',    'CHAOS_HERALD',
  ],
  UNKNOWN: [],
};

// ─── Type distribution by floor range ────────────────────────────────────────
// Covers the 6 "inner" nodes (ids 2–7). Array length must always be 6.

function buildTypePool(floor: number): NodeType[] {
  if (floor <= 25) {
    return ['COMBAT', 'COMBAT', 'COMBAT', 'EVENT', 'SAFE_ZONE', 'UNKNOWN'];
  }
  if (floor <= 60) {
    return ['COMBAT', 'COMBAT', 'COMBAT', 'EVENT', 'EVENT', 'UNKNOWN'];
  }
  return ['COMBAT', 'COMBAT', 'EVENT', 'EVENT', 'UNKNOWN', 'UNKNOWN'];
}

// ─── PRNG (djb2 hash + LCG — same family as rivalGenerator.ts) ───────────────

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function makePRNG(seed: number) {
  let s = seed >>> 0;
  return {
    next(): number {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 0x100000000;
    },
    pick(len: number): number {
      return Math.floor(this.next() * len);
    },
  };
}

function shuffle<T>(arr: T[], rng: ReturnType<typeof makePRNG>): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.pick(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a deterministic floor layout for the given seed + floor number.
 *
 * - Node types and labels are fully determined by the run seed and the floor.
 * - The entry node (id 1) is always SAFE_ZONE / CURRENT / 'ENTRANCE'.
 * - The boss node (id 8) is always BOSS / LOCKED / random boss label.
 * - Nodes directly connected to the entry (ids 2 & 3) start as AVAILABLE.
 * - All other nodes start as LOCKED.
 */
export function generateFloorNodes(seedHash: string, floor: number): MapNode[] {
  const rng = makePRNG(hashString(`${seedHash}_map_${floor}`));

  // Shuffle type pool for the 6 variable inner nodes
  const types = shuffle(buildTypePool(floor), rng);

  // Boss label picked from seed
  const bossPool = LABELS.BOSS;
  const bossLabel = bossPool[rng.pick(bossPool.length)];

  // Entry node connections (ids directly reachable from entry)
  const entryConnections = new Set(TOPOLOGY[0].connections);

  return TOPOLOGY.map((topo, idx): MapNode => {
    // Entry node — always SAFE_ZONE, always CURRENT, always labelled ENTRANCE
    if (idx === 0) {
      return { ...topo, type: 'SAFE_ZONE', status: 'CURRENT', label: 'ENTRANCE' };
    }

    // Boss node — always BOSS, always LOCKED
    if (idx === TOPOLOGY.length - 1) {
      return { ...topo, type: 'BOSS', status: 'LOCKED', label: bossLabel };
    }

    // Variable nodes: assign type from shuffled pool
    const type = types[idx - 1];
    const pool = LABELS[type];
    const label = pool.length > 0 ? pool[rng.pick(pool.length)] : undefined;
    const status: MapNode['status'] = entryConnections.has(topo.id) ? 'AVAILABLE' : 'LOCKED';

    return { ...topo, type, status, label };
  });
}
