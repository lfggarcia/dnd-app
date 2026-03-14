# Code Review — Servicios, Stores y Base de Datos
**Review:** review-001 | **Fecha:** 2026-03-14  
**Archivos revisados:** 15 archivos críticos (combat, economy, progression, world simulation, database)

---

## [src/services/progressionService.ts]

### CR-001: `awardXP` double-counts pending level-ups → salto de nivel fantasma
**Severidad:** 🔴 Alta  
**Problema:** `pendingGained` se calcula como `newLevel - (char.level ?? 1)`, ignorando `char.pendingLevelUps` ya acumulados. Un personaje con `level=1, pendingLevelUps=1` que gana XP para nivel 3 obtiene `pendingGained = 3 - 1 = 2`, resultando en `pendingLevelUps = 3`. Al confirmar, salta de nivel 1 a nivel 4.

```typescript
// BUG:
const pendingGained = Math.max(0, newLevel - (char.level ?? 1));

// FIX:
const effectiveLevel = (char.level ?? 1) + (char.pendingLevelUps ?? 0);
const pendingGained = Math.max(0, newLevel - effectiveLevel);
```

---

## [src/services/combatEngine.ts]

### CR-002: `resolveEnemyTurn` busca objetivo por `name` — vulnerable a duplicados
**Severidad:** 🟡 Media  
**Problema:** `partyState.findIndex(p => p.name === targetMember.name)` — si dos miembros tienen el mismo nombre, siempre se ataca al primero, ignorando el pick aleatorio.

```typescript
// FIX: search by characterId (stable identity)
const targetInParty = partyState.findIndex(p => p.characterId === targetMember.characterId);
```

### CR-003: Monk ability marker `'LLUVIA_GOLPES'` ≠ log `'LLUVIA_DE_GOLPES'`
**Severidad:** 🟡 Media  
**Problema:** `buildCombatResultFromLive` tiene `'LLUVIA_GOLPES'` en `ABILITY_MARKERS` pero `resolvePlayerAbility` loguea `'LLUVIA_DE_GOLPES'`. Los eventos `ABILITY_USED` del monk nunca se generan en el resultado de combate.

```typescript
// FIX en buildCombatResultFromLive:
'LLUVIA_DE_GOLPES', // era 'LLUVIA_GOLPES'
```

### CR-004: `PROF_BONUS` hardcodeado como `2` — no escala con nivel (DnD 5e)
**Severidad:** 🟡 Media  
**Problema:** `const roll = d20 + atkMod + 2 /* PROF */` usa `2` en lugar del módulo constante. Personajes nivel 5+ deberían tener +3, nivel 9+ debería tener +4.

```typescript
// FIX (DnD 5e table):
const profBonus = Math.ceil(attacker.level / 4) + 1;
const roll = d20 + atkMod + profBonus + inspireBon;
```

### CR-005: `LOOT_TABLE` duplicada inline en `buildCombatResultFromLive`
**Severidad:** 🟢 Baja  
**Problema:** Tabla de loot redefinida localmente en lugar de importar `LOOT_TABLE`. Si se actualiza la tabla, combate live y simulado divergirán silenciosamente.

```typescript
// FIX: reusar constante existente
const loot = lootRoll > 0 ? LOOT_TABLE[rng.next(0, LOOT_TABLE.length - 1)] : null;
```

---

## [src/services/dungeonGraphService.ts]

### CR-007: `buildRoomTypePool` off-by-one — un ELITE room siempre queda como NORMAL
**Severidad:** 🟡 Media  
**Problema:** `buildRoomTypePool(roomCount - secretCount)` genera un pool de `variable` ítems pero `generateDungeonFloor` lo consume para `variable + 1` habitaciones. El último cuarto siempre cae en `typePool[typeIdx] ?? 'NORMAL'`.

```typescript
// FIX: añadir el ELITE garantizado al inicio del pool
const pool: RoomType[] = ['ELITE'];
for (let i = 0; i < variable; i++) { ... }
```

### CR-008: `applyExplorationState` usa `Array.includes` — O(n²)
**Severidad:** 🟢 Baja  

```typescript
// FIX: convertir a Set antes del map
const visitedSet = new Set(state.visitedRoomIds);
const revealedSet = new Set(state.revealedRoomIds);
const updatedRooms = floor.rooms.map(r => ({
  ...r,
  visited: visitedSet.has(r.id),
  revealed: revealedSet.has(r.id),
}));
```

---

## [src/services/worldSimulator.ts]

### CR-009: `simulateWorld` acumula SYSTEM parties sin límite — memory leak O(ciclos)
**Severidad:** 🔴 Alta  
**Problema:** Cada ciclo donde `activeCount < 3`, se hace `aiStates.push(...)` sin limpiar las parties derrotadas. Para `targetCycle=50`, `aiStates` puede acumular 50+ entradas. El loop interno se vuelve O(ciclos × partiesAcumuladas).

```typescript
// FIX: filtrar defeated parties antes/después de cada ciclo
aiStates = aiStates.filter(s => s.entry.status !== 'defeated');
```

### CR-010: `advanceToVillage` simula el mundo desde ciclo 0 en lugar de continuar
**Severidad:** 🔴 Alta  
**Problema:** En `gameStore.advanceToVillage`: `simulateWorld(activeGame.seedHash, newCycle, activeGame)` sin `fromCycle` — re-simula todos los ciclos pasados. Si el jugador va al village en ciclo 50, se re-ejecutan 50 ciclos completos.

