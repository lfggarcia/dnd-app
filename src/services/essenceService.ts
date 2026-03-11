/**
 * essenceService.ts
 * Sistema de Esencias — drops, slots, evolución y ascensión — Sprint 7 (doc 13).
 *
 * Base: Sistema Híbrido RPG.MD — DnD5e core + Esencias 15% + Ascensión 5%
 * Las esencias NO reemplazan habilidades de clase; son una capa adicional.
 */

import { makePRNG } from '../utils/prng';
import type { PRNG } from '../utils/prng';

// ─── Enums y Types ────────────────────────────────────────

export type EssenceRank = 1 | 2 | 3 | 4 | 5;
// 5=Común, 4=Raro, 3=Épico, 2=Mítico, 1=Legendario

export type EssenceCategory =
  | 'BESTIAL'
  | 'ELEMENTAL'
  | 'NATURAL'
  | 'DEMONIC'
  | 'DRACONIC'
  | 'SPIRITUAL'
  | 'MONSTROUS'
  | 'ARCANE'
  | 'LEGENDARY'
  | 'MYTHIC';

export type EssenceEffectType =
  | 'passive_stat'
  | 'passive_resistance'
  | 'active_ability'
  | 'combat_trigger'
  | 'exploration'
  | 'aura';

export type EssenceEffect = {
  type: EssenceEffectType;
  stat?: string;
  value: number;
  description: string;
  description_en: string;
  cooldownTurns?: number;
  condition?: string;
};

export type EssenceDefinition = {
  id: string;
  name: string;
  name_en: string;
  category: EssenceCategory;
  rank: EssenceRank;
  slotsRequired: number;
  monsterSource: string;
  evolutionLevels: EssenceEffect[];
  evolutionKillsRequired: number[];
};

export type EssenceDrop = {
  definitionId: string;
  rank: EssenceRank;
  evolutionLevel: 1 | 2 | 3;
  killsOnThisType: number;
};

// ─── Slots de esencia por nivel ───────────────────────────

/** Sistema Híbrido RPG.MD tabla 4 */
export const ESSENCE_SLOTS_BY_LEVEL: Record<number, number> = {
  1: 0, 2: 0, 3: 0, 4: 0,
  5: 1, 6: 1, 7: 1, 8: 1,
  9: 2, 10: 2, 11: 2, 12: 2,
  13: 3, 14: 3, 15: 3, 16: 3,
  17: 4, 18: 4, 19: 4, 20: 4,
};
export const ASCENDED_BONUS_SLOTS = 1;

export function getEssenceSlots(level: number, isAscended: boolean): number {
  const base = ESSENCE_SLOTS_BY_LEVEL[Math.min(level, 20)] ?? 0;
  return base + (isAscended ? ASCENDED_BONUS_SLOTS : 0);
}

// ─── Catálogo de esencias ─────────────────────────────────

