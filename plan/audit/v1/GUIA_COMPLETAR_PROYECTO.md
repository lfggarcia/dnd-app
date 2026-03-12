# TORRE — Guía Completa de Implementación
> Basada en `plan/sprints/` · Versión 2.0 · 2026-03-11
> Estado del proyecto: Sprints 4C–6F completados. Sprint 6G parcial. Sprint 7 pendiente.

---

## ¿Cómo leer esta guía?

Cada bloque incluye:
- **Qué es y por qué existe** — contexto técnico para el equipo
- **Archivos involucrados** — qué tocar y qué crear
- **Pasos concretos** — en orden de dependencia
- **Checklist de verificación** — cómo saber que está hecho

Los bloques están ordenados por **dependencia real**, no por número de sprint. No saltar bloques.

---

## Regla de oro de integridad antes de empezar

| Nota | Regla |
|------|-------|
| NI-01 | `MAX_LEVEL_MVP = 10` en Sprint 6. Se sube a 20 en Sprint 7 con esencias. |
| NI-02 | El tipo `CharacterSave` canónico vive en `gameRepository.ts`. Añadir campos ahí siempre. |
| NI-03 | `makePRNG()` nunca se define inline. Siempre importar desde `src/utils/prng.ts`. |
| NI-04 | `AIProfile` tiene 5 valores: `AGGRESSIVE \| DEFENSIVE \| OPPORTUNISTIC \| EXPANSIONIST \| SURVIVALIST`. |
| NI-05 | `SAFE_ZONE_WAIT` en `timeService.ts` — el costo real lo calcula `safeZoneService`. |
| NI-06 | `CombatResult.essenceDrops` en doc 03 y doc 13 deben estar sincronizados. |

---

## Estado resumido de sprints

| Sprint | Estado |
|--------|--------|
| 4C — Narrativo emocional | ✅ Completo |
| 5A — PRNG centralizado | ⚠️ Casi — `dungeonGraphService.ts` aún define `makePRNG` inline (DT-01) |
| 5B — Sistema temporal | ⚠️ Bug crítico — `updateSavedGame` no persiste `cycleRaw`, `lastActionAt`, `lastSimEvents` |
| 5C — worldSimulator | ⚠️ Casi — motor listo, RT-04 abierto: no carga/persiste rivales en DB |
| 6A — Migraciones v7–v12 + CharacterSave | ✅ Completo |
| 6B — Economía + Loot | ✅ Completo |
| 6C — Progresión XP / niveles | ⚠️ Casi — falta `getInheritedLevel` en flujo SeedScreen/Unification |
| 6D — Moral + Bounty | ⚠️ Parcial — `checkForAbandonment()` no llamado; `recordPartyKill()` no llamado |
| 6E — Combate expandido + Safe Zones | ⚠️ Casi — falta tab INVENTORY en CampScreen |
| 6F — Alianzas | ✅ Completo |
| 6G — Seeds + Fin de temporada | 🔴 Parcial — pantallas creadas, pero `seedUnificationService.ts` no existe |
| Sprint 7 — IA Avanzada + Esencias | 🔴 Parcial — tipos definidos, pantallas creadas; faltan servicios, repo y migration v13 |

---

---

# CORRECCIONES CRÍTICAS (hacer ANTES de Sprint 7)

## [FIX-01] 🔴 `updateSavedGame` no persiste `cycleRaw`, `lastActionAt`, `lastSimEvents`

**Por qué es crítico:** `gameStore.advanceCycle()` llama a `updateSavedGame()` pasando `cycleRaw`, `lastActionAt` y `lastSimEvents`, pero el `Partial<Pick<>>` de esa función no incluye esos campos. El tiempo fraccionado, el timestamp y los eventos de simulación **nunca se guardan en DB**. Al reanudar el juego, `cycleRaw` vuelve al entero, perdiendo fracciones de ciclo.

**Archivo:** `src/database/gameRepository.ts`

**Paso FIX-01-A** — Ampliar la firma de `updateSavedGame`:

```typescript
export function updateSavedGame(
  id: string,
  updates: Partial<Pick<SavedGame,
    | 'partyData' | 'floor' | 'cycle' | 'cycleRaw'         // ← añadir cycleRaw
    | 'phase' | 'gold' | 'status' | 'location' | 'mapState'
    | 'partyPortrait' | 'portraitsJson' | 'expressionsJson'
    | 'inSafeZone' | 'safeZoneRoomId'
    | 'lastActionAt' | 'lastSimEvents'                      // ← añadir estos dos
  >>,
): void {
```

