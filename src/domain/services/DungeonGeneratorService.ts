import { makePRNG } from '../../utils/prng';
import { Room, RoomType, RoomProps } from '../entities/Room';
import type { DungeonLayout } from '../entities/Dungeon';

const ROOM_TYPE_WEIGHTS: Record<RoomType, number> = {
  START:     0,
  NORMAL:    50,
  ELITE:     20,
  EVENT:     10,
  TREASURE:  8,
  SAFE_ZONE: 5,
  SECRET:    4,
  BOSS:      0, // placed explicitly
};

const ROOM_LABELS: Partial<Record<RoomType, string[]>> = {
  NORMAL:    ['CRYPT', 'BARRACKS', 'TORTURE_CHAMBER', 'GUARD_POST', 'COLLAPSED_HALL'],
  ELITE:     ['RITUAL_CHAMBER', 'WARLORD_LAIR', 'BONE_THRONE', 'SHADOW_FORGE'],
  EVENT:     ['CURSED_ALTAR', 'STRANGE_MIST', 'ANCIENT_INSCRIPTION'],
  TREASURE:  ['VAULT', 'HIDDEN_CACHE', 'FORGOTTEN_CHEST'],
  BOSS:      ['THRONE_OF_SHADOWS', 'NECROMANCER_SANCTUM', 'VOID_GATE'],
  SECRET:    ['BLOOD_ALTAR', 'FORBIDDEN_LIBRARY'],
  SAFE_ZONE: ['PILGRIM_CAMP', 'ABANDONED_SHRINE'],
  START:     ['DUNGEON_ENTRANCE'],
};

/**
 * DungeonGeneratorService
 * Generates deterministic dungeon layouts.
 * Pure functions — no infrastructure dependencies.
 */
export class DungeonGeneratorService {
  /**
   * Generate a complete floor layout for the given floor index and seedHash.
   * Deterministic: same seedHash + floorIndex always produces same layout.
   */
  generateFloor(seedHash: string, floorIndex: number): DungeonLayout {
    const rng = makePRNG(`${seedHash}_floor_${floorIndex}`);
    const roomCount = rng.next(12, 20);
    const rooms: RoomProps[] = [];
    const secretRoomIds: number[] = [];

    // Place start room
    rooms.push({
      id: 0,
      type: 'START',
      connections: [],
      pos: { x: 0.5, y: 0.05 },
      label: 'DUNGEON_ENTRANCE',
      visited: false,
      revealed: true,
      mutated: false,
    });

    // Build a room type pool
    const typePool: RoomType[] = [];
    for (const [type, weight] of Object.entries(ROOM_TYPE_WEIGHTS)) {
      for (let w = 0; w < weight; w++) typePool.push(type as RoomType);
    }

    // Place regular rooms on a grid (3 columns)
    for (let i = 1; i < roomCount - 1; i++) {
      const type = typePool[rng.next(0, typePool.length - 1)];
      const labels = ROOM_LABELS[type] ?? ['UNKNOWN_CHAMBER'];
      const label = labels[rng.next(0, labels.length - 1)];
      const col = i % 3;
      const row = Math.floor(i / 3);
      rooms.push({
        id: i,
        type,
        connections: [],
        pos: {
          x: 0.15 + col * 0.35,
          y: 0.1 + row * 0.15,
        },
        label,
        visited: false,
        revealed: false,
        mutated: false,
      });
      if (type === 'SECRET') secretRoomIds.push(i);
    }

    // Place boss room last
    const bossLabels = ROOM_LABELS.BOSS ?? ['BOSS_ROOM'];
    rooms.push({
      id: roomCount - 1,
      type: 'BOSS',
      connections: [],
      pos: { x: 0.5, y: 0.95 },
      label: bossLabels[rng.next(0, bossLabels.length - 1)],
      visited: false,
      revealed: false,
      mutated: false,
    });

    // Connect rooms linearly with some branching
    for (let i = 0; i < rooms.length - 1; i++) {
      rooms[i].connections.push(rooms[i + 1].id);
      // Occasional branch
      if (i > 0 && i < rooms.length - 2 && rng.bool(0.3)) {
        const target = rng.next(i + 1, Math.min(i + 3, rooms.length - 1));
        if (!rooms[i].connections.includes(target)) {
          rooms[i].connections.push(target);
        }
      }
    }

    return {
      seedHash,
      floorIndex,
      rooms: rooms.map(Room.fromProps),
      secretRoomIds,
      startRoomId: 0,
      bossRoomId: roomCount - 1,
    };
  }
}
