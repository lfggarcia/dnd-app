/**
 * economyService.ts
 * Fórmulas económicas puras para TORRE — Sprint 6 (doc 02).
 *
 * Todas las funciones son puras (sin efectos secundarios).
 * Las transacciones de gold se ejecutan via gameStore.updateProgress.
 */

// ─── Constantes ───────────────────────────────────────────

export const REVIVE_BASE_COST = 100;  // oro base para revivir nivel 1
export const REST_INN_COST    = 50;   // posada (descanso largo)
export const REST_SHORT_COST  = 0;    // descanso corto en dungeon (gratis)

// ─── Types ────────────────────────────────────────────────

export type CharacterEconomyState = {
  level: number;
  deathCount: number;
  alive: boolean;
};

export type ReviveCostResult = {
  cost: number;
  canAfford: boolean;
  breakdown: string;
};

// ─── Fórmulas ─────────────────────────────────────────────

/**
 * SYSTEMS.MD: ReviveCost = BaseCost × CharacterLevel × (1 + DeathCount × 0.15)
 */
export function calculateReviveCost(
  char: CharacterEconomyState,
  currentGold: number,
): ReviveCostResult {
  const base = REVIVE_BASE_COST;
  const levelMult = Math.max(1, char.level);
  const deathMult = 1 + (char.deathCount ?? 0) * 0.15;
  const cost = Math.round(base * levelMult * deathMult);
  const breakdown = `${base} × nv${char.level} × (1 + ${char.deathCount} m. × 0.15) = ${cost}G`;
  return { cost, canAfford: currentGold >= cost, breakdown };
}

/**
 * Calcula el precio de un item según rareza y piso obtenido.
 */
export function calculateItemPrice(
  basePrice: number,
  rarity: 'common' | 'uncommon' | 'rare' | 'unique',
  floorObtained: number,
): number {
  const rarityMultiplier: Record<string, number> = {
    common: 1,
    uncommon: 2.5,
    rare: 6,
    unique: 20,
  };
  const floorMultiplier = 1 + floorObtained * 0.03;
  return Math.round(basePrice * (rarityMultiplier[rarity] ?? 1) * floorMultiplier);
}

/**
 * Valor de venta de un item (60% del precio de compra).
 */
export function calculateSellValue(item: { goldValue: number }): number {
  return Math.floor(item.goldValue * 0.6);
}

/**
 * Costo de la posada para un descanso largo. Escala levemente con el piso.
 */
export function calculateInnCost(floor: number): number {
  return REST_INN_COST * Math.max(1, Math.floor(floor / 10));
}

/**
 * Calcula el oro total del loot de una sala según piso y tipo.
 * SYSTEMS.MD: "Gold = floor × 10 × rarityMult"
 */
export function calculateRoomGold(
  floor: number,
  roomType: 'NORMAL' | 'ELITE' | 'BOSS' | 'TREASURE',
): number {
  const multipliers = { NORMAL: 1, ELITE: 2, BOSS: 5, TREASURE: 3 };
  return Math.round(floor * 10 * (multipliers[roomType] ?? 1));
}
