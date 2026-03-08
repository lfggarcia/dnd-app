/**
 * Dungeon Graph Generator
 *
 * Generates deterministic floor graphs with 12–20 rooms per floor.
 * Layout is stable (same seed + floor always gives same layout).
 * Mutation content (enemy types/quantity) can vary between cycles.
 *
 * Based on: "Dungeon Exploration System – Persistencia Parcial + Mutaciones"
 * and "Dungeon Graph Generator" design docs.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type RoomType =
  | 'START'
  | 'NORMAL'
  | 'ELITE'
  | 'EVENT'
  | 'TREASURE'
  | 'BOSS'
  | 'SECRET';

export interface DungeonRoom {
  /** Unique ID within the floor */
  id: number;
  type: RoomType;
  /** IDs of rooms this room connects to (directed: can go to these) */
  connections: number[];
  /** Grid position for visual rendering (0–1 normalized) */
  pos: { x: number; y: number };
  /** Generated label (e.g. "BLOOD_ALTAR") */
  label: string;
  /** Whether this room has been visited by the party */
  visited: boolean;
  /** Whether this room is visible on the map (revealed by adjacency) */
  revealed: boolean;
  /** Whether this room is mutated in the current cycle */
  mutated: boolean;
}

export interface DungeonFloor {
  /** Seed hash that generated this floor */
  seedHash: string;
  floorIndex: number;
  rooms: DungeonRoom[];
  /** IDs of secret rooms */
  secretRoomIds: number[];
  /** ID of the start room */
  startRoomId: number;
  /** ID of the boss room */
  bossRoomId: number;
}

export interface FloorExplorationState {
  floorIndex: number;
  visitedRoomIds: number[];
  revealedRoomIds: number[];
  currentRoomId: number;
}

