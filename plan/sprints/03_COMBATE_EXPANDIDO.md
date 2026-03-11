# 03 · COMBATE Y ENCUENTROS EXPANDIDO
> **Estado actual:** ~28% — combate PJ vs monstruo real. Sin huida, sin negociación, sin PvP, sin emboscadas
> **Sprint objetivo:** 6
> **Archivos a crear/modificar:** `combatEngine.ts`, `BattleScreen.tsx`, nuevo `src/services/encounterService.ts`, `navigation/types.ts`
> **Cambios v2:** añadidos `monsterKey` y `enemyType` a `MonsterStats`; añadido `essenceDrops` a `CombatResult`; la resolución de drops de esencia se llama desde `processEnemyDeath()` (ver doc 13 Paso 7). PRNG importado desde `src/utils/prng.ts`.

---

## Concepto

El combate tiene tres capas: PJ vs monstruo (ya implementado), PJ vs party IA (encuentro táctico real), y PJ vs party IA abstracto (resolución probabilística). El jugador puede atacar, negociar o huir. Las emboscadas dan ventaja de iniciativa. El PvP no genera oro pero puede generar loot de inventario.

---

## Estado Actual vs Objetivo

| Aspecto | Hoy | Objetivo |
|---------|-----|----------|
| Huida | Solo clave i18n `flee` | Chequeo Atletismo/Sigilo contra la party rival |
| Negociación | No existe | Pantalla de oferta con gold/alianza/paso libre |
| Encuentro entre parties | No existe | `encounterService.ts` detecta colisión piso+zona+ciclo |
| Emboscada | No existe | Bonus de iniciativa + primer ataque gratis si detecta primero |
| Combate PvP | No existe | Motor de combate real entre dos parties |

---

## Paso 1 — Nuevo tipo de navegación para encuentros

```typescript
// src/navigation/types.ts — añadir

export type EncounterContext =
  | { kind: 'dungeon'; roomId: string; roomType: RoomType }
  | { kind: 'pvp'; rivalName: string; rivalParty: RivalCombatant[]; isAmbush: boolean };

// Añadir a RootStackParamList:
Battle: {
  roomId: string;
  roomType: RoomType;
  encounterContext?: EncounterContext;  // si es PvP llega aquí
};
```

---

## Paso 2 — Servicio de encuentros

Crear `src/services/encounterService.ts`:

