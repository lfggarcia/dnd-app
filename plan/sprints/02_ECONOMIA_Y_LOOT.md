# 02 · ECONOMÍA Y SISTEMA DE LOOT
> **Estado actual:** ~12% — `gold` en DB, revivir funciona pero es GRATIS, market es texto decorativo
> **Sprint objetivo:** 6
> **Archivos a crear/modificar:** `migrations.ts`, nuevo `src/services/economyService.ts`, nuevo `src/services/lootService.ts`, `VillageScreen.tsx`, `combatEngine.ts`, `gameRepository.ts`
> **Nota de integridad:** Las **esencias de monstruos** son una categoría de loot separada gestionada por `essenceService.ts` (doc 13). `lootService.ts` genera `Item[]` (weapons, armor, consumables, boss_loot). Las esencias tienen su propia tabla en DB (`essences`), su propio drop resolver, y **no pasan por `itemRepository`**. En `ReportScreen`, ambos sistemas se muestran juntos pero se procesan por separado.

---

## Concepto

La economía liga el progreso vertical con la supervivencia. Revivir cuesta oro escalado por nivel y muertes acumuladas. Los items son entidades reales en la DB, no strings. El botín de jefe es único por seed — solo se puede obtener la primera vez. El PvP no genera oro.

---

## Estado Actual vs Objetivo

| Aspecto | Hoy | Objetivo |
|---------|-----|----------|
| Revivir | Gratis, restaura HP al 50% | Cuesta `BaseCost × nivel × (1 + deathCount × 0.15)` |
| Market | Texto generado por seed (`.join()`) | Items reales con precio, type, rarity en DB |
| Loot de combate | String random del array `LOOT[]` en combatEngine | Entidad `Item` en tabla `items` |
| Botín único de jefe | No existe | `boss_loot` por seed, se marca `claimed` al obtenerse |
| Deathcount | No se rastrea | Campo `death_count` por personaje en `party_data` |

---

## Paso 1 — Migration v8: tabla `items`