// ─── PRNG (djb2 + LCG — same family as mapGenerator.ts) ─────────────────────

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
    int(min: number, max: number): number {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick<T>(arr: T[]): T {
      return arr[Math.floor(this.next() * arr.length)];
    },
    shuffle<T>(arr: T[]): T[] {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}

// ─── Labels ──────────────────────────────────────────────────────────────────

const LABELS: Record<RoomType, readonly string[]> = {
  START:    ['ENTRANCE', 'DESCENT_POINT', 'DUNGEON_GATE'],
  NORMAL:   ['CORRIDOR', 'GUARD_POST', 'COLLAPSED_HALL', 'CRYPT_PASSAGE', 'DARK_CHAMBER', 'BONE_GALLERY', 'SHADOW_TUNNEL', 'ANCIENT_HALL', 'TORCH_ROOM'],
  ELITE:    ['UNDEAD_PATROL', 'AMBUSH_POINT', 'DARK_GARRISON', 'SPECTRAL_LAIR', 'CURSED_SHRINE', 'WARRIOR_TOMB', 'SHADOW_ENCLAVE', 'RITUAL_GROUND'],
  EVENT:    ['STRANGE_ALTAR', 'ARCANE_TRAP', 'LOST_MERCHANT', 'MYSTERIOUS_RUNES', 'WHISPERING_TOMB', 'DARK_CONTRACT', 'ANCIENT_RIDDLE', 'CURSED_CHEST'],
  TREASURE: ['HIDDEN_VAULT', 'SUPPLY_CACHE', 'FORGOTTEN_HOARD', 'ANCIENT_CHEST', 'RELIC_ROOM'],
  BOSS:     ['FLOOR_GUARDIAN', 'DARK_ENTITY', 'UNDEAD_OVERLORD', 'ABYSSAL_WARDEN', 'ETERNAL_LICH', 'CHAOS_HERALD'],
  SECRET:   ['HIDDEN_ALCOVE', 'SECRET_PASSAGE', 'FORGOTTEN_SANCTUM', 'CURSED_VAULT'],
};

// ─── Type distribution ───────────────────────────────────────────────────────

function buildRoomTypePool(roomCount: number): RoomType[] {
  // Guaranteed rooms: START x1, BOSS x1, ELITE x1
  // Rest distributed as: ~50% NORMAL, ~20% EVENT, ~15% TREASURE, ~15% ELITE
  const pool: RoomType[] = [];
  const variable = roomCount - 3; // minus START, BOSS, 1 fixed ELITE
  for (let i = 0; i < variable; i++) {
    const roll = i / variable;
    if (roll < 0.50) pool.push('NORMAL');
    else if (roll < 0.70) pool.push('EVENT');
    else if (roll < 0.85) pool.push('TREASURE');
    else pool.push('ELITE');
  }
  return pool;
}

// ─── Graph builder ───────────────────────────────────────────────────────────

/**
 * Build rooms as a layered DAG with branching paths.
 * Ensures all rooms are reachable from START and BOSS is the final room.
 */
function buildRoomGraph(
  roomCount: number,
  secretCount: number,
  rng: ReturnType<typeof makePRNG>,
): { rooms: Omit<DungeonRoom, 'label' | 'visited' | 'revealed' | 'mutated'>[]; secretIds: number[]; bossId: number; startId: number } {
  const rooms: Omit<DungeonRoom, 'label' | 'visited' | 'revealed' | 'mutated'>[] = [];

  // Assign IDs
  const normalIds = Array.from({ length: roomCount }, (_, i) => i + 1);
  const secretIds = normalIds.slice(roomCount - secretCount);
  const mainIds = normalIds.slice(0, roomCount - secretCount);
  const startId = mainIds[0];
  const bossId = mainIds[mainIds.length - 1];

  // Build layered layout: divide into ~4 columns
  const layerCount = 4;
  const layers: number[][] = Array.from({ length: layerCount }, () => []);
  const mainMiddle = mainIds.slice(1, -1); // exclude start and boss
  const shuffled = rng.shuffle(mainMiddle);

  // Distribute middle rooms across layers
  shuffled.forEach((id, idx) => {
    const layer = 1 + (idx % (layerCount - 2));
    layers[layer].push(id);
  });
  layers[0] = [startId];
  layers[layerCount - 1] = [bossId];

  // Assign positions — main rooms constrained to y ∈ [0.05, 0.82] to reserve
  // the bottom band for secret rooms, preventing overlap between the two.
  const posMap = new Map<number, { x: number; y: number }>();
  layers.forEach((layer, li) => {
    const xPct = (li + 0.5) / layerCount;
    layer.forEach((id, ri) => {
      const yPct = 0.05 + ((ri + 0.5) / Math.max(layer.length, 1)) * 0.77;
      posMap.set(id, { x: Math.round(xPct * 100) / 100, y: Math.round(yPct * 100) / 100 });
    });
  });

  // Place secret rooms below main layout (y ≥ 0.93) — guaranteed clear zone.
  secretIds.forEach((id, i) => {
    posMap.set(id, { x: 0.25 + i * 0.25, y: 0.93 + i * 0.02 });
  });

  // Build connections: each room in layer N connects to 1-2 rooms in layer N+1
  const connectionMap = new Map<number, number[]>();
  normalIds.forEach(id => connectionMap.set(id, []));

  for (let li = 0; li < layerCount - 1; li++) {
    const from = layers[li];
    const to = layers[li + 1];
    if (to.length === 0) continue;

    // Ensure every node in `to` has at least one incoming connection
    const toShuffled = rng.shuffle(to);
    from.forEach((fromId, i) => {
      const primary = toShuffled[i % toShuffled.length];
      const conns = connectionMap.get(fromId)!;
      if (!conns.includes(primary)) conns.push(primary);
      // Randomly add a second connection
      if (rng.next() < 0.4 && toShuffled.length > 1) {
        const secondary = toShuffled[(i + 1) % toShuffled.length];
        if (secondary !== primary && !conns.includes(secondary)) {
          conns.push(secondary);
        }
      }
    });
  }

  // Secret rooms connect from a random ELITE or EVENT room in middle layers
  secretIds.forEach(secretId => {
    const middleRooms = [...layers[1], ...layers[2]];
    if (middleRooms.length > 0) {
      const host = rng.pick(middleRooms);
      connectionMap.get(host)?.push(secretId);
    }
    connectionMap.set(secretId, []);
  });

  // Assemble room objects
  normalIds.forEach(id => {
    const pos = posMap.get(id) ?? { x: 0.5, y: 0.5 };
    const connections = connectionMap.get(id) ?? [];
    const status = id === startId
      ? 'CURRENT' as const
      : connections.some(c => c === id) || layers[0].includes(id)
        ? 'AVAILABLE' as const
        : 'LOCKED' as const;
    rooms.push({ id, connections, pos, type: 'NORMAL' /* overridden later */ });
  });

  return { rooms, secretIds, bossId, startId };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a deterministic dungeon floor.
 * - Layout (room positions + connections) is stable per seed+floor.
 * - Types and labels are deterministically shuffled from the seed.
 * - Called once per floor entry; subsequent entries re-use saved layout.
 */
export function generateDungeonFloor(seedHash: string, floorIndex: number): DungeonFloor {
  const rng = makePRNG(hashString(`${seedHash}_dungeon_${floorIndex}`));

  const roomCount = rng.int(12, 20);
  const secretCount = rng.int(0, 3);

  const { rooms, secretIds, bossId, startId } = buildRoomGraph(roomCount, secretCount, rng);

  // Assign types
  const typePool = rng.shuffle(buildRoomTypePool(roomCount - secretCount));
  let typeIdx = 0;
  const typedRooms: DungeonRoom[] = rooms.map(r => {
    let type: RoomType;
    if (r.id === startId) {
      type = 'START';
    } else if (r.id === bossId) {
      type = 'BOSS';
    } else if (secretIds.includes(r.id)) {
      type = 'SECRET';
    } else {
      type = typePool[typeIdx++] ?? 'NORMAL';
    }
    const labelPool = LABELS[type];
    const label = rng.pick([...labelPool]);
    return { ...r, type, label, visited: false, revealed: r.id === startId, mutated: false };
  });

  return {
    seedHash,
    floorIndex,
    rooms: typedRooms,
    secretRoomIds: secretIds,
    startRoomId: startId,
    bossRoomId: bossId,
  };
}

/**
 * Apply exploration state to a floor (restore discovered/visited rooms).
 */
export function applyExplorationState(
  floor: DungeonFloor,
  state: FloorExplorationState,
): DungeonFloor {
  const updatedRooms = floor.rooms.map(r => ({
    ...r,
    visited: state.visitedRoomIds.includes(r.id),
    revealed: state.revealedRoomIds.includes(r.id),
  }));
  return { ...floor, rooms: updatedRooms };
}

/**
 * Reveal rooms adjacent to a visited room.
 */
export function revealAdjacentRooms(floor: DungeonFloor, visitedRoomId: number): DungeonFloor {
  const room = floor.rooms.find(r => r.id === visitedRoomId);
  if (!room) return floor;

  const toReveal = new Set(room.connections);
  const updatedRooms = floor.rooms.map(r => ({
    ...r,
    revealed: r.revealed || toReveal.has(r.id),
    visited: r.id === visitedRoomId ? true : r.visited,
  }));
  return { ...floor, rooms: updatedRooms };
}

/**
 * Apply cycle mutations to a floor.
 * Mutations change enemy content but NOT layout.
 * Returns a set of room IDs that are mutated this cycle.
 */
export function applyFloorMutations(
  floor: DungeonFloor,
  cycle: number,
): DungeonFloor {
  if (cycle <= 1) return floor; // No mutations on first cycle

  const rng = makePRNG(hashString(`${floor.seedHash}_mutations_${floor.floorIndex}_c${cycle}`));
  const mutationChance = Math.min(0.1 * (cycle - 1), 0.6); // Up to 60% chance

  const updatedRooms = floor.rooms.map(r => {
    if (r.type === 'START' || r.type === 'BOSS' || r.type === 'SECRET') {
      return r;
    }
    const mutated = rng.next() < mutationChance;
    return { ...r, mutated };
  });

  return { ...floor, rooms: updatedRooms };
}

/** Serialize floor exploration state for persistence */
export function serializeExplorationState(
  floor: DungeonFloor,
  currentRoomId: number,
): FloorExplorationState {
  return {
    floorIndex: floor.floorIndex,
    visitedRoomIds: floor.rooms.filter(r => r.visited).map(r => r.id),
    revealedRoomIds: floor.rooms.filter(r => r.revealed).map(r => r.id),
    currentRoomId,
  };
}

// ─── Stealth & Perception ─────────────────────────────────────────────────────

export interface PerceptionResult {
  success: boolean;
  roll: number;
  dc: number;
  narratorHint?: string;
}

/**
 * Perform a group perception roll against a mutated room's enemy stealth.
 * Returns whether the party detected the mutation and a narrator hint.
 */
export function rollGroupPerception(
  partyWis: number[],
  enemyStealth: number,
): PerceptionResult {
  // D&D 5e: take best perception in the party for a group check
  const maxWis = Math.max(...partyWis);
  const wisBonus = Math.floor((maxWis - 10) / 2);
  const d20 = Math.ceil(Math.random() * 20);
  const roll = d20 + wisBonus;
  const success = roll >= enemyStealth;

  const hints = success
    ? [
        'Entras al piso… pero algo se siente diferente. El aire es más denso.',
        'Tus sentidos se agudizan. Algo ha cambiado aquí desde la última vez.',
        'El tiefling de tu party percibe movimiento inusual al fondo del corredor.',
      ]
    : undefined;

  return {
    success,
    roll,
    dc: enemyStealth,
    narratorHint: success && hints ? hints[Math.floor(Math.random() * hints.length)] : undefined,
  };
}