```typescript
/**
 * encounterService.ts
 * Gestiona la detección y resolución de encuentros entre parties.
 * Se ejecuta cada vez que el jugador entra a una sala o avanza piso.
 */

import type { RivalEntry } from './rivalGenerator';
import type { CharacterSave } from '../database/gameRepository';

// ─── Types ────────────────────────────────────────────────

export type EncounterResult =
  | { type: 'none' }
  | { type: 'encounter'; rival: RivalEntry; isAmbush: boolean; canNegotiate: boolean };

export type FleeResult = {
  success: boolean;
  log: string[];
  memberLost?: string;  // nombre del personaje que quedó atrás (si falla)
};

export type NegotiationOffer = {
  type: 'gold' | 'free_passage' | 'alliance';
  amount?: number;      // para 'gold'
};

export type NegotiationResult = {
  accepted: boolean;
  log: string[];
};

export type RivalCombatant = {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attackBonus: number;
  ac: number;
  damage: string;
};

// ─── PRNG ─────────────────────────────────────────────────

function makePRNG(seed: string) {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 33) ^ seed.charCodeAt(i)) >>> 0;
  }
  let s = h >>> 0;
  return {
    float(): number {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 0x100000000;
    },
    next(min: number, max: number): number {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return Math.floor(min + (s / 0x100000000) * (max - min + 1));
    },
  };
}

// ─── Detección de encuentro ───────────────────────────────

/**
 * SYSTEMS.MD: "Ocurren si coinciden mismo piso, misma zona, mismo ciclo (día/noche)."
 * Probabilidad base 10% + noise del piso + densidad.
 */
export function checkForEncounter(
  floor: number,
  cycle: number,
  phase: 'DAY' | 'NIGHT',
  seedHash: string,
  rivals: RivalEntry[],
): EncounterResult {
  const rng = makePRNG(`${seedHash}_encounter_${floor}_${cycle}_${phase}`);

  // Rivales en el mismo piso (aproximado)
  const nearbyRivals = rivals.filter(r =>
    r.status === 'active' &&
    Math.abs(r.floor - floor) <= 2  // ±2 pisos = "zona cercana"
  );

  if (nearbyRivals.length === 0) return { type: 'none' };

  // SYSTEMS.MD fórmula: BaseEncounter(10%) + noiseLevel(0.2) + floorDensity(0.1)
  const baseChance = 0.10;
  const noiseBonus = nearbyRivals.length * 0.05;  // más rivales = más chance
  const floorBonus = Math.min(floor * 0.002, 0.15); // pisos altos = más concurrido
  const encounterChance = Math.min(baseChance + noiseBonus + floorBonus, 0.60);

  if (rng.float() > encounterChance) return { type: 'none' };

  // Seleccionar rival
  const rival = nearbyRivals[Math.floor(rng.float() * nearbyRivals.length)];

  // Verificar emboscada (requiere detectar al rival primero)
  const isAmbush = rng.float() < 0.20;  // 20% chance de emboscada

  return {
    type: 'encounter',
    rival,
    isAmbush,
    canNegotiate: true,  // siempre se puede intentar negociar
  };
}

// ─── Huida ────────────────────────────────────────────────

/**
 * SYSTEMS.MD: "Chequeo de habilidad (Atletismo / Sigilo). Riesgo de perder miembros."
 * El miembro más lento puede quedar atrás.
 */
export function attemptFlee(
  party: CharacterSave[],
  rivalPower: number,
  seedHash: string,
  roomId: string,
): FleeResult {
  const rng = makePRNG(`${seedHash}_flee_${roomId}`);
  const log: string[] = ['INTENTANDO HUIDA...'];

  // El mejor corredor del grupo hace el chequeo (DEX o STR)
  const bestRunner = party
    .filter(c => c.alive)
    .reduce((best, c) => {
      const score = Math.max(c.baseStats.DEX, c.baseStats.STR);
      const bestScore = Math.max(best.baseStats.DEX, best.baseStats.STR);
      return score > bestScore ? c : best;
    });

  const athleticsMod = Math.floor((bestRunner.baseStats.STR - 10) / 2);
  const stealthMod = Math.floor((bestRunner.baseStats.DEX - 10) / 2);
  const bestMod = Math.max(athleticsMod, stealthMod);
  const d20 = rng.next(1, 20);
  const roll = d20 + bestMod;

  // DC = 10 + escala del rival (aproximado)
  const fleedc = 10 + Math.floor(rivalPower / 20);

  log.push(`${bestRunner.name.toUpperCase()} chequeo huida: ${roll} vs DC ${fleedc}`);

  if (roll >= fleedc) {
    log.push('✓ HUIDA EXITOSA — El grupo escapó');
    return { success: true, log };
  }

  // Huida fallida — posible pérdida de miembro
  const memberLostChance = 0.30;
  if (rng.float() < memberLostChance) {
    const aliveMembers = party.filter(c => c.alive);
    const sacrificed = aliveMembers[rng.next(0, aliveMembers.length - 1)];
    log.push(`✗ HUIDA FALLIDA — ${sacrificed.name.toUpperCase()} quedó atrás`);
    return { success: false, log, memberLost: sacrificed.name };
  }

  log.push('✗ HUIDA FALLIDA — El combate continúa');
  return { success: false, log };
}

// ─── Negociación ──────────────────────────────────────────

/**
 * SYSTEMS.MD: "Ambas parties deciden intención: Combatir / Huir / Negociar."
 * La IA acepta según su perfil estratégico y el valor de la oferta.
 */
export function resolveNegotiation(
  offer: NegotiationOffer,
  rivalRep: number,    // reputación del rival (ver rivalGenerator.ts)
  playerBounty: number,
  seedHash: string,
  cycle: number,
): NegotiationResult {
  const rng = makePRNG(`${seedHash}_negotiate_${cycle}`);
  const log: string[] = ['INICIANDO NEGOCIACIÓN...'];

  // Base de aceptación según tipo de oferta
  let acceptanceBase: number;
  switch (offer.type) {
    case 'gold':
      // Más gold → más probable aceptar
      acceptanceBase = Math.min(0.9, (offer.amount ?? 0) / 500);
      break;
    case 'free_passage':
      acceptanceBase = 0.4;   // 40% base — muchas parties prefieren combatir
      break;
    case 'alliance':
      acceptanceBase = 0.25;  // alianzas son compromisos — raro aceptar de extraños
      break;
    default:
      acceptanceBase = 0;
  }

  // Penalización si el jugador tiene bounty alto
  const bountyPenalty = playerBounty * 0.1;
  // Bonus si el rival tiene reputación positiva (más diplomático)
  const repBonus = rivalRep > 50 ? 0.15 : 0;

  const finalChance = Math.max(0, Math.min(1, acceptanceBase - bountyPenalty + repBonus));
  const accepted = rng.float() <= finalChance;

  log.push(`Oferta: ${offer.type}${offer.amount ? ` (${offer.amount}G)` : ''}`);
  log.push(`Probabilidad aceptación: ${Math.round(finalChance * 100)}%`);
  log.push(accepted ? '✓ OFERTA ACEPTADA' : '✗ OFERTA RECHAZADA — COMBATE');

  return { accepted, log };
}

// ─── Power Score para combate abstracto ───────────────────

/**
 * SYSTEMS.MD: "PartyPower = Σ(CharacterLevel × StatMultiplier × EquipmentFactor)"
 * Simplificado: level × avgStat × 1.0 (sin equipo por ahora)
 */
export function calculatePartyPower(party: CharacterSave[]): number {
  return party
    .filter(c => c.alive)
    .reduce((total, c) => {
      const avgStat = (
        c.baseStats.STR + c.baseStats.DEX + c.baseStats.CON +
        c.baseStats.INT + c.baseStats.WIS + c.baseStats.CHA
      ) / 6;
      const statMult = avgStat / 10;  // normalizado: 1.0 = stats promedio
      const level = 1; // TODO: añadir level a CharacterSave en Sprint 5
      return total + (level * statMult * 1.0);
    }, 0);
}

/**
 * Estima el power score de una party IA basándose en piso y reputación.
 */
export function estimateRivalPower(rival: RivalEntry): number {
  return rival.floor * 1.2 + rival.rep * 0.01;
}
```