```typescript
// FIX en gameStore.ts:
const simResult = await simulateWorld(
  activeGame.seedHash,
  newCycle as number,
  activeGame,
  (activeGame.cycle ?? 1) + 1, // continuar desde el ciclo actual
);
```

### CR-011: `decideAction` divide por cero si todos los weights son 0
**Severidad:** 🟡 Media  
**Problema:** Si el noise aleatorio empuja todos los pesos a ≤ 0, `total = 0`. `v / total = NaN` corrompe la memoria del AI silenciosamente.

```typescript
// FIX: guard antes de normalizar
const total = Object.values(adjusted).reduce((s, v) => s + v, 0);
if (total <= 0) return 'explore';
```

---

## [src/services/encounterService.ts]

### CR-012: `attemptFlee` es determinista por roomId — retry siempre falla igual
**Severidad:** 🟡 Media  
**Problema:** `makePRNG(\`${seedHash}_flee_${roomId}\`)` usa misma seed cada intento. Si el jugador falla y reintenta sin cambiar `roomId`, el resultado es idéntico.

```typescript
// FIX: incluir contador de intento en la seed
const rng = makePRNG(`${seedHash}_flee_${roomId}_${fleeAttempt}`);
```

---

## [src/services/moralSystem.ts]

### CR-013: `generateReplacementAdventurer` hereda `maxHp` incompatible con stats base
**Severidad:** 🟡 Media  
**Problema:** El reemplazo hereda `maxHp` calculado con la CON alta del abandonado, pero usa `baseStats` reseteadas a CON 10. Inconsistencia permanente en el sistema de HP.

```typescript
// FIX: recalcular maxHp con stats base del recruta
const conMod = 0; // CON 10
const hpPerLevel = Math.max(4, 5 + conMod); // = 5
const newMaxHp = 10 + (abandonedChar.level - 1) * hpPerLevel;
```

### CR-014: Lógica de abandonment invertida vs. DnD 5e alignment
**Severidad:** 🟡 Media  
**Problema:** `isGoodOrLawful(char.alignment)` son los que tienen `morale < threshold`. En DnD 5e, los Chaotic Evil desertan, los Lawful Good son los más leales.

```typescript
// FIX:
const atRisk = morale < ABANDON_THRESHOLD && !isGoodOrLawful(char.alignment ?? '');
```

---

## [src/database/gameRepository.ts]

### CR-015: `JSON.parse(party_data)` sin try-catch — crash si datos corruptos
**Severidad:** 🔴 Alta  
**Problema:** Único JSON en `rowToSavedGame` sin protección. Si `party_data` está corrupto, `getAllSavedGames()` lanza excepción no capturada en el hydrate del store → pantalla en blanco.

```typescript
// FIX:
partyData: (() => {
  try {
    const parsed = JSON.parse(row.party_data) as CharacterSave[];
    return parsed.map(c => c.characterId ? c : { ...c, characterId: generateId() });
  } catch {
    return [];
  }
})(),
```

### CR-016: `null as unknown as string` — TypeScript type hack en `updateSavedGame`
**Severidad:** 🟢 Baja  

```typescript
// FIX: cambiar tipo del array a nullable
const values: (string | number | null)[] = [];
values.push(updates.mapState ?? null); // sin cast
```

---

## [src/stores/gameStore.ts]

### CR-017: `advanceCycle` tiene race condition por doble-tap
**Severidad:** 🔴 Alta  
**Problema:** `advanceCycle` es async. Dos taps rápidos leen el mismo `cycleRaw`, calculan el mismo `newCycleRaw`, y ambos hacen `updateSavedGame`. El ciclo solo avanza 1 vez pero la simulación se ejecuta dos veces.

```typescript
// FIX: guard de loading al inicio
advanceCycle: async (action) => {
  const { activeGame, loading } = get();
  if (!activeGame || loading) return;
  set({ loading: true });
  try {
    // ...lógica existente...
  } finally {
    set({ loading: false });
  }
},
```

---

## Resumen

| ID | Archivo | Severidad |
|---|---|---|
| CR-001 | progressionService.ts | 🔴 Alta |
| CR-009 | worldSimulator.ts | 🔴 Alta |
| CR-010 | worldSimulator.ts/gameStore | 🔴 Alta |
| CR-015 | gameRepository.ts | 🔴 Alta |
| CR-017 | gameStore.ts | 🔴 Alta |
| CR-002 | combatEngine.ts | 🟡 Media |
| CR-003 | combatEngine.ts | 🟡 Media |
| CR-004 | combatEngine.ts | 🟡 Media |
| CR-007 | dungeonGraphService.ts | 🟡 Media |
| CR-011 | worldSimulator.ts | 🟡 Media |
| CR-012 | encounterService.ts | 🟡 Media |
| CR-013 | moralSystem.ts | 🟡 Media |
| CR-014 | moralSystem.ts | 🟡 Media |
| CR-005 | combatEngine.ts | 🟢 Baja |
| CR-006 | combatEngine.ts | 🟢 Baja |
| CR-008 | dungeonGraphService.ts | 🟢 Baja |
| CR-016 | gameRepository.ts | 🟢 Baja |
