# 13 · SISTEMA DE ESENCIAS Y ASCENSIÓN
> **Estado actual:** 0% — sistema no implementado
> **Sprint objetivo:** 7
> **Archivos a crear/modificar:** nuevo `src/services/essenceService.ts`, nuevo `src/database/essenceRepository.ts`, `combatEngine.ts`, `progressionService.ts`, `CampScreen.tsx`, `CharacterDetailScreen.tsx`, `migrations.ts` (v13), `navigation/types.ts`
> **Documento base:** `# Sistema Híbrido RPG.MD`

---

## Concepto

Las esencias son **fragmentos de poder de monstruos derrotados** que otorgan progresión horizontal al personaje. El núcleo del combate sigue siendo DnD 5e (d20, AC, HP, acciones) pero las esencias permiten que dos guerreros de nivel 5 sean completamente distintos dependiendo de qué monstruos mataron.

La fórmula de poder del personaje con el sistema integrado queda:

```
Poder Total = Clase(DnD) + Subclase + Atributos + Equipo + Esencias + Ascensión
Peso:              40%      15%        10%          10%      15%        10%
```

Las esencias **no reemplazan habilidades de clase** — son una capa adicional sobre DnD 5e.

---

## Estado Actual vs Objetivo

| Aspecto | Hoy | Objetivo |
|---------|-----|----------|
| Drop de esencias | No existe | Probabilidad por tipo de enemigo tras combate |
| Slots de esencia | No existe | Se desbloquean por nivel (5→1 slot, 9→2, etc.) |
| Evolución de esencia | No existe | 3 niveles de evolución por derrotar más del mismo tipo |
| Gestión de esencias | No existe | Tab dedicado en `CampScreen` |
| Ascensión (post nv 20) | No existe | Camino especial con requisitos y pantalla propia |
| Poder IA con esencias | No existe | `calculatePartyPower` incluye esencias en el score |

---

## Paso 1 — Tipos y constantes del sistema

Crear `src/services/essenceService.ts`:

```typescript
/**
 * essenceService.ts
 * Sistema de Esencias: drops, slots, evolución y ascensión.
 * Base: Sistema Híbrido RPG.MD — DnD5e core + Esencias 15% + Ascensión 5%
 */

// ─── Enums y Types ─────────────────────────────────────────

export type EssenceRank = 1 | 2 | 3 | 4 | 5;
// 5 = Común, 4 = Raro, 3 = Épico, 2 = Mítico, 1 = Legendario

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
  | 'passive_stat'        // bonus permanente a stat
  | 'passive_resistance'  // resistencia a tipo de daño
  | 'active_ability'      // habilidad activa usable en combate
  | 'combat_trigger'      // se activa bajo condición de combate
  | 'exploration'         // efecto fuera de combate
  | 'aura';               // afecta a aliados en rango

export type EssenceEffect = {
  type: EssenceEffectType;
  stat?: string;                // para passive_stat
  value: number;
  description: string;
  description_en: string;
  cooldownTurns?: number;       // para active_ability
  condition?: string;           // para combat_trigger: ej. "enemy_hp_below_50"
};

export type EssenceDefinition = {
  id: string;
  name: string;
  name_en: string;
  category: EssenceCategory;
  rank: EssenceRank;
  slotsRequired: number;
  monsterSource: string;        // tipo de monstruo que la dropea
  evolutionLevels: EssenceEffect[];  // [nivel1, nivel2, nivel3]
  evolutionKillsRequired: number[];  // kills para evolucionar: [5, 15, 30]
};

// ─── Tabla de slots por nivel de personaje ─────────────────

/**
 * Sistema Híbrido RPG.MD tabla 4 — Slots de Esencia
 */
export const ESSENCE_SLOTS_BY_LEVEL: Record<number, number> = {
  1: 0, 2: 0, 3: 0, 4: 0,
  5: 1, 6: 1, 7: 1, 8: 1,
  9: 2, 10: 2, 11: 2, 12: 2,
  13: 3, 14: 3, 15: 3, 16: 3,
  17: 4, 18: 4, 19: 4, 20: 4,
};

export const ASCENDED_BONUS_SLOTS = 1; // post-ascensión: +1 slot

/**
 * Retorna los slots disponibles para un personaje.
 */
export function getEssenceSlots(level: number, isAscended: boolean): number {
  const base = ESSENCE_SLOTS_BY_LEVEL[Math.min(level, 20)] ?? 0;
  return base + (isAscended ? ASCENDED_BONUS_SLOTS : 0);
}

// ─── Slots requeridos por rank ─────────────────────────────

export const SLOTS_REQUIRED_BY_RANK: Record<EssenceRank, number> = {
  5: 1,  // Común
  4: 1,  // Raro
  3: 2,  // Épico
  2: 3,  // Mítico
  1: 4,  // Legendario
};
```

---

## Paso 2 — Catálogo de esencias (selección representativa)