---

## Paso 3 — Actualizar BattleScreen para soportar PvP

```typescript
// src/screens/BattleScreen.tsx — Añadir selector de modo al inicio

const route = useRoute<RouteProp<RootStackParamList, 'Battle'>>();
const { roomId, roomType, encounterContext } = route.params;

const isPvP = encounterContext?.kind === 'pvp';

// En PvP: usar la party rival como "enemies"
const enemies = useMemo(() => {
  if (isPvP && encounterContext.kind === 'pvp') {
    return encounterContext.rivalParty;
  }
  return generateEnemiesForRoom(roomType, roomId, cycle, floor);
}, [isPvP, encounterContext, roomType, roomId, cycle, floor]);

// Mostrar botones de acción pre-combate (solo si hay encounterContext)
if (showPreCombatOptions) {
  return (
    <View>
      <Text>RIVAL DETECTADO: {encounterContext?.rivalName}</Text>
      {encounterContext?.isAmbush && (
        <Text style={{ color: '#FF3E3E' }}>⚠ EMBOSCADA — Pierden iniciativa</Text>
      )}
      <TouchableOpacity onPress={() => setShowPreCombatOptions(false)}>
        <Text>⚔ ATACAR</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleNegotiate}>
        <Text>🤝 NEGOCIAR</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleFlee}>
        <Text>🏃 HUIR</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## Paso 4 — Emboscada: bonus de iniciativa

```typescript
// src/services/combatEngine.ts — modificar resolveCombat para soportar emboscada

export function resolveCombat(
  party: CharacterSave[],
  enemies: MonsterStats[],
  roomId: string,
  killRecords: KillRecord[],
  options: { isAmbush?: boolean; ambushSide?: 'party' | 'enemy' } = {},
): CombatResult {
  // ...código existente...

  // Modificar iniciativa si hay emboscada
  const initiativeBonus = options.isAmbush ? 1000 : 0;  // Bono masivo para ganar siempre

  if (options.ambushSide === 'party') {
    // La party emboscó al rival — bonus de iniciativa + primer ataque gratis
    actorQueue.forEach(actor => {
      if (actor.team === 'party') actor.initiative += initiativeBonus;
    });
    log.push('⚡ EMBOSCADA — Tu party ataca primero con ventaja');
    // Primer ataque gratis (sin consumir turno)
    // resolvePartyTurn(...) aquí con ventaja en hit
  } else if (options.ambushSide === 'enemy') {
    // El rival emboscó al jugador
    actorQueue.forEach(actor => {
      if (actor.team === 'enemy') actor.initiative += initiativeBonus;
    });
    log.push('⚠ EMBOSCADA — El rival ataca primero');
  }
}
```

---

## Paso 5 — Detección de encuentro en MapScreen

```typescript
// src/screens/MapScreen.tsx — en handleNodePress, antes de navegar a Battle

import { checkForEncounter } from '../services/encounterService';