**Paso FIX-01-B** — Añadir los tres bloques `if` faltantes en el cuerpo:

```typescript
if (updates.cycleRaw !== undefined) {
  sets.push('cycle_raw = ?');
  values.push(updates.cycleRaw);
}
if (updates.lastActionAt !== undefined) {
  sets.push('last_action_at = ?');
  values.push(updates.lastActionAt ?? null as unknown as string);
}
if (updates.lastSimEvents !== undefined) {
  sets.push('last_sim_events = ?');
  values.push(updates.lastSimEvents ?? null as unknown as string);
}
```

**Checklist:**
- [ ] Al reiniciar la app y reanudar, `activeGame.cycleRaw` refleja el valor guardado
- [ ] `WorldLogScreen` muestra eventos del ciclo anterior al reanudar
- [ ] `cycle = Math.floor(cycleRaw)` siempre — nunca leer `cycle` directamente del campo

---

## [FIX-02] 🟠 DT-01: `dungeonGraphService.ts` define `makePRNG` inline

**Archivo:** `src/services/dungeonGraphService.ts`

**Paso FIX-02-A** — Borrar la función `makePRNG` local (~línea 70).

**Paso FIX-02-B** — Añadir al top del archivo:
```typescript
import { makePRNG } from '../utils/prng';
```

**Checklist:**
- [ ] `grep -r "function makePRNG" src/` retorna 0 resultados
- [ ] El dungeon graph sigue siendo determinístico (mismo seed → mismas salas)

---

## [FIX-03] 🟠 `checkForAbandonment()` no está integrado al game loop

**Por qué:** `moralSystem.ts` implementa el abandono correctamente, pero nunca se invoca. Los personajes con `morale < 20` y alineamiento bueno/legal nunca desertan.

**Archivo:** `src/screens/CampScreen.tsx`

En el handler `handleLongRest()`, después de restaurar HP y antes de navegar a CycleTransition:

```typescript
import { checkForAbandonment } from '../services/moralSystem';

const { abandoned, remained, log } = checkForAbandonment(
  healed,
  activeGame.seedHash,
  cycle,
);
if (abandoned.length > 0) {
  updateProgress({ partyData: remained });
  Alert.alert(
    lang === 'es' ? '⚠ Deserción' : '⚠ Desertion',
    log.join('\n'),
  );
} else {
  updateProgress({ partyData: healed });
}
```

**Checklist:**
- [ ] Un personaje con `morale < 20` y `alignment = 'Lawful Good'` puede desertar en descanso largo
- [ ] La party actualizada (sin el desertor) se persiste correctamente en DB

---

## [FIX-04] 🟠 `recordPartyKill()` no se llama al eliminar party IA

**Por qué:** `bountyService.recordPartyKill()` existe y persiste en DB, pero BattleScreen no lo invoca cuando la sala era de un rival (`roomId.startsWith('rival_')`).

**Archivo:** `src/screens/BattleScreen.tsx`

En el handler de victoria, después del bloque de awardXP:

```typescript
import { recordPartyKill } from '../services/bountyService';

if (roomId.startsWith('rival_') && activeGame) {
  const rivalName = roomId.replace('rival_', '');
  recordPartyKill(activeGame.id, activeGame.seedHash, rivalName, cycle, floor);
}
```

**Checklist:**
- [ ] Eliminar una party en `NegotiationScreen → Attack → Battle` genera bounty en GuildScreen
- [ ] El bounty sube de nivel al superar los umbrales de kills (1 → 3 → 5 → 8 → 12)

---

---

# SPRINT 6G — Seeds + Ciclo de Vida de Parties

> **Prerrequisito:** FIX-01 a FIX-04 completados
> **Doc de referencia:** `plan/sprints/12_SEED_Y_PARTIES.md`

## ¿Por qué existe este sistema?

Cuando el jugador escribe una seed existente, debe poder elegir entre continuar el mundo o crear una nueva party heredando el nivel. La `UnificationScreen` ya existe pero no llama a ningún servicio real — solo navega a `Party` sin implementar las reglas R1-R12 del doc 12.

## Paso 6G-01 — Crear `seedUnificationService.ts`

**Archivo nuevo:** `src/services/seedUnificationService.ts`