```typescript
// src/services/essenceService.ts — continuación

export const ESSENCE_CATALOG: EssenceDefinition[] = [

  // ── BESTIALES ────────────────────────────────────────────
  {
    id: 'wolf_essence',
    name: 'Esencia de Lobo',
    name_en: 'Wolf Essence',
    category: 'BESTIAL',
    rank: 5,
    slotsRequired: 1,
    monsterSource: 'wolf',
    evolutionKillsRequired: [5, 15, 30],
    evolutionLevels: [
      { type: 'exploration', value: 0, description: 'Ventaja en rastreo', description_en: 'Advantage on tracking' },
      { type: 'combat_trigger', value: 5, condition: 'pack_ally_adjacent', description: '+5 daño si hay aliado adyacente', description_en: '+5 damage with adjacent ally' },
      { type: 'active_ability', value: 0, cooldownTurns: 3, description: 'Aullar: todos los aliados obtienen ventaja en su siguiente ataque', description_en: 'Howl: all allies gain advantage on next attack' },
    ],
  },
  {
    id: 'bear_essence',
    name: 'Esencia de Oso',
    name_en: 'Bear Essence',
    category: 'BESTIAL',
    rank: 5,
    slotsRequired: 1,
    monsterSource: 'bear',
    evolutionKillsRequired: [5, 15, 30],
    evolutionLevels: [
      { type: 'passive_stat', stat: 'STR', value: 2, description: '+2 Fuerza temporal en combate', description_en: '+2 Strength in combat' },
      { type: 'passive_stat', stat: 'maxHp', value: 15, description: '+15 HP máximo', description_en: '+15 max HP' },
      { type: 'combat_trigger', value: 0, condition: 'hp_below_30pct', description: 'Al bajar del 30% HP: Furia de Oso — inmune a miedo y +2 AC por 2 turnos', description_en: 'Below 30% HP: Bear Rage — immune to fear and +2 AC for 2 turns' },
    ],
  },

  // ── ELEMENTALES ──────────────────────────────────────────
  {
    id: 'fire_minor_essence',
    name: 'Esencia de Fuego Menor',
    name_en: 'Minor Fire Essence',
    category: 'ELEMENTAL',
    rank: 5,
    slotsRequired: 1,
    monsterSource: 'fire_elemental_minor',
    evolutionKillsRequired: [8, 20, 40],
    evolutionLevels: [
      { type: 'passive_resistance', value: 0, description: 'Resistencia a daño de fuego', description_en: 'Fire damage resistance' },
      { type: 'combat_trigger', value: 4, condition: 'on_hit', description: 'Los ataques cuerpo a cuerpo infligen 1d4 fuego adicional', description_en: 'Melee attacks deal 1d4 extra fire damage' },
      { type: 'active_ability', value: 0, cooldownTurns: 4, description: 'Explosión ígnea: 3d6 daño de fuego en área de 3m', description_en: 'Ignis Burst: 3d6 fire damage in 3m radius' },
    ],
  },

  // ── DRACÓNICAS ───────────────────────────────────────────
  {
    id: 'red_dragon_essence',
    name: 'Esencia de Dragón Rojo',
    name_en: 'Red Dragon Essence',
    category: 'DRACONIC',
    rank: 3,
    slotsRequired: 2,
    monsterSource: 'young_red_dragon',
    evolutionKillsRequired: [3, 8, 20],
    evolutionLevels: [
      { type: 'active_ability', value: 0, cooldownTurns: 5, description: 'Aliento de Fuego: 4d6 fuego, tirada de salvación DEX DC 14', description_en: 'Fire Breath: 4d6 fire, DEX save DC 14' },
      { type: 'passive_resistance', value: 0, description: 'Inmunidad a fuego + resistencia a ácido', description_en: 'Fire immunity + acid resistance' },
      { type: 'aura', value: 3, description: 'Aura dracónica: enemigos en 3m tienen desventaja en ataques contra ti', description_en: 'Draconic aura: enemies within 3m have disadvantage attacking you' },
    ],
  },

  // ── ESPIRITUALES ─────────────────────────────────────────
  {
    id: 'spectral_essence',
    name: 'Esencia Espectral',
    name_en: 'Spectral Essence',
    category: 'SPIRITUAL',
    rank: 4,
    slotsRequired: 1,
    monsterSource: 'specter',
    evolutionKillsRequired: [6, 18, 35],
    evolutionLevels: [
      { type: 'active_ability', value: 0, cooldownTurns: 6, description: 'Paso Espectral: atravesar una pared o puerta brevemente (reacción)', description_en: 'Spectral Step: pass through a wall or door briefly (reaction)' },
      { type: 'exploration', value: 0, description: 'Sigilo Espiritual: ventaja en sigilo, no dejas huellas', description_en: 'Spirit Stealth: advantage on stealth, leave no tracks' },
      { type: 'combat_trigger', value: 0, condition: 'critical_hit_received', description: 'Al recibir crítico: forma espectral por 1 turno (+50% evasión)', description_en: 'On critical received: spectral form for 1 turn (+50% evasion)' },
    ],
  },

  // ── LEGENDARIAS ──────────────────────────────────────────
  {
    id: 'phoenix_essence',
    name: 'Esencia Fénix',
    name_en: 'Phoenix Essence',
    category: 'LEGENDARY',
    rank: 1,
    slotsRequired: 4,
    monsterSource: 'phoenix',
    evolutionKillsRequired: [1, 3, 7],
    evolutionLevels: [
      { type: 'combat_trigger', value: 0, condition: 'hp_reaches_zero', description: 'Renacimiento: una vez por temporada, revive con 25% HP al morir', description_en: 'Rebirth: once per season, revive with 25% HP on death' },
      { type: 'passive_stat', stat: 'fireDamageBonus', value: 25, description: '+25% a todo daño de fuego', description_en: '+25% to all fire damage' },
      { type: 'aura', value: 6, description: 'Aura del Fénix: aliados en 6m regeneran 2 HP al inicio de cada turno', description_en: 'Phoenix Aura: allies within 6m regenerate 2 HP at start of each turn' },
    ],
  },

  // ── MÍTICAS ──────────────────────────────────────────────
  {
    id: 'time_essence',
    name: 'Esencia del Tiempo',
    name_en: 'Time Essence',
    category: 'MYTHIC',
    rank: 1,
    slotsRequired: 4,
    monsterSource: 'time_dragon',
    evolutionKillsRequired: [1, 2, 5],
    evolutionLevels: [
      { type: 'active_ability', value: 0, cooldownTurns: 0, description: 'Reacción Extra: una vez por combate, tomar una reacción adicional fuera de turno', description_en: 'Extra Reaction: once per combat, take an additional reaction out of turn' },
      { type: 'combat_trigger', value: 0, condition: 'roll_natural_1', description: 'Bucle Temporal: al sacar 1 natural en ataque, relanzar automáticamente', description_en: 'Time Loop: on natural 1 on attack, automatically reroll' },
      { type: 'active_ability', value: 0, cooldownTurns: 8, description: 'Retroceso Temporal: deshacer la última acción del enemigo (como si no hubiera ocurrido)', description_en: 'Time Reversal: undo the last enemy action as if it never happened' },
    ],
  },
];
```

---

## Paso 3 — Drop de esencias tras combate

