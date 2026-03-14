/**
 * lootService.ts
 * Genera loot determinístico por seed + roomId + floor — Sprint 6 (doc 02).
 *
 * Esencias de monstruos son gestionadas por essenceService.ts (doc 13).
 * Este servicio genera armas, armaduras, consumables, materials, boss_loot.
 */

import { makePRNG } from '../utils/prng';
import { calculateItemPrice } from './economyService';
import { isBossLootClaimed } from '../database/itemRepository';

// ─── Tablas de loot ───────────────────────────────────────

type LootEntry = {
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'boss_loot';
  rarity: 'common' | 'uncommon' | 'rare' | 'unique';
  basePrice: number;
  chance: number;
};

const LOOT_TABLES: Record<string, LootEntry[]> = {
  NORMAL: [
    { name: 'GOLD_COINS',    type: 'consumable', rarity: 'common',   basePrice: 10,  chance: 0.6 },
    { name: 'HEALTH_POTION', type: 'consumable', rarity: 'common',   basePrice: 50,  chance: 0.3 },
    { name: 'IRON_DAGGER',   type: 'weapon',     rarity: 'common',   basePrice: 80,  chance: 0.1 },
  ],
  ELITE: [
    { name: 'HEALTH_POTION', type: 'consumable', rarity: 'common',   basePrice: 50,  chance: 0.5 },
    { name: 'SHADOW_ESSENCE', type: 'material',  rarity: 'uncommon', basePrice: 120, chance: 0.3 },
    { name: 'STEEL_SWORD',   type: 'weapon',     rarity: 'uncommon', basePrice: 200, chance: 0.2 },
  ],
  BOSS: [
    { name: 'SOUL_CRYSTAL',  type: 'material',   rarity: 'rare',     basePrice: 500, chance: 0.7 },
    { name: 'ANCIENT_ARMOR', type: 'armor',       rarity: 'rare',     basePrice: 800, chance: 0.3 },
  ],
  TREASURE: [
    { name: 'GOLD_CACHE',    type: 'consumable', rarity: 'uncommon', basePrice: 200, chance: 0.6 },
    { name: 'RUNE_FRAGMENT', type: 'material',   rarity: 'rare',     basePrice: 300, chance: 0.4 },
  ],
  SECRET: [
    { name: 'VOID_ESSENCE',  type: 'material',   rarity: 'rare',     basePrice: 400, chance: 0.5 },
    { name: 'CURSED_BLADE',  type: 'weapon',     rarity: 'unique',   basePrice: 1200, chance: 0.2 },
  ],
};

// ─── Tipos ────────────────────────────────────────────────

export type LootDrop = {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'boss_loot';
  rarity: 'common' | 'uncommon' | 'rare' | 'unique';
  goldValue: number;
  data: Record<string, unknown>;
};

// ─── Generación de loot ───────────────────────────────────

/**
 * Genera el loot de una sala de forma determinística.
 * El mismo roomId + floor + cycle siempre produce el mismo loot.
 */
export function generateRoomLoot(
  roomId: string,
  roomType: keyof typeof LOOT_TABLES,
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
      drops.push({
        id: `${seedHash}::${roomId}::${entry.name}::${floor}`,
        name: entry.name,
        type: entry.type,
        rarity: entry.rarity,
        goldValue: calculateItemPrice(50, entry.rarity, floor),
        data: {},
      });
    }
  }

  return drops;
}

/**
 * Genera el loot único de un boss. Solo se genera UNA VEZ por seed.
 * SYSTEMS.MD: "Se obtiene solo la primera vez que es derrotado."
 */
export function generateBossUniqueLoot(
  seedHash: string,
  bossRoomId: string,
  floor: number,
): LootDrop | null {
  if (isBossLootClaimed(seedHash, bossRoomId)) return null;

  const rng = makePRNG(`${seedHash}_boss_unique_${bossRoomId}`);
  const options = [
    { suffix: 'CROWN',    value: 2000 + floor * 50 },
    { suffix: 'ORB',      value: 1800 + floor * 40 },
    { suffix: 'GRIMOIRE', value: 2200 + floor * 60 },
    { suffix: 'TOTEM',    value: 1500 + floor * 45 },
  ];
  const pick = options[Math.floor(rng.float() * options.length)];

  return {
    id: `${seedHash}_boss_${bossRoomId}_${pick.suffix}`,
    name: `BOSS_${bossRoomId}_${pick.suffix}`,
    type: 'boss_loot',
    rarity: 'unique',
    goldValue: pick.value,
    data: { bossRoomId, floor },
  };
}