```typescript
import {
  getLatestGameBySeedHash,
  updateSavedGame,
  type SavedGame,
  type CharacterSave,
} from '../database/gameRepository';
import { getInheritedLevel } from './progressionService';

export type SeedStatus =
  | { type: 'NEW' }
  | { type: 'EXISTING'; previousGame: SavedGame; inheritedLevel: number; previousPartyNames: string[] };

/** R1-R2: Verifica si la seed ya tiene historial y calcula el nivel heredado */
export function checkSeedStatus(seedHash: string): SeedStatus {
  const previous = getLatestGameBySeedHash(seedHash);
  if (!previous) return { type: 'NEW' };
  const inheritedLevel = getInheritedLevel(previous.partyData);
  return {
    type: 'EXISTING',
    previousGame: previous,
    inheritedLevel,
    previousPartyNames: previous.partyData.map(c => c.name),
  };
}

/** R3-R4: Marca la party anterior como IA-inherited para que worldSimulator la tome */
export function markAsIAInherited(previousGameId: string): void {
  updateSavedGame(previousGameId, {
    status: 'active',
    // partyOrigin no está en updateSavedGame todavía — ver nota abajo
  });
}

/** R5: Aplica el nivel heredado a los personajes de la nueva party */
export function applyInheritedLevel(
  party: CharacterSave[],
  inheritedLevel: number,
): CharacterSave[] {
  return party.map(c => ({ ...c, level: Math.max(c.level, inheritedLevel) }));
}
```

**Nota:** Para que `markAsIAInherited` funcione completamente, `updateSavedGame` necesita aceptar `partyOrigin` en su Pick (añadir junto con FIX-01).

## Paso 6G-02 — Conectar `SeedScreen.tsx` a `checkSeedStatus()`

En el handler de confirmación de seed, después de la validación RT-08:

```typescript
import { checkSeedStatus } from '../services/seedUnificationService';

const status = checkSeedStatus(computedSeedHash);
if (status.type === 'EXISTING') {
  navigation.navigate('Unification', {
    previousPartyNames: status.previousPartyNames,
    inheritedLevel: status.inheritedLevel,
  });
} else {
  navigation.navigate('Party', { seed, seedHash: computedSeedHash });
}
```

## Paso 6G-03 — Conectar `UnificationScreen.tsx` a los servicios reales

En el handler `handleContinue()`, dentro del `Alert.alert` confirm, reemplazar la navegación actual:

```typescript
import { markAsIAInherited, applyInheritedLevel } from '../services/seedUnificationService';

onPress: () => {
  if (activeGame) markAsIAInherited(activeGame.id);
  endGame('completed');
  navigation.navigate('Party', {
    seed: activeGame?.seed ?? '',
    seedHash: activeGame?.seedHash ?? '',
    inheritedLevel: route.params.inheritedLevel,
  });
}
```

## Paso 6G-04 — Aplicar nivel heredado en `PartyScreen.tsx`

Leer `route.params.inheritedLevel` y, al confirmar la party, llamar `applyInheritedLevel(party, inheritedLevel)` antes de `startNewGame`.

## Paso 6G-05 — Añadir `seedUnificationService` al barrel

**Archivo:** `src/services/index.ts`
```typescript
export * from './seedUnificationService';
```

**Checklist:**
- [ ] Seed existente en SeedScreen → navega a UnificationScreen
- [ ] Seed nueva → navega directo a Party
- [ ] Nueva party arranca con `level = inheritedLevel`
- [ ] La party anterior aparece en worldSimulator como activa (IA-inherited)

---

---

# SPRINT 7 — IA Avanzada + Sistema de Esencias

> **Prerrequisito:** Sprint 6G completo
> **Doc de referencia:** `plan/sprints/09_IA_AVANZADA.md` + `plan/sprints/13_SISTEMA_ESENCIAS.md`

## Paso 7-01 — Migration v13: tablas `essences` y `monster_kills`

**Archivo:** `src/database/migrations.ts`  
Actualizar `CURRENT_VERSION = 13` y añadir:

```typescript
13: [
  `CREATE TABLE IF NOT EXISTS essences (
    id TEXT PRIMARY KEY,
    seed_hash TEXT NOT NULL,
    owner_game_id TEXT NOT NULL,
    owner_char_name TEXT NOT NULL,
    definition_id TEXT NOT NULL,
    rank INTEGER NOT NULL,
    evolution_level INTEGER NOT NULL DEFAULT 1,
    kills_on_type INTEGER NOT NULL DEFAULT 0,
    equipped INTEGER NOT NULL DEFAULT 0,
    obtained_cycle INTEGER NOT NULL,
    obtained_floor INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_essences_game ON essences(owner_game_id)`,
  `CREATE INDEX IF NOT EXISTS idx_essences_char ON essences(owner_char_name)`,

  `CREATE TABLE IF NOT EXISTS monster_kills (
    id TEXT PRIMARY KEY,
    seed_hash TEXT NOT NULL,
    game_id TEXT NOT NULL,
    char_name TEXT NOT NULL,
    monster_key TEXT NOT NULL,
    kill_count INTEGER NOT NULL DEFAULT 0,
    last_kill_cycle INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(game_id, char_name, monster_key)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_monster_kills_game ON monster_kills(game_id)`,
],
```

## Paso 7-02 — Crear `essenceRepository.ts`

**Archivo nuevo:** `src/database/essenceRepository.ts`

Implementar con `executeSync` y transacciones para escrituras múltiples:

```typescript
export function saveEssenceDrop(essence: EssenceSaveInput): void
// ID canónico: `${seedHash}_essence_${definitionId}_${cycle}_${floor}`
// Usar INSERT OR IGNORE — idempotente (RT-09)

export function getEssencesByChar(gameId: string, charName: string): SavedEssence[]
export function equipEssence(essenceId: string, charName: string, gameId: string): void
// Verificar slots disponibles: getEssenceSlots(char.level, char.isAscended)
export function unequipEssence(essenceId: string): void
export function incrementMonsterKills(gameId: string, charName: string, monsterKey: string, cycle: number): void
// INSERT OR REPLACE en monster_kills
export function getMonsterKills(gameId: string, charName: string, monsterKey: string): number
```

**Añadir al barrel:** `src/database/index.ts`
```typescript
export * from './essenceRepository';
```

## Paso 7-03 — Crear `aiProfileEngine.ts`

**Archivo nuevo:** `src/services/aiProfileEngine.ts`

Extraer de `worldSimulator.ts` la lógica de perfiles y enriquecerla con memoria:

```typescript
import { makePRNG } from '../utils/prng';
import type { AIMemoryState } from './aiMemoryService';

export type AIProfile = 'AGGRESSIVE' | 'DEFENSIVE' | 'OPPORTUNISTIC' | 'EXPANSIONIST' | 'SURVIVALIST';
export type AIAction = 'explore' | 'fightMonster' | 'huntParty' | 'avoidCombat' | 'rest' | 'advanceFloor';

/** Perfil base derivado del nombre (seed-based, sin memoria) */
export function deriveBaseProfile(partyName: string, seedHash: string): AIProfile

/** Pesos de acción modulados por memoria acumulada */
export function getActionWeights(
  profile: AIProfile,
  memory: AIMemoryState | null,
): Record<AIAction, number>

/**
 * Mutación cultural: cada MUTATION_INTERVAL ciclos, la party puede
 * adoptar el perfil de una vecina con mejor fitness score.
 */
export function maybeMutateProfile(
  profile: AIProfile,
  memory: AIMemoryState,
  cycle: number,
  seedHash: string,
  neighborProfiles: AIProfile[],
): AIProfile
```

## Paso 7-04 — Crear `culturalEvolution.ts`

**Archivo nuevo:** `src/services/culturalEvolution.ts`

```typescript
import type { AIMemoryState } from './aiMemoryService';
import type { AIProfile } from './aiProfileEngine';

/**
 * Evolutionary Game Theory simplificada.
 * "Las parties vecinas se observan y copian estrategias exitosas."
 */
export function calculateFitnessScore(memory: AIMemoryState): number
// FitnessScore = (wins × 2 - losses × 1.5 + gold × 0.01) / max(1, totalCombats)

export function selectBestNeighborProfile(
  neighborMemories: AIMemoryState[],
  neighborProfiles: AIProfile[],
): AIProfile | null
// Devuelve el perfil del vecino con mayor fitnessScore, null si ninguno supera al actual
```

## Paso 7-05 — Actualizar `worldSimulator.ts` para usar `aiProfileEngine`

**Archivo:** `src/services/worldSimulator.ts`

1. Eliminar las funciones `deriveProfile()` y `getProfileWeights()` locales
2. Importar desde `aiProfileEngine`
3. Mantener un `Map<string, AIMemoryState>` durante la simulación por lote
4. Llamar `recordDecision()` y `recordCombat()` de `aiMemoryService` cada ciclo
5. Cada `MUTATION_INTERVAL` ciclos, llamar `maybeMutateProfile()`

**Benchmark obligatorio antes de merge:** `simulateWorld(60 ciclos, 10 parties)` < 200ms con memoria activa.

## Paso 7-06 — Cablear drops de esencia en `BattleScreen.tsx`

**Archivo:** `src/screens/BattleScreen.tsx`

Primero añadir `monsterKey?: string` a `CombatResult` en `combatEngine.ts` (NI-06). Después, en el handler de victoria:

```typescript
import { resolveEssenceDrop } from '../services/essenceService';
import { saveEssenceDrop, incrementMonsterKills, getMonsterKills } from '../database/essenceRepository';

if (activeGame && combatResult.monsterKey) {
  for (const aliveChar of updatedParty.filter(c => c.alive)) {
    incrementMonsterKills(activeGame.id, aliveChar.name, combatResult.monsterKey, cycle);
    const kills = getMonsterKills(activeGame.id, aliveChar.name, combatResult.monsterKey);
    const drop = resolveEssenceDrop(
      combatResult.monsterKey, kills, floor, cycle, activeGame.seedHash,
    );
    if (drop) {
      saveEssenceDrop({
        ...drop,
        ownerGameId: activeGame.id,
        ownerCharName: aliveChar.name,
        obtainedCycle: cycle,
        obtainedFloor: floor,
      });
    }
  }
}
```

## Paso 7-07 — Añadir tab ESENCIAS a `CharacterDetailScreen.tsx`

```typescript
const [activeTab, setActiveTab] = useState<'STATS' | 'EQUIPO' | 'ESENCIAS'>('STATS');
```

En el tab ESENCIAS, renderizar:
- Slots disponibles: `getEssenceSlots(char.level, char.isAscended)` de `essenceService`
- Lista de esencias del personaje: `getEssencesByChar(activeGameId, char.name)`
- Botón equipar/desequipar respetando el límite de slots

## Paso 7-08 — Añadir servicios nuevos al barrel

**Archivo:** `src/services/index.ts`
```typescript
export * from './aiProfileEngine';
export * from './culturalEvolution';
```

**Checklist Sprint 7:**
- [ ] Migration v13 ejecuta sin error desde DB limpia y desde v12 existente
- [ ] Drop de esencia en boss → aparece en CharacterDetailScreen tab ESENCIAS
- [ ] No hay esencias duplicadas (mismo ID → `INSERT OR IGNORE` silencioso)
- [ ] Tasa drop legendaria ≤ 2% (verificar en `essenceService.resolveEssenceDrop`)
- [ ] AscensionScreen muestra 3 paths con requisitos correctos (morale, bountyLevel, epicEssences)
- [ ] Benchmark worldSimulator v2 con memoria: < 200ms en 60 ciclos × 10 parties
- [ ] `aiProfileEngine` exportado en barrel de services
- [ ] `essenceRepository` exportado en barrel de database

---

## Reglas de código (todos los sprints)

| Regla | Verificación |
|-------|-------------|
| PRNG | `grep -r "function makePRNG" src/` → 0 resultados |
| CharacterSave | Un solo `type CharacterSave` en `gameRepository.ts` |
| DB writes múltiples | Siempre dentro de `BEGIN TRANSACTION / COMMIT / ROLLBACK` |
| Barrel | Cada servicio nuevo → añadir a `services/index.ts` |
| Level cap | `MAX_LEVEL_MVP = 10` Sprint 6; `MAX_LEVEL_FULL = 20` Sprint 7 |
| Selectores Zustand | `s => s.activeGame?.field` — nunca `s => s.activeGame` entero |
| Dev logs | `if (__DEV__) console.log(...)` — nunca en producción |

---

## Pre-launch checklist final

- [ ] Migrations v7–v13 pasan desde DB limpia y desde v12
- [ ] `grep -r "function makePRNG" src/` → 0 resultados
- [ ] `updateSavedGame` persiste `cycleRaw`, `lastActionAt`, `lastSimEvents`
- [ ] Benchmark worldSimulator < 100ms base, < 200ms con memoria IA
- [ ] Colisión PRNG: `makePRNG('A').float() !== makePRNG('B').float()`
- [ ] Boss loot no se duplica en run consecutivo mismo seed
- [ ] Revive descuenta gold real (no puede revivir si `gold < cost`)
- [ ] `NarrativeMomentPanel` máximo 3 por combate
- [ ] Tasa drop esencia legendaria ≤ 2%
- [ ] worldSimulator salta parties con `status === 'defeated'`
- [ ] `checkForAbandonment()` se invoca en descanso largo (CampScreen)
- [ ] `recordPartyKill()` se invoca al eliminar party rival en BattleScreen
- [ ] Seed existente → UnificationScreen → nivel heredado aplicado a nueva party