```typescript
// src/services/essenceService.ts — continuación

// ─── Probabilidades de drop por tipo de enemigo ───────────

/**
 * Sistema Híbrido RPG.MD tabla 10 — Probabilidad por tipo de enemigo
 */
export const DROP_CHANCE_BY_ENEMY_TYPE: Record<string, number> = {
  minor:      0.05,   // criatura menor
  elite:      0.15,   // élite
  miniboss:   0.35,   // miniboss
  boss:       0.70,   // boss de nivel
  major_boss: 1.00,   // boss mayor (cada 10 pisos)
};

// ─── Calidad de la esencia (d100) ─────────────────────────

/**
 * Sistema Híbrido RPG.MD tabla 11 — Calidad de esencia
 */
export function rollEssenceRank(rng: PRNG): EssenceRank {
  const roll = Math.floor(rng.float() * 100) + 1; // 1–100
  if (roll <= 50)  return 5; // Común
  if (roll <= 75)  return 4; // Raro
  if (roll <= 90)  return 3; // Épico
  if (roll <= 98)  return 2; // Mítico
  return 1;                  // Legendario (99–100)
}

// ─── Generar drop de esencia ──────────────────────────────

export type EssenceDrop = {
  definitionId: string;
  rank: EssenceRank;
  evolutionLevel: 1 | 2 | 3;
  killsOnThisType: number;
};

/**
 * Determina si un enemigo dropea esencia y cuál.
 * Llamar desde combatEngine.ts tras la muerte de cada enemigo.
 *
 * @param enemyType - tipo del monstruo derrotado
 * @param enemyMonsterKey - clave específica del monstruo (ej: 'wolf', 'fire_elemental_minor')
 * @param roomId - para seed determinística
 * @param seedHash
 * @param cycle
 */
export function resolveEssenceDrop(
  enemyType: keyof typeof DROP_CHANCE_BY_ENEMY_TYPE,
  enemyMonsterKey: string,
  roomId: string,
  seedHash: string,
  cycle: number,
): EssenceDrop | null {
  const rng = makePRNG(`${seedHash}_essence_drop_${roomId}_${enemyMonsterKey}_${cycle}`);

  const dropChance = DROP_CHANCE_BY_ENEMY_TYPE[enemyType] ?? 0.05;

  // ¿Dropea?
  if (rng.float() > dropChance) return null;

  // ¿Esencia menor o mayor? (d20 del Sistema Híbrido RPG.MD)
  const d20 = rng.next(1, 20);
  const isMajor = d20 === 20; // Solo el 20 da esencia mayor

  // Si es menor (16–19): rank forzado a 5 o 4
  // Si es mayor (20): tirada d100 completa
  const rank: EssenceRank = isMajor
    ? rollEssenceRank(rng)
    : (rng.float() > 0.5 ? 5 : 4);

  // Buscar esencia que matchee el monstruo y el rank
  const candidates = ESSENCE_CATALOG.filter(e =>
    e.monsterSource === enemyMonsterKey && e.rank === rank,
  );

  // Si no hay match exacto, buscar por categoría derivada del monstruo
  const definition = candidates.length > 0
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

/**
 * Fallback: buscar la esencia más cercana si no hay match exacto.
 * Derivar categoría desde el nombre del monstruo.
 */
function findClosestEssence(monsterKey: string, rank: EssenceRank, rng: PRNG): EssenceDefinition | null {
  // Heurística simple: monstruos con 'fire'|'flame' → ELEMENTAL, 'dragon' → DRACONIC, etc.
  const categoryHints: Array<[string, EssenceCategory]> = [
    ['fire', 'ELEMENTAL'], ['ice', 'ELEMENTAL'], ['storm', 'ELEMENTAL'],
    ['dragon', 'DRACONIC'], ['drake', 'DRACONIC'],
    ['wolf', 'BESTIAL'], ['bear', 'BESTIAL'], ['tiger', 'BESTIAL'],
    ['demon', 'DEMONIC'], ['devil', 'DEMONIC'], ['infernal', 'DEMONIC'],
    ['spirit', 'SPIRITUAL'], ['ghost', 'SPIRITUAL'], ['specter', 'SPIRITUAL'],
    ['troll', 'MONSTROUS'], ['ogre', 'MONSTROUS'], ['giant', 'MONSTROUS'],
    ['mage', 'ARCANE'], ['wizard', 'ARCANE'], ['arcane', 'ARCANE'],
  ];

  const hint = categoryHints.find(([k]) => monsterKey.toLowerCase().includes(k));
  const category: EssenceCategory = hint ? hint[1] : 'BESTIAL';

  const matches = ESSENCE_CATALOG.filter(e =>
    e.category === category && Math.abs(e.rank - rank) <= 1,
  );

  return matches.length > 0
    ? matches[Math.floor(rng.float() * matches.length)]
    : null;
}
```

---

## Paso 4 — Evolución de esencias

```typescript
// src/services/essenceService.ts — continuación

/**
 * Verifica si una esencia equipada puede evolucionar.
 * La evolución requiere matar más monstruos del mismo tipo.
 */
export function canEvolveEssence(
  essence: CharacterEssence,
  killsOnType: number,
): boolean {
  if (essence.evolutionLevel >= 3) return false;
  const def = ESSENCE_CATALOG.find(e => e.id === essence.definitionId);
  if (!def) return false;

  const killsNeeded = def.evolutionKillsRequired[essence.evolutionLevel - 1];
  return killsOnType >= killsNeeded;
}

/**
 * Evoluciona una esencia al siguiente nivel.
 * Solo se puede hacer en zona segura (CampScreen).
 * Retorna la esencia actualizada.
 */
export function evolveEssence(essence: CharacterEssence): CharacterEssence {
  if (essence.evolutionLevel >= 3) return essence;
  return {
    ...essence,
    evolutionLevel: (essence.evolutionLevel + 1) as 1 | 2 | 3,
  };
}

/**
 * Retorna los efectos activos de una esencia según su nivel de evolución.
 * Acumulativo: nivel 3 tiene los efectos de nivel 1 + 2 + 3.
 */
export function getActiveEffects(essence: CharacterEssence): EssenceEffect[] {
  const def = ESSENCE_CATALOG.find(e => e.id === essence.definitionId);
  if (!def) return [];
  return def.evolutionLevels.slice(0, essence.evolutionLevel);
}

/**
 * Calcula el bonus de poder de una esencia para el power score del simulador.
 * Usado en calculatePartyPower() para incluir esencias en la ecuación.
 */
export function getEssencePowerScore(essence: CharacterEssence): number {
  const rankMultiplier: Record<EssenceRank, number> = { 5: 1, 4: 2, 3: 4, 2: 8, 1: 16 };
  const def = ESSENCE_CATALOG.find(e => e.id === essence.definitionId);
  if (!def) return 0;
  return rankMultiplier[def.rank] * essence.evolutionLevel;
}

// ─── Type de esencia equipada en un personaje ─────────────

export type CharacterEssence = {
  id: string;              // UUID único de esta instancia
  definitionId: string;    // referencia al ESSENCE_CATALOG
  rank: EssenceRank;
  evolutionLevel: 1 | 2 | 3;
  killsOnSourceType: number;  // kills acumuladas del tipo de monstruo fuente
  equippedSlot: number;       // 0-indexed (0, 1, 2, 3)
  equippedToChar: string;     // nombre del personaje
  obtainedCycle: number;
  obtainedFloor: number;
};
```