export const ESSENCE_CATALOG: EssenceDefinition[] = [
  {
    id: 'wolf_essence',
    name: 'Esencia de Lobo', name_en: 'Wolf Essence',
    category: 'BESTIAL', rank: 5, slotsRequired: 1, monsterSource: 'wolf',
    evolutionKillsRequired: [5, 15, 30],
    evolutionLevels: [
      { type: 'exploration', value: 0, description: 'Ventaja en rastreo', description_en: 'Advantage on tracking' },
      { type: 'combat_trigger', value: 5, condition: 'pack_ally_adjacent', description: '+5 daño si hay aliado adyacente', description_en: '+5 damage with adjacent ally' },
      { type: 'active_ability', value: 0, cooldownTurns: 3, description: 'Aullar: aliados obtienen ventaja en su siguiente ataque', description_en: 'Howl: allies gain advantage on next attack' },
    ],
  },
  {
    id: 'bear_essence',
    name: 'Esencia de Oso', name_en: 'Bear Essence',
    category: 'BESTIAL', rank: 5, slotsRequired: 1, monsterSource: 'bear',
    evolutionKillsRequired: [5, 15, 30],
    evolutionLevels: [
      { type: 'passive_stat', stat: 'STR', value: 2, description: '+2 Fuerza en combate', description_en: '+2 Strength in combat' },
      { type: 'passive_stat', stat: 'maxHp', value: 15, description: '+15 HP máximo', description_en: '+15 max HP' },
      { type: 'combat_trigger', value: 0, condition: 'hp_below_30pct', description: 'Furia de Oso: inmune a miedo, +2 AC por 2 turnos', description_en: 'Bear Rage: immune to fear, +2 AC for 2 turns' },
    ],
  },
  {
    id: 'fire_minor_essence',
    name: 'Esencia de Fuego Menor', name_en: 'Minor Fire Essence',
    category: 'ELEMENTAL', rank: 5, slotsRequired: 1, monsterSource: 'fire_elemental_minor',
    evolutionKillsRequired: [8, 20, 40],
    evolutionLevels: [
      { type: 'passive_resistance', value: 0, description: 'Resistencia a fuego', description_en: 'Fire resistance' },
      { type: 'combat_trigger', value: 4, condition: 'on_hit', description: '+1d4 fuego en ataques melé', description_en: '+1d4 fire on melee attacks' },
      { type: 'active_ability', value: 0, cooldownTurns: 4, description: 'Explosión ígnea: 3d6 fuego en área', description_en: 'Ignis Burst: 3d6 fire in area' },
    ],
  },
  {
    id: 'red_dragon_essence',
    name: 'Esencia de Dragón Rojo', name_en: 'Red Dragon Essence',
    category: 'DRACONIC', rank: 3, slotsRequired: 2, monsterSource: 'young_red_dragon',
    evolutionKillsRequired: [3, 8, 20],
    evolutionLevels: [
      { type: 'active_ability', value: 0, cooldownTurns: 5, description: 'Aliento de Fuego: 4d6 fuego, DEX DC 14', description_en: 'Fire Breath: 4d6 fire, DEX save DC 14' },
      { type: 'passive_resistance', value: 0, description: 'Inmunidad a fuego + resistencia ácido', description_en: 'Fire immunity + acid resistance' },
      { type: 'aura', value: 3, description: 'Aura dracónica: desventaja a enemigos en 3m', description_en: 'Draconic aura: disadvantage to enemies within 3m' },
    ],
  },
  {
    id: 'spectral_essence',
    name: 'Esencia Espectral', name_en: 'Spectral Essence',
    category: 'SPIRITUAL', rank: 4, slotsRequired: 1, monsterSource: 'specter',
    evolutionKillsRequired: [6, 18, 35],
    evolutionLevels: [
      { type: 'active_ability', value: 0, cooldownTurns: 6, description: 'Paso Espectral: atravesar una pared (reacción)', description_en: 'Spectral Step: pass through a wall (reaction)' },
      { type: 'exploration', value: 0, description: 'Sigilo Espiritual: ventaja en sigilo', description_en: 'Spirit Stealth: stealth advantage' },
      { type: 'combat_trigger', value: 0, condition: 'critical_hit_received', description: 'Al recibir crítico: forma espectral 1 turno (+50% evasión)', description_en: 'On crit received: spectral form 1 turn (+50% evasion)' },
    ],
  },
  {
    id: 'phoenix_essence',
    name: 'Esencia Fénix', name_en: 'Phoenix Essence',
    category: 'LEGENDARY', rank: 1, slotsRequired: 4, monsterSource: 'phoenix',
    evolutionKillsRequired: [1, 3, 7],
    evolutionLevels: [
      { type: 'combat_trigger', value: 0, condition: 'hp_reaches_zero', description: 'Renacimiento: revive con 25% HP una vez por temporada', description_en: 'Rebirth: revive with 25% HP once per season' },
      { type: 'passive_stat', stat: 'fireDamageBonus', value: 25, description: '+25% daño de fuego', description_en: '+25% fire damage' },
      { type: 'aura', value: 6, description: 'Aura del Fénix: aliados en 6m regeneran 2 HP/turno', description_en: 'Phoenix Aura: allies within 6m regenerate 2 HP/turn' },
    ],
  },
  {
    id: 'time_essence',
    name: 'Esencia del Tiempo', name_en: 'Time Essence',
    category: 'MYTHIC', rank: 1, slotsRequired: 4, monsterSource: 'time_dragon',
    evolutionKillsRequired: [1, 2, 5],
    evolutionLevels: [
      { type: 'active_ability', value: 0, cooldownTurns: 0, description: 'Reacción Extra: una vez por combate', description_en: 'Extra Reaction: once per combat' },
      { type: 'combat_trigger', value: 0, condition: 'roll_natural_1', description: 'Bucle Temporal: relanzar automáticamente al sacar 1', description_en: 'Time Loop: auto-reroll on natural 1' },
      { type: 'active_ability', value: 0, cooldownTurns: 8, description: 'Retroceso Temporal: deshacer última acción enemiga', description_en: 'Time Reversal: undo last enemy action' },
    ],
  },
];