```typescript
// src/database/migrations.ts — migration v8

8: [
  `CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    seed_hash TEXT NOT NULL,
    owner_game_id TEXT,               -- null = en el piso (loot de dungeon)
    owner_char_name TEXT,             -- null = no equipado
    name TEXT NOT NULL,
    type TEXT NOT NULL,               -- 'weapon' | 'armor' | 'consumable' | 'material' | 'boss_loot'
    rarity TEXT NOT NULL,             -- 'common' | 'uncommon' | 'rare' | 'unique'
    is_equipped INTEGER NOT NULL DEFAULT 0,
    is_unique INTEGER NOT NULL DEFAULT 0,
    obtained_cycle INTEGER NOT NULL DEFAULT 1,
    floor_obtained INTEGER NOT NULL DEFAULT 1,
    gold_value INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL DEFAULT '{}',  -- JSON con stats/efectos específicos del item
    claimed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_items_game ON items(owner_game_id)`,
  `CREATE INDEX IF NOT EXISTS idx_items_seed ON items(seed_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_items_type ON items(type)`,
],
```

---

## Paso 2 — Servicio de economía

Crear `src/services/economyService.ts`:

```typescript
/**
 * economyService.ts
 * Fórmulas económicas del juego: revivir, compras, escalado.
 * Todas las funciones son puras — sin side effects.
 */

// ─── Constantes ───────────────────────────────────────────

export const REVIVE_BASE_COST = 100;  // oro base para revivir nivel 1
export const REST_INN_COST    = 50;   // posada (descanso largo)
export const REST_SHORT_COST  = 0;    // descanso corto en dungeon (gratis pero consume ciclo)

// ─── Types ────────────────────────────────────────────────

export type CharacterEconomyState = {
  level: number;
  deathCount: number;
  alive: boolean;
};

export type ReviveCostResult = {
  cost: number;
  canAfford: boolean;
  breakdown: string;  // "100 × nv2 × (1 + 1 muerte × 0.15) = 230G"
};

// ─── Fórmulas ─────────────────────────────────────────────

/**
 * Costo de revivir un personaje.
 * SYSTEMS.MD: ReviveCost = BaseCost × CharacterLevel × (1 + DeathCount × 0.15)
 */
export function calculateReviveCost(char: CharacterEconomyState): ReviveCostResult {
  const base = REVIVE_BASE_COST;
  const levelMult = char.level;
  const deathMult = 1 + char.deathCount * 0.15;
  const cost = Math.round(base * levelMult * deathMult);
  const breakdown = `${base} × nv${char.level} × (1 + ${char.deathCount} muerte/s × 0.15) = ${cost}G`;

  return { cost, canAfford: false, breakdown };  // canAfford se evalúa con el gold real
}

/**
 * Calcula el costo de un item según rareza y piso.
 * Los precios escalan con el progreso vertical.
 */
export function calculateItemPrice(
  basePrice: number,
  rarity: 'common' | 'uncommon' | 'rare' | 'unique',
  floorObtained: number,
): number {
  const rarityMultiplier = { common: 1, uncommon: 2.5, rare: 6, unique: 20 };
  const floorMultiplier = 1 + floorObtained * 0.03;
  return Math.round(basePrice * rarityMultiplier[rarity] * floorMultiplier);
}

/**
 * Calcula el valor de venta de un item (60% del precio de compra).
 */
export function calculateSellValue(item: { goldValue: number }): number {
  return Math.floor(item.goldValue * 0.6);
}
```

---

## Paso 3 — Servicio de loot

Crear `src/services/lootService.ts`:

```typescript
/**
 * lootService.ts
 * Genera loot determinístico por seed + roomId + floor.
 * El loot de jefe es único y se verifica contra la tabla items.
 */

import { getDB } from '../database/connection';

// ─── Tablas de loot por tipo de sala ──────────────────────

const LOOT_TABLES = {
  NORMAL: [
    { name: 'GOLD_COINS',      type: 'consumable' as const, rarity: 'common' as const,   basePrice: 10,  chance: 0.6 },
    { name: 'HEALTH_POTION',   type: 'consumable' as const, rarity: 'common' as const,   basePrice: 50,  chance: 0.3 },
    { name: 'IRON_DAGGER',     type: 'weapon' as const,     rarity: 'common' as const,   basePrice: 80,  chance: 0.1 },
  ],
  ELITE: [
    { name: 'HEALTH_POTION',   type: 'consumable' as const, rarity: 'common' as const,   basePrice: 50,  chance: 0.5 },
    { name: 'SHADOW_ESSENCE',  type: 'material' as const,   rarity: 'uncommon' as const, basePrice: 120, chance: 0.3 },
    { name: 'STEEL_SWORD',     type: 'weapon' as const,     rarity: 'uncommon' as const, basePrice: 200, chance: 0.2 },
  ],
  BOSS: [
    { name: 'SOUL_CRYSTAL',    type: 'material' as const,   rarity: 'rare' as const,     basePrice: 500, chance: 0.7 },
    { name: 'ANCIENT_ARMOR',   type: 'armor' as const,      rarity: 'rare' as const,     basePrice: 800, chance: 0.3 },
  ],
  TREASURE: [
    { name: 'GOLD_CACHE',      type: 'consumable' as const, rarity: 'uncommon' as const, basePrice: 200, chance: 0.6 },
    { name: 'RUNE_FRAGMENT',   type: 'material' as const,   rarity: 'rare' as const,     basePrice: 300, chance: 0.4 },
  ],
  SECRET: [
    { name: 'VOID_ESSENCE',    type: 'material' as const,   rarity: 'rare' as const,     basePrice: 400, chance: 0.5 },
    { name: 'CURSED_BLADE',    type: 'weapon' as const,     rarity: 'unique' as const,   basePrice: 1200, chance: 0.2 },
  ],
};

// ─── PRNG (mismo algoritmo que combatEngine.ts y dungeonGraphService.ts) ─────

function makePRNG(seed: string) {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 33) ^ seed.charCodeAt(i)) >>> 0;
  }
  let s = h >>> 0;
  return {
    next(min = 0, max = 1): number {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return min + (s / 0x100000000) * (max - min);
    },
    float(): number {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 0x100000000;
    },
  };
}

// ─── Generación de loot ───────────────────────────────────

export type LootDrop = {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'boss_loot';
  rarity: 'common' | 'uncommon' | 'rare' | 'unique';
  goldValue: number;
  data: Record<string, unknown>;
};

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
    if (rng.float() <= entry.chance) {
      drops.push({
        id: `${seedHash}_${roomId}_${entry.name}_${floor}`,
        name: entry.name,
        type: entry.type,
        rarity: entry.rarity,
        goldValue: calculateItemPriceLocal(50, entry.rarity, floor),
        data: {},
      });
    }
  }

  return drops;
}

function calculateItemPriceLocal(base: number, rarity: string, floor: number): number {
  const mult = { common: 1, uncommon: 2.5, rare: 6, unique: 20 }[rarity] ?? 1;
  return Math.round(base * mult * (1 + floor * 0.03));
}

/**
 * Verifica si el loot único de un boss ya fue reclamado en esta seed.
 * SYSTEMS.MD: "Se obtiene solo la primera vez que es derrotado."
 */
export function isBossLootClaimed(seedHash: string, bossRoomId: string): boolean {
  const db = getDB();
  const result = db.executeSync(
    'SELECT id FROM items WHERE seed_hash = ? AND name LIKE ? AND claimed = 1',
    [seedHash, `BOSS_${bossRoomId}_%`],
  );
  return (result.rows?.length ?? 0) > 0;
}

/**
 * Genera loot único de boss (solo si no fue reclamado antes).
 * Cada boss tiene UN item único por seed — determinístico.
 */
export function generateBossUniqueLoot(
  seedHash: string,
  bossRoomId: string,
  floor: number,
): LootDrop | null {
  if (isBossLootClaimed(seedHash, bossRoomId)) return null;

  const rng = makePRNG(`${seedHash}_boss_unique_${bossRoomId}`);
  const options = [
    { suffix: 'CROWN',    rarity: 'unique' as const, value: 2000 + floor * 50 },
    { suffix: 'ORB',      rarity: 'unique' as const, value: 1800 + floor * 40 },
    { suffix: 'GRIMOIRE', rarity: 'unique' as const, value: 2200 + floor * 60 },
    { suffix: 'TOTEM',    rarity: 'unique' as const, value: 1500 + floor * 45 },
  ];
  const pick = options[Math.floor(rng.float() * options.length)];

  return {
    id: `${seedHash}_boss_${bossRoomId}_${pick.suffix}`,
    name: `BOSS_${bossRoomId}_${pick.suffix}`,
    type: 'boss_loot',
    rarity: pick.rarity,
    goldValue: pick.value,
    data: { bossRoomId, floor },
  };
}
```

---

## Paso 4 — Actualizar VillageScreen: revivir con costo real

```typescript
// src/screens/VillageScreen.tsx — reemplazar reviveCharacter

import { calculateReviveCost } from '../services/economyService';

// Calcular costos de revivir para todos los muertos
const reviveCosts = useMemo(() =>
  partyData
    .filter(c => !c.alive)
    .reduce<Record<string, number>>((acc, c) => {
      const { cost } = calculateReviveCost({
        level: 1,               // nivel actual — añadir al CharacterSave en Sprint 5
        deathCount: c.deathCount ?? 0,
        alive: false,
      });
      acc[c.name] = cost;
      return acc;
    }, {}),
  [partyData],
);

const reviveCharacter = useCallback((name: string) => {
  const cost = reviveCosts[name] ?? 999999;

  if (gold < cost) {
    // Mostrar error — sin fondos
    Alert.alert(t('village.insufficientGold'), `Necesitas ${cost}G`);
    return;
  }

  const updatedParty = partyData.map(c => {
    if (c.name !== name) return c;
    return {
      ...c,
      hp: Math.floor(c.maxHp / 2),
      alive: true,
      deathCount: (c.deathCount ?? 0), // no incrementamos al revivir, solo al morir
    };
  });

  updateProgress({
    partyData: updatedParty,
    gold: gold - cost,
  });
}, [partyData, gold, reviveCosts, updateProgress, t]);

// En el render — mostrar costo junto al botón
<TouchableOpacity onPress={() => reviveCharacter(c.name)}>
  <Text>REVIVIR — {reviveCosts[c.name] ?? '?'}G</Text>
</TouchableOpacity>
```

---

## Paso 5 — Marcar muerte en combate (incrementar deathCount)

```typescript
// src/screens/BattleScreen.tsx — en handleContinue, antes de updateProgress

const updatedPartyData = activeGame.partyData.map((char, i) => {
  const combatMember = result.partyAfter[i];
  if (!combatMember) return char;

  // Si murió en este combate → incrementar deathCount
  const diedThisCombat = char.alive && !combatMember.alive;
  return {
    ...char,
    hp: combatMember.hpAfter,
    alive: combatMember.alive,
    deathCount: diedThisCombat
      ? (char.deathCount ?? 0) + 1
      : (char.deathCount ?? 0),
  };
});

updateProgress({ partyData: updatedPartyData, gold: (activeGame.gold ?? 0) + result.goldEarned });
```

---

## Paso 6 — Guardar loot en DB después de combate

```typescript
// src/screens/ReportScreen.tsx — guardar items generados

import { generateRoomLoot, generateBossUniqueLoot } from '../services/lootService';
import { saveItems } from '../database/itemRepository';  // nuevo (ver doc 08)

// En useEffect al montar ReportScreen con resultado:
useEffect(() => {
  if (!result || !activeGame) return;

  const drops = generateRoomLoot(
    route.params.roomId,
    roomType,  // del resultado del combat
    activeGame.floor,
    activeGame.cycle,
    activeGame.seedHash,
  );

  // Loot único de boss (si aplica)
  if (roomType === 'BOSS') {
    const bossUnique = generateBossUniqueLoot(
      activeGame.seedHash,
      route.params.roomId,
      activeGame.floor,
    );
    if (bossUnique) drops.push(bossUnique);
  }

  // Persistir en DB
  saveItems(drops, activeGame.id, activeGame.seedHash, activeGame.cycle, activeGame.floor);

  setLootDrops(drops);
}, []);
```

---

## Checklist de implementación

- [ ] Migration v8: tabla `items` (Paso 1)
- [ ] Crear `src/services/economyService.ts` (Paso 2)
- [ ] Crear `src/services/lootService.ts` (Paso 3)
- [ ] VillageScreen: revivir con costo real descuenta gold (Paso 4)
- [ ] BattleScreen: incrementar `deathCount` al morir (Paso 5)
- [ ] ReportScreen: guardar loot generado en DB (Paso 6)
- [ ] Añadir `deathCount` a `CharacterSave` type en `gameRepository.ts`
- [ ] VillageScreen market: mostrar items reales del inventario
- [ ] Crear `src/database/itemRepository.ts` con CRUD de items