const handleNodePress = useCallback((room: DungeonRoom) => {
  // ...lógica existente de selección...

  if (isCombatRoom && !room.visited) {
    // Verificar si hay un encuentro con party rival antes de entrar
    const encounter = checkForEncounter(
      activeGame.floor,
      activeGame.cycle,
      activeGame.phase,
      activeGame.seedHash,
      rivals,
    );

    if (encounter.type === 'encounter') {
      // Navegar a Battle con contexto PvP
      navigation.navigate('Battle', {
        roomId: String(room.id),
        roomType: room.type,
        encounterContext: {
          kind: 'pvp',
          rivalName: encounter.rival.name,
          rivalParty: buildRivalCombatants(encounter.rival),
          isAmbush: encounter.isAmbush,
        },
      });
    } else {
      // Combate normal contra monstruos
      navigation.navigate('Battle', {
        roomId: String(room.id),
        roomType: room.type,
      });
    }
  }
}, [activeGame, rivals, navigation]);
```

---

## Checklist de implementación

- [ ] Actualizar `navigation/types.ts` con `EncounterContext` (Paso 1)
- [ ] Crear `src/services/encounterService.ts` (Paso 2)
- [ ] BattleScreen: pantalla pre-combate con Atacar/Negociar/Huir (Paso 3)
- [ ] `combatEngine.ts`: parámetro `options.isAmbush` (Paso 4)
- [ ] MapScreen: llamar `checkForEncounter` antes de navegar a Battle (Paso 5)
- [ ] Añadir i18n keys: `battle.preOptions`, `battle.negotiate`, `battle.flee`, `battle.ambush`
- [ ] ReportScreen: diferenciar victoria PvP (sin XP por SYSTEMS.MD, solo loot de inventario)
- [ ] Conectar `attemptFlee` a resultado de navegación (huida exitosa → volver al mapa)

---

## ACTUALIZACIÓN v2 — Campos requeridos por doc 13 (Sistema de Esencias)

### MonsterStats — añadir `monsterKey` y `enemyType`

```typescript
// src/services/combatEngine.ts — actualizar MonsterStats

export type MonsterStats = {
  // ...campos existentes...
  monsterKey: string;  // 'wolf' | 'fire_elemental' | 'young_red_dragon' | etc.
  enemyType: 'minor' | 'elite' | 'miniboss' | 'boss' | 'major_boss';
};

// Derivar enemyType desde el tipo de sala (usar PRNG de seed, no Math.random):
export function getEnemyTypeForRoom(roomType: RoomType, floor: number, rng: ReturnType<typeof makePRNG>): MonsterStats['enemyType'] {
  if (roomType === 'BOSS') return floor % 10 === 0 ? 'major_boss' : 'boss';
  if (roomType === 'ELITE') return rng.float() < 0.2 ? 'miniboss' : 'elite';
  return rng.float() < 0.3 ? 'elite' : 'minor';
}
```

### CombatResult — añadir `essenceDrops`

```typescript
// src/services/combatEngine.ts — actualizar CombatResult

export type CombatResult = {
  outcome: 'VICTORY' | 'DEFEAT';
  roundsElapsed: number;
  partyAfter: CombatPartyMember[];
  enemiesDefeated: CombatEnemy[];
  totalXp: number;
  goldEarned: number;
  damageDone: Record<string, number>;
  log: string[];
  events?: CombatEvent[];               // doc 10 — narrativo emocional
  essenceDrops?: CharacterEssence[];    // doc 13 — esencias obtenidas
};
```

### processEnemyDeath — llamar desde resolveCombat

```typescript
// Añadir al final del loop de combate, cuando hp de un enemigo llega a 0:
// (Ver implementación completa en doc 13 Paso 7)

import { resolveEssenceDrop } from './essenceService';
import { saveEssenceDrop, incrementMonsterKills } from '../database/essenceRepository';

function processEnemyDeath(enemy: MonsterStats, roomId, seedHash, cycle, floor, gameId, killerCharName) {
  incrementMonsterKills(gameId, killerCharName, enemy.monsterKey);
  const drop = resolveEssenceDrop(enemy.enemyType, enemy.monsterKey, roomId, seedHash, cycle);
  if (!drop) return null;
  return saveEssenceDrop(drop, gameId, seedHash, cycle, floor);
}
```

### Checklist adicional (v2)
- [ ] Añadir `monsterKey` y `enemyType` a todos los `MonsterStats` del generador de enemigos
- [ ] Actualizar `CombatResult` con campo `essenceDrops`
- [ ] Llamar `processEnemyDeath` al procesar cada muerte de enemigo
- [ ] `ReportScreen`: mostrar esencias obtenidas junto al loot normal
- [ ] Importar `makePRNG` desde `src/utils/prng.ts` — eliminar definición inline