// ─── Probabilidades de drop ───────────────────────────────

export const DROP_CHANCE_BY_ENEMY_TYPE: Record<string, number> = {
  minor:      0.05,
  elite:      0.15,
  miniboss:   0.35,
  boss:       0.70,
  major_boss: 1.00,
};

export function rollEssenceRank(rng: PRNG): EssenceRank {
  const roll = Math.floor(rng.float() * 100) + 1;
  if (roll <= 50) return 5;
  if (roll <= 75) return 4;
  if (roll <= 90) return 3;
  if (roll <= 98) return 2;
  return 1;
}

function findClosestEssence(
  monsterKey: string,
  rank: EssenceRank,
  rng: PRNG,
): EssenceDefinition | null {
  // Fallback: esencia de la categoría más cercana al mismo rank
  const byRank = ESSENCE_CATALOG.filter(e => e.rank === rank);
  if (byRank.length === 0) return ESSENCE_CATALOG[0] ?? null;
  return byRank[Math.floor(rng.float() * byRank.length)];
}

/**
 * Determina si un enemigo dropea esencia y cuál.
 * Llamar desde combatEngine.ts tras la muerte de cada enemigo.
 */
export function resolveEssenceDrop(
  enemyType: string,
  enemyMonsterKey: string,
  roomId: string,
  seedHash: string,
  cycle: number,
): EssenceDrop | null {
  const rng = makePRNG(
    `${seedHash}_essence_drop_${roomId}_${enemyMonsterKey}_${cycle}`,
  );

  const dropChance = DROP_CHANCE_BY_ENEMY_TYPE[enemyType] ?? 0.05;
  if (rng.float() > dropChance) return null;

  const d20 = Math.floor(rng.float() * 20) + 1;
  const isMajor = d20 === 20;

  const rank: EssenceRank = isMajor
    ? rollEssenceRank(rng)
    : rng.float() > 0.5 ? 5 : 4;

  const candidates = ESSENCE_CATALOG.filter(
    e => e.monsterSource === enemyMonsterKey && e.rank === rank,
  );
  const definition =
    candidates.length > 0
      ? candidates[Math.floor(rng.float() * candidates.length)]
      : findClosestEssence(enemyMonsterKey, rank, rng);

  if (!definition) return null;

  return {
    definitionId: definition.id,
    rank,
    evolutionLevel: 1,
    killsOnThisType: 1,
  };
}

// ─── Obtener esencia del catálogo ─────────────────────────

export function getEssenceDefinition(id: string): EssenceDefinition | undefined {
  return ESSENCE_CATALOG.find(e => e.id === id);
}

/**
 * Retorna el efecto activo según el nivel de evolución actual.
 */
export function getActiveEffect(
  definition: EssenceDefinition,
  evolutionLevel: 1 | 2 | 3,
): EssenceEffect {
  return definition.evolutionLevels[evolutionLevel - 1];
}
