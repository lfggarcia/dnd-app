import { makePRNG } from '../../utils/prng';
import type { RoomType } from '../entities/Room';

export type LootDrop = {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'boss_loot';
  rarity: 'common' | 'uncommon' | 'rare' | 'unique';
  goldValue: number;
  data: Record<string, unknown>;
};

type LootEntry = {
  name: string;
  type: LootDrop['type'];
  rarity: LootDrop['rarity'];
  basePrice: number;
  chance: number;
};

const LOOT_TABLES: Partial<Record<RoomType, LootEntry[]>> = {
  NORMAL: [
    { name: 'GOLD_COINS',    type: 'consumable', rarity: 'common',   basePrice: 10,   chance: 0.6 },
    { name: 'HEALTH_POTION', type: 'consumable', rarity: 'common',   basePrice: 50,   chance: 0.3 },
    { name: 'IRON_DAGGER',   type: 'weapon',     rarity: 'common',   basePrice: 80,   chance: 0.1 },
  ],
  ELITE: [
    { name: 'HEALTH_POTION', type: 'consumable', rarity: 'common',   basePrice: 50,   chance: 0.5 },
    { name: 'SHADOW_ESSENCE', type: 'material',  rarity: 'uncommon', basePrice: 120,  chance: 0.3 },
    { name: 'STEEL_SWORD',   type: 'weapon',     rarity: 'uncommon', basePrice: 200,  chance: 0.2 },
  ],
  BOSS: [
    { name: 'SOUL_CRYSTAL',  type: 'material',   rarity: 'rare',     basePrice: 500,  chance: 0.7 },
    { name: 'ANCIENT_ARMOR', type: 'armor',       rarity: 'rare',     basePrice: 800,  chance: 0.3 },
  ],
  TREASURE: [
    { name: 'GOLD_CACHE',    type: 'consumable', rarity: 'uncommon', basePrice: 200,  chance: 0.6 },
    { name: 'RUNE_FRAGMENT', type: 'material',   rarity: 'rare',     basePrice: 300,  chance: 0.4 },
  ],
  SECRET: [
    { name: 'VOID_ESSENCE',  type: 'material',   rarity: 'rare',     basePrice: 400,  chance: 0.5 },
    { name: 'CURSED_BLADE',  type: 'weapon',     rarity: 'unique',   basePrice: 1200, chance: 0.2 },
  ],
};

/**
 * LootDomainService
 * Generates deterministic loot for dungeon rooms.
 * Pure functions — no infrastructure dependencies (no DB access).
 */
export class LootDomainService {
  /**
   * Generate loot for a room deterministically.
   * Same roomId + floor + cycle + seedHash always produces same drops.
   */
  generateRoomLoot(
    roomId: string | number,
    roomType: RoomType,
    floor: number,
    cycle: number,
    seedHash: string,
  ): LootDrop[] {
    const table = LOOT_TABLES[roomType];
    if (!table) return [];

    const rng = makePRNG(`${seedHash}_loot_${roomId}_${floor}_${cycle}`);
    const drops: LootDrop[] = [];

    for (const entry of table) {
      if (rng.bool(entry.chance)) {
        const floorMult = 1 + (floor - 1) * 0.05;
        const goldValue = Math.round(entry.basePrice * floorMult);
        drops.push({
          id: `${seedHash}_loot_${roomId}_${entry.name}`,
          name: entry.name,
          type: entry.type,
          rarity: entry.rarity,
          goldValue,
          data: {},
        });
      }
    }
    return drops;
  }

  /**
   * Calculate the sell price of an item (60% of gold value).
   */
  getSellPrice(goldValue: number): number {
    return Math.floor(goldValue * 0.6);
  }

  /**
   * Calculate the buy price of an item (base gold value, may include floor markup).
   */
  getBuyPrice(goldValue: number, floor: number): number {
    const markup = 1 + (floor - 1) * 0.02;
    return Math.round(goldValue * markup);
  }
}