---

## Paso 5 — Migration v13: tabla `essences`

```typescript
// src/database/migrations.ts — migration v13

13: [
  `CREATE TABLE IF NOT EXISTS essences (
    id TEXT PRIMARY KEY,
    seed_hash TEXT NOT NULL,
    owner_game_id TEXT NOT NULL,
    owner_char_name TEXT,             -- null = en inventario sin equipar
    definition_id TEXT NOT NULL,      -- ref a ESSENCE_CATALOG
    rank INTEGER NOT NULL,            -- 1-5
    evolution_level INTEGER NOT NULL DEFAULT 1,
    kills_on_source_type INTEGER NOT NULL DEFAULT 1,
    equipped_slot INTEGER,            -- 0-indexed, null si no equipada
    obtained_cycle INTEGER NOT NULL DEFAULT 1,
    obtained_floor INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 0,  -- 1 = equipada y efectiva
    created_at TEXT NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_essences_game ON essences(owner_game_id)`,
  `CREATE INDEX IF NOT EXISTS idx_essences_char ON essences(owner_char_name)`,
  `CREATE INDEX IF NOT EXISTS idx_essences_seed ON essences(seed_hash)`,

  -- Contador de kills por tipo de monstruo por personaje
  -- Necesario para calcular evolución de esencias
  `CREATE TABLE IF NOT EXISTS monster_kills (
    id TEXT PRIMARY KEY,
    owner_game_id TEXT NOT NULL,
    owner_char_name TEXT NOT NULL,
    monster_type TEXT NOT NULL,        -- ej: 'wolf', 'fire_elemental_minor'
    kill_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS idx_kills_unique
   ON monster_kills(owner_game_id, owner_char_name, monster_type)`,
],
```

---

## Paso 6 — essenceRepository.ts

Crear `src/database/essenceRepository.ts`:

```typescript
import { getDB } from './connection';
import type { CharacterEssence, EssenceDrop } from '../services/essenceService';

// ─── Guardar esencia obtenida ──────────────────────────────

export function saveEssenceDrop(
  drop: EssenceDrop,
  gameId: string,
  seedHash: string,
  cycle: number,
  floor: number,
): CharacterEssence {
  const db  = getDB();
  const id  = `${seedHash}_essence_${drop.definitionId}_${cycle}_${floor}_${Date.now()}`;

  db.executeSync(
    `INSERT INTO essences
      (id, seed_hash, owner_game_id, definition_id, rank, evolution_level,
       kills_on_source_type, obtained_cycle, obtained_floor, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?, 0, datetime('now'))`,
    [id, seedHash, gameId, drop.definitionId, drop.rank, cycle, floor],
  );

  return {
    id, definitionId: drop.definitionId, rank: drop.rank,
    evolutionLevel: 1, killsOnSourceType: 1,
    equippedSlot: null as any, equippedToChar: null as any,
    obtainedCycle: cycle, obtainedFloor: floor,
  };
}

// ─── Equipar esencia a un personaje ───────────────────────

export function equipEssence(
  essenceId: string,
  charName: string,
  slot: number,
  gameId: string,
): void {
  const db = getDB();

  // Desocupar el slot si hay otra esencia ahí
  db.executeSync(
    `UPDATE essences
     SET equipped_slot = NULL, owner_char_name = NULL, is_active = 0
     WHERE owner_game_id = ? AND owner_char_name = ? AND equipped_slot = ?`,
    [gameId, charName, slot],
  );

  // Equipar la nueva
  db.executeSync(
    `UPDATE essences
     SET owner_char_name = ?, equipped_slot = ?, is_active = 1
     WHERE id = ?`,
    [charName, slot, essenceId],
  );
}

// ─── Desequipar esencia ────────────────────────────────────

export function unequipEssence(essenceId: string): void {
  const db = getDB();
  db.executeSync(
    `UPDATE essences
     SET owner_char_name = NULL, equipped_slot = NULL, is_active = 0
     WHERE id = ?`,
    [essenceId],
  );
}

// ─── Obtener esencias equipadas de un personaje ───────────

export function getEquippedEssences(charName: string, gameId: string): CharacterEssence[] {
  const db = getDB();
  const rows = db.executeSync(
    `SELECT * FROM essences
     WHERE owner_game_id = ? AND owner_char_name = ? AND is_active = 1
     ORDER BY equipped_slot ASC`,
    [gameId, charName],
  ).rows ?? [];
  return rows.map(rowToEssence);
}

// ─── Obtener inventario de esencias sin equipar ───────────

export function getUnequippedEssences(gameId: string): CharacterEssence[] {
  const db = getDB();
  const rows = db.executeSync(
    `SELECT * FROM essences
     WHERE owner_game_id = ? AND (owner_char_name IS NULL OR is_active = 0)
     ORDER BY rank ASC, obtained_floor DESC`,
    [gameId],
  ).rows ?? [];
  return rows.map(rowToEssence);
}

// ─── Registrar kill de monstruo (para evolución) ──────────

export function incrementMonsterKills(
  gameId: string,
  charName: string,
  monsterType: string,
): number {
  const db = getDB();

  db.executeSync(
    `INSERT INTO monster_kills (id, owner_game_id, owner_char_name, monster_type, kill_count, updated_at)
     VALUES (?, ?, ?, ?, 1, datetime('now'))
     ON CONFLICT(owner_game_id, owner_char_name, monster_type)
     DO UPDATE SET kill_count = kill_count + 1, updated_at = datetime('now')`,
    [`${gameId}_${charName}_${monsterType}`, gameId, charName, monsterType],
  );

  const result = db.executeSync(
    `SELECT kill_count FROM monster_kills
     WHERE owner_game_id = ? AND owner_char_name = ? AND monster_type = ?`,
    [gameId, charName, monsterType],
  );

  return (result.rows?.[0]?.kill_count as number) ?? 1;
}

// ─── Actualizar nivel de evolución ────────────────────────

export function upgradeEssenceEvolution(essenceId: string, newLevel: 1 | 2 | 3): void {
  const db = getDB();
  db.executeSync(
    `UPDATE essences SET evolution_level = ? WHERE id = ?`,
    [newLevel, essenceId],
  );
}

// ─── Helper ───────────────────────────────────────────────

function rowToEssence(row: Record<string, unknown>): CharacterEssence {
  return {
    id:                row.id as string,
    definitionId:      row.definition_id as string,
    rank:              row.rank as EssenceRank,
    evolutionLevel:    row.evolution_level as 1 | 2 | 3,
    killsOnSourceType: row.kills_on_source_type as number,
    equippedSlot:      row.equipped_slot as number,
    equippedToChar:    row.owner_char_name as string,
    obtainedCycle:     row.obtained_cycle as number,
    obtainedFloor:     row.obtained_floor as number,
  };
}
```

---

## Paso 7 — Integración en combatEngine.ts

```typescript
// src/services/combatEngine.ts — añadir resolución de esencias al final del combate

import { resolveEssenceDrop } from './essenceService';
import { saveEssenceDrop, incrementMonsterKills } from '../database/essenceRepository';

// En resolveCombat(), al procesar la muerte de cada enemigo:

function processEnemyDeath(
  enemy: MonsterStats,
  roomId: string,
  seedHash: string,
  cycle: number,
  floor: number,
  gameId: string,
  killerCharName: string,
): { essenceDrop: CharacterEssence | null } {
  // 1. Registrar kill del tipo de monstruo para el personaje que mató
  incrementMonsterKills(gameId, killerCharName, enemy.monsterKey);

  // 2. Intentar drop de esencia
  const drop = resolveEssenceDrop(
    enemy.enemyType,      // 'minor' | 'elite' | 'miniboss' | 'boss' | 'major_boss'
    enemy.monsterKey,     // 'wolf' | 'fire_elemental' | etc.
    roomId,
    seedHash,
    cycle,
  );

  if (!drop) return { essenceDrop: null };

  // 3. Persistir la esencia en DB (sin equipar todavía)
  const essence = saveEssenceDrop(drop, gameId, seedHash, cycle, floor);

  return { essenceDrop: essence };
}

// En CombatResult — añadir campo:
export type CombatResult = {
  // ...campos existentes...
  essenceDrops: CharacterEssence[];  // esencias obtenidas en este combate
};
```

---

## Paso 8 — Aplicar efectos de esencia en combate

```typescript
// src/services/combatEngine.ts — aplicar modificadores de esencia a los stats

import { getEquippedEssences, getActiveEffects } from './essenceService';
import { getEquippedEssences as dbGetEquippedEssences } from '../database/essenceRepository';

/**
 * Construye los modificadores de combate totales de un personaje
 * incluyendo sus esencias equipadas.
 */
export function buildCombatModifiers(
  char: CharacterSave,
  gameId: string,
): CombatModifiers {
  const essences = dbGetEquippedEssences(char.name, gameId);
  const base: CombatModifiers = {
    damageBonus:    0,
    acBonus:        0,
    hpBonus:        0,
    strBonus:       0,
    dexBonus:       0,
    resistances:    [],
    activeAbilities: [],
    combatTriggers: [],
  };

  for (const essence of essences) {
    const effects = getActiveEffects(essence);
    for (const effect of effects) {
      switch (effect.type) {
        case 'passive_stat':
          if (effect.stat === 'STR')   base.strBonus   += effect.value;
          if (effect.stat === 'maxHp') base.hpBonus    += effect.value;
          if (effect.stat === 'AC')    base.acBonus    += effect.value;
          break;
        case 'passive_resistance':
          base.resistances.push(effect.description);
          break;
        case 'active_ability':
          base.activeAbilities.push({
            essenceId:     essence.id,
            description:   effect.description,
            cooldownTurns: effect.cooldownTurns ?? 0,
          });
          break;
        case 'combat_trigger':
          base.combatTriggers.push({
            essenceId:  essence.id,
            condition:  effect.condition ?? '',
            effect:     effect,
          });
          break;
      }
    }
  }

  return base;
}
```

---

## Paso 9 — Tab ESENCIAS en CampScreen

```typescript
// src/screens/CampScreen.tsx — añadir tab ESSENCES

type CampTab = 'PARTY' | 'INVENTORY' | 'ESSENCES' | 'REST';

// ── EssencesTab ────────────────────────────────────────────

const EssencesTab = () => {
  const activeGame = useGameStore(s => s.activeGame);
  const [unequipped, setUnequipped] = useState<CharacterEssence[]>([]);
  const [selectedChar, setSelectedChar] = useState<string | null>(null);

  useEffect(() => {
    if (activeGame) {
      setUnequipped(getUnequippedEssences(activeGame.id));
    }
  }, [activeGame]);

  const charEssences = useMemo(() => {
    if (!selectedChar || !activeGame) return [];
    return getEquippedEssences(selectedChar, activeGame.id);
  }, [selectedChar, activeGame]);

  const charLevel = activeGame?.partyData.find(c => c.name === selectedChar)?.level ?? 1;
  const availableSlots = getEssenceSlots(charLevel, false); // TODO: isAscended

  return (
    <ScrollView className="flex-1 px-4 pt-3">

      {/* Selector de personaje */}
      <Text className="text-muted font-robotomono-bold text-xs mb-2">GESTIONAR ESENCIAS DE</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {activeGame?.partyData.filter(c => c.alive).map(char => (
          <TouchableOpacity
            key={char.name}
            onPress={() => setSelectedChar(char.name)}
            className={`border px-3 py-2 ${selectedChar === char.name ? 'border-primary bg-primary/10' : 'border-muted/30'}`}
          >
            <Text className="text-primary font-robotomono text-xs">{char.name.toUpperCase()}</Text>
            <Text className="text-muted font-robotomono text-[9px]">
              Nv {char.level ?? 1} · {getEssenceSlots(char.level ?? 1, false)} slot/s
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedChar && (
        <>
          {/* Slots equipados */}
          <Text className="text-secondary font-robotomono-bold text-xs mb-2">
            SLOTS ACTIVOS ({charEssences.length}/{availableSlots})
          </Text>

          {Array.from({ length: availableSlots }).map((_, slotIndex) => {
            const equipped = charEssences.find(e => e.equippedSlot === slotIndex);
            const def = equipped ? ESSENCE_CATALOG.find(d => d.id === equipped.definitionId) : null;

            return (
              <View
                key={slotIndex}
                className={`border p-3 mb-2 ${equipped ? 'border-primary/60' : 'border-muted/20'}`}
              >
                <Text className="text-muted font-robotomono text-[9px] mb-1">
                  SLOT {slotIndex + 1}
                </Text>
                {equipped && def ? (
                  <>
                    <Text className="text-primary font-robotomono-bold text-xs">{def.name}</Text>
                    <Text className={`font-robotomono text-[9px] ${rankColor(equipped.rank)}`}>
                      {rankLabel(equipped.rank)} · Evolución {equipped.evolutionLevel}/3
                    </Text>
                    {/* Efectos activos */}
                    {getActiveEffects(equipped).map((effect, ei) => (
                      <Text key={ei} className="text-muted font-robotomono text-[9px] mt-1">
                        · {effect.description}
                      </Text>
                    ))}
                    {/* Evolución disponible */}
                    {canEvolveEssence(equipped, equipped.killsOnSourceType) && (
                      <TouchableOpacity
                        onPress={() => {
                          upgradeEssenceEvolution(equipped.id, (equipped.evolutionLevel + 1) as 2 | 3);
                          // Refrescar
                        }}
                        className="mt-2 border border-secondary/60 px-2 py-1 self-start"
                      >
                        <Text className="text-secondary font-robotomono text-[9px]">
                          ⭐ EVOLUCIONAR → Nv {equipped.evolutionLevel + 1}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        unequipEssence(equipped.id);
                        // Refrescar estado
                      }}
                      className="mt-1 self-start"
                    >
                      <Text className="text-destructive/60 font-robotomono text-[9px]">desequipar</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text className="text-muted/40 font-robotomono text-[9px]">— vacío —</Text>
                )}
              </View>
            );
          })}

          {/* Inventario de esencias sin equipar */}
          {unequipped.length > 0 && (
            <>
              <Text className="text-muted font-robotomono-bold text-xs mb-2 mt-4">
                INVENTARIO ({unequipped.length})
              </Text>
              {unequipped.map(essence => {
                const def = ESSENCE_CATALOG.find(d => d.id === essence.definitionId);
                if (!def) return null;
                const slotsNeeded = SLOTS_REQUIRED_BY_RANK[essence.rank];
                const canEquip = availableSlots - charEssences.length >= slotsNeeded;

                return (
                  <View key={essence.id} className="border border-muted/20 p-3 mb-2">
                    <View className="flex-row justify-between">
                      <Text className="text-primary font-robotomono text-xs">{def.name}</Text>
                      <Text className={`font-robotomono text-[9px] ${rankColor(essence.rank)}`}>
                        {rankLabel(essence.rank)}
                      </Text>
                    </View>
                    <Text className="text-muted font-robotomono text-[9px]">
                      Requiere {slotsNeeded} slot/s · Piso {essence.obtainedFloor}
                    </Text>
                    {canEquip ? (
                      <TouchableOpacity
                        onPress={() => {
                          const nextSlot = availableSlots - charEssences.length;
                          equipEssence(essence.id, selectedChar, nextSlot - 1, activeGame!.id);
                          // Refrescar
                        }}
                        className="mt-2 border border-primary/60 px-2 py-1 self-start"
                      >
                        <Text className="text-primary font-robotomono text-[9px]">EQUIPAR</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text className="text-destructive/60 font-robotomono text-[9px] mt-1">
                        Sin slots disponibles
                      </Text>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
};

// ── Helpers visuales ──────────────────────────────────────

function rankLabel(rank: EssenceRank): string {
  return { 5: 'COMÚN', 4: 'RARO', 3: 'ÉPICO', 2: 'MÍTICO', 1: 'LEGENDARIO' }[rank];
}

function rankColor(rank: EssenceRank): string {
  return { 5: 'text-muted', 4: 'text-secondary', 3: 'text-accent', 2: 'text-primary', 1: 'text-yellow-400' }[rank];
}
```

---

## Paso 10 — Ascensión (Post Nivel 20)

La ascensión es el contenido endgame. Solo es posible una vez, es irreversible, y transforma fundamentalmente al personaje.

```typescript
// src/services/essenceService.ts — Ascensión

export type AscensionPath = 'TITAN' | 'ARCHMAGE' | 'AVATAR_OF_WAR';

export type AscensionRequirements = {
  level: 20;
  essencesRequired: {
    minRank: EssenceRank;    // mínimo de rank (ej: rank 3 = Épico o mejor)
    count: number;
  };
  bossKillRequired: boolean;  // debe haber matado un boss de piso 50+
};

export const ASCENSION_PATHS: Record<AscensionPath, {
  name: string;
  description: string;
  requirements: AscensionRequirements;
  bonuses: string[];
  unlockedAbility: string;
}> = {
  TITAN: {
    name: 'Titán',
    description: 'El cuerpo trasciende sus límites mortales. La fuerza lo es todo.',
    requirements: {
      level: 20,
      essencesRequired: { minRank: 3, count: 2 },
      bossKillRequired: true,
    },
    bonuses: [
      '+4 STR máximo (supera el límite de 20)',
      'Resistencia a daño físico',
      'Tamaño grande: ventaja en chequeos de Atletismo y Fuerza',
      '+1 slot de esencia',
    ],
    unlockedAbility: 'titan_strike',  // Ataque que no puede bloquearse con escudo
  },
  ARCHMAGE: {
    name: 'Archmago',
    description: 'La magia fluye sin restricciones. Los límites del maná ya no existen.',
    requirements: {
      level: 20,
      essencesRequired: { minRank: 3, count: 2 },
      bossKillRequired: true,
    },
    bonuses: [
      'Slot adicional de hechizo de nivel 9',
      'Recuperar un slot de hechizo en descanso corto',
      '+1 slot de esencia',
    ],
    unlockedAbility: 'arcane_surge',  // Lanzar un hechizo como acción bonus una vez por combate
  },
  AVATAR_OF_WAR: {
    name: 'Avatar de Guerra',
    description: 'El combate es su naturaleza. Cada movimiento es letal.',
    requirements: {
      level: 20,
      essencesRequired: { minRank: 2, count: 1 }, // Necesita al menos una esencia Mítica
      bossKillRequired: true,
    },
    bonuses: [
      '1 acción extra por combate (una vez por turno)',
      'Críticos con 19–20 en lugar de solo 20',
      '+1 slot de esencia',
    ],
    unlockedAbility: 'war_avatar_form',  // 3 turnos: inmune a control, +2 ataques
  },
};

/**
 * Verifica si un personaje cumple los requisitos para ascender.
 */
export function canAscend(
  char: CharacterSave,
  gameId: string,
  bossesKilled: number,
): { eligible: boolean; missingRequirements: string[] } {
  const missing: string[] = [];

  if ((char.level ?? 1) < 20) {
    missing.push(`Nivel 20 requerido (actual: ${char.level ?? 1})`);
  }

  if (bossesKilled === 0) {
    missing.push('Debes haber derrotado al menos un boss de piso 50 o superior');
  }

  const equipped = getEquippedEssences(char.name, gameId);
  const epicOrBetter = equipped.filter(e => e.rank <= 3); // rank 3, 2, o 1
  if (epicOrBetter.length < 1) {
    missing.push('Necesitas al menos una esencia Épica o superior equipada');
  }

  return { eligible: missing.length === 0, missingRequirements: missing };
}
```

---

## Paso 11 — AscensionScreen

```typescript
// src/screens/AscensionScreen.tsx
// Accesible desde CampScreen tab PARTY cuando el personaje cumple requisitos

export const AscensionScreen = ({ navigation, route }: ScreenProps<'AscensionScreen'>) => {
  const { characterIndex } = route.params;
  const activeGame     = useGameStore(s => s.activeGame);
  const updateProgress = useGameStore(s => s.updateProgress);
  const [selectedPath, setSelectedPath] = useState<AscensionPath | null>(null);

  const char = activeGame?.partyData[characterIndex];
  if (!char) return null;

  const handleConfirmAscension = useCallback(() => {
    if (!selectedPath || !activeGame) return;

    const path = ASCENSION_PATHS[selectedPath];

    const updatedParty = activeGame.partyData.map((c, i) => {
      if (i !== characterIndex) return c;
      return {
        ...c,
        isAscended: true,
        ascensionPath: selectedPath,
        // Aplicar bonuses según el camino
        baseStats: selectedPath === 'TITAN'
          ? { ...c.baseStats, STR: Math.min(24, c.baseStats.STR + 4) }
          : c.baseStats,
        unlockedAbilities: [...(c.unlockedAbilities ?? []), path.unlockedAbility],
        // El +1 slot lo calcula getEssenceSlots() cuando isAscended = true
      };
    });

    updateProgress({ partyData: updatedParty });
    navigation.goBack();
  }, [selectedPath, activeGame, characterIndex, updateProgress, navigation]);

  return (
    <View className="flex-1 bg-background px-6 justify-center">
      <CRTOverlay />

      <Text className="text-accent font-robotomono-bold text-2xl text-center mb-2">
        ✦ ASCENSIÓN
      </Text>
      <Text className="text-primary font-robotomono text-sm text-center mb-8">
        {char.name.toUpperCase()} ha alcanzado los límites de su clase.
        Elige un camino. Esta elección no puede deshacerse.
      </Text>

      {(Object.entries(ASCENSION_PATHS) as [AscensionPath, typeof ASCENSION_PATHS[AscensionPath]][]).map(([key, path]) => (
        <TouchableOpacity
          key={key}
          onPress={() => setSelectedPath(key)}
          className={`border p-4 mb-3 ${selectedPath === key ? 'border-accent bg-accent/10' : 'border-muted/30'}`}
        >
          <Text className="text-primary font-robotomono-bold text-sm">{path.name.toUpperCase()}</Text>
          <Text className="text-muted font-robotomono text-[10px] mt-1 mb-2">{path.description}</Text>
          {path.bonuses.map((bonus, i) => (
            <Text key={i} className="text-secondary font-robotomono text-[10px]">· {bonus}</Text>
          ))}
        </TouchableOpacity>
      ))}

      {selectedPath && (
        <TouchableOpacity
          onPress={handleConfirmAscension}
          className="border border-accent bg-accent/20 py-4 items-center mt-4"
        >
          <Text className="text-accent font-robotomono-bold text-sm">
            CONFIRMAR ASCENSIÓN — {ASCENSION_PATHS[selectedPath].name.toUpperCase()}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
```

---

## Paso 12 — Actualizar calculatePartyPower con esencias

```typescript
// src/services/encounterService.ts — modificar calculatePartyPower

import { getEquippedEssences as dbGetEquipped } from '../database/essenceRepository';
import { getEssencePowerScore } from './essenceService';

export function calculatePartyPower(party: CharacterSave[], gameId?: string): number {
  return party
    .filter(c => c.alive)
    .reduce((total, c) => {
      const avgStat = (
        c.baseStats.STR + c.baseStats.DEX + c.baseStats.CON +
        c.baseStats.INT + c.baseStats.WIS + c.baseStats.CHA
      ) / 6;

      const statMult  = avgStat / 10;
      const level     = c.level ?? 1;

      // Bonus de esencias al power score (solo si tenemos el gameId)
      const essenceBonus = gameId
        ? dbGetEquipped(c.name, gameId).reduce((s, e) => s + getEssencePowerScore(e), 0) * 0.1
        : 0;

      // Ascensión añade multiplicador al power score
      const ascensionMult = c.isAscended ? 1.15 : 1.0;

      return total + (level * statMult * ascensionMult) + essenceBonus;
    }, 0);
}
```

---

## Paso 13 — Trigger narrativo emocional al obtener esencia legendaria

```typescript
// src/screens/ReportScreen.tsx — mostrar esencias obtenidas y disparar emoción si es épica+

import { NarrativeEvent } from '../services/narrativeEventService';

useEffect(() => {
  if (!combatResult?.essenceDrops?.length) return;

  const legendary = combatResult.essenceDrops.find(e => e.rank <= 2); // Mítico o Legendario
  const epic      = combatResult.essenceDrops.find(e => e.rank === 3);

  if (legendary) {
    // Dispara evento narrativo de alta intensidad
    triggerNarrativeEvent({
      id: `essence_legendary_${legendary.id}`,
      type: 'story_discovery',
      context: { essenceId: legendary.definitionId, rank: legendary.rank },
    });
    // → resolveEmotion → 'awe' o 'determination' con intensidad máxima
  } else if (epic) {
    triggerNarrativeEvent({
      id: `essence_epic_${epic.id}`,
      type: 'story_discovery',
      context: { essenceId: epic.definitionId },
    });
  }
}, [combatResult]);
```

---

## Diagrama de integración del sistema

```
COMBATE
  ↓ enemigo muere
combatEngine.processEnemyDeath()
  → incrementMonsterKills()     [essenceRepository]
  → resolveEssenceDrop()        [essenceService]
    → saveEssenceDrop()         [essenceRepository]
  → CombatResult.essenceDrops[]
  ↓
ReportScreen
  → mostrar esencias obtenidas
  → triggerNarrativeEvent si rank ≤ 2
  ↓
ZONA SEGURA (CampScreen tab ESSENCES)
  → ver esencias sin equipar
  → equipEssence() por slot
  → canEvolveEssence() → evolveEssence() si cumple kills
  → AscensionScreen si nivel 20 + requisitos
  ↓
PRÓXIMO COMBATE
  → buildCombatModifiers() incluye efectos activos de esencias
  → passive_stat aplicados a stats base
  → active_ability disponibles en acción
  → combat_trigger evaluados por condición en cada turno
  ↓
WORLD SIMULATOR
  → calculatePartyPower() incluye essenceBonus * 0.1
  → parties IA con esencias son más peligrosas en piso alto
```

---

## Checklist de implementación

- [ ] `essenceService.ts`: tipos, constantes, catálogo completo, lógica de drop y evolución (Pasos 1–4)
- [ ] Migration v13: tablas `essences` y `monster_kills` (Paso 5)
- [ ] `essenceRepository.ts`: CRUD completo de esencias (Paso 6)
- [ ] `combatEngine.ts`: `processEnemyDeath` con drop y kill tracking (Paso 7)
- [ ] `buildCombatModifiers()`: aplicar efectos activos de esencias a stats (Paso 8)
- [ ] `CampScreen`: nuevo tab `ESSENCES` con gestión completa (Paso 9)
- [ ] `ASCENSION_PATHS` y lógica de elegibilidad (Paso 10)
- [ ] `AscensionScreen` con selección de camino (Paso 11)
- [ ] `calculatePartyPower()` actualizado con esencias (Paso 12)
- [ ] `ReportScreen`: mostrar drops + trigger narrativo emocional (Paso 13)
- [ ] Añadir `isAscended`, `ascensionPath`, `unlockedAbilities` a `CharacterSave`
- [ ] Añadir ruta `AscensionScreen: { characterIndex: number }` al navigator
- [ ] `CharacterDetailScreen`: mostrar esencias equipadas y su descripción
- [ ] `worldSimulator`: parties IA en piso 30+ tienen probabilidad de "tener esencias" en su power score
- [ ] Añadir `monsterKey` y `enemyType` a `MonsterStats` en `combatEngine`
- [ ] Añadir i18n keys: `essence.rank`, `essence.equip`, `essence.evolve`, `essence.slots`, `ascension.title`, `ascension.paths`
- [ ] Expandir catálogo a las 100 esencias del Sistema Híbrido RPG.MD (por ahora solo representativas)

---

## ACTUALIZACIÓN v2 — Correcciones de integridad

### PRNG compartido

```typescript
// En essenceService.ts — REEMPLAZAR makePRNG definido inline por:
import { makePRNG, type PRNG } from '../utils/prng';
// (Ver doc 08 para la implementación del utilitario)
```

### MAX_LEVEL

```typescript
// El sistema de esencias define slots hasta nivel 20 (doc 13 tabla 4).
// En Sprint 6 el cap es MAX_LEVEL_MVP = 10 → los slots de nivel 11-20 inactivos.
// En Sprint 7 el cap sube a MAX_LEVEL_FULL = 20 → slots 11-20 se activan.
// getEssenceSlots() ya maneja esto correctamente:
//   getEssenceSlots(11, false) = 2 — retorna el slot correcto aunque el cap sea 10 hoy,
//   porque el personaje no puede estar en nivel 11 hasta que el cap suba.
```

### AscensionScreen en navigator

```typescript
// src/navigation/types.ts — añadir:
AscensionScreen: { characterIndex: number };

// Accesible desde CampScreen → PartyTab → botón "✦ ASCENSIÓN DISPONIBLE"
// Solo visible cuando char.level === MAX_LEVEL && !char.isAscended && canAscend().eligible
```
