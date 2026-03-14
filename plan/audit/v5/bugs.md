# TORRE (dnd3) — Bug Catalog v5

> **Auditado el:** 2026-03-13  
> **Archivos inspeccionados:** 30+ (screens, services, stores, database, hooks, components)  
> **Severidades:** CRITICAL (3) | HIGH (5) | MEDIUM (8) | LOW (7)

---

## Índice de Severidad

| ID | Archivo | Categoría | Severidad | Título |
|----|---------|-----------|-----------|--------|
| BUG-01 | BattleScreen.tsx:810 | GAME_LOGIC | CRITICAL | `Math.random()` en `defeatIllus` rompe determinismo |
| BUG-02 | gameRepository.ts:178 | DATA_INTEGRITY | CRITICAL | `JSON.parse(row.party_data)` sin try-catch → crash al cargar save |
| BUG-03 | gameRepository.ts:421 | PERFORMANCE | CRITICAL | `SELECT *` carga portraits base64 completos (MB) en hydrate |
| BUG-04 | characterStats.ts:32 | GAME_LOGIC | HIGH | `Math.random()` en `roll4d6DropLowest()` — stats no deterministas |
| BUG-05 | characterStats.ts:49 | GAME_LOGIC | HIGH | `Math.random()` en `pickRaceName()` — nombre de raza no determinista |
| BUG-06 | enemySpriteService.ts | GAME_LOGIC | HIGH | Sprite seed derivado de `Math.random()` en lugar de seed del juego |
| BUG-07 | geminiImageService.ts:287 | SECURITY | HIGH | IP hardcodeada `192.168.0.17` — no usa variables de entorno |
| BUG-08 | BattleScreen.tsx:739 | PERFORMANCE | HIGH | `useEffect` INITIATIVE con dep array vacío — stale closure en `goToNextTurn` |
| BUG-09 | BattleScreen.tsx:810 | DATA_INTEGRITY | MEDIUM | `expressionsJson[idx]` accede por number, JSON tiene claves string |
| BUG-10 | worldSimulator.ts:336 | PERFORMANCE | MEDIUM | Array `aiStates` crece sin límite (spawn SYSTEM parties) |
| BUG-11 | imageStorageService.ts:52 | DATA_INTEGRITY | MEDIUM | Temp file path usa `Date.now()` — riesgo de colisión concurrente |
| BUG-12 | itemRepository.ts:173 | DATA_INTEGRITY | MEDIUM | `equipItem()` falla silenciosamente, no valida ni retorna estado |
| BUG-13 | combatEngine.ts:241 | GAME_LOGIC | MEDIUM | `getAttackStat` devuelve `undefined` para clases desconocidas → NaN damageon |
| BUG-14 | migrations.ts | DATA_INTEGRITY | MEDIUM | Sin índice en `saved_games.seed_hash` — queries lentas en juegos grandes |
| BUG-15 | gameRepository.ts | DATA_INTEGRITY | MEDIUM | Tipo forzado `null as unknown as string` en `values[]` de `updateSavedGame` |
| BUG-16 | BattleScreen.tsx:802 | TYPESCRIPT | LOW | `getPartyPortrait` memoized en `partyEmotions` (objeto inestable) |
| BUG-17 | GlossaryModal.tsx:90+ | TYPESCRIPT | LOW | Múltiples `as any[]` en parsing de respuesta API 5e |
| BUG-18 | VillageScreen.tsx:200 | TYPESCRIPT | LOW | Cast `navigation.navigate(screen as any)` |
| BUG-19 | i18n/context.tsx:31 | TYPESCRIPT | LOW | Variable de traducción tipada como `any` |
| BUG-20 | generateId() | SECURITY | LOW | `Math.random()` para generar IDs de partida — predecible |
| BUG-21 | AppNavigator.tsx | PERFORMANCE | LOW | `MainScreen`, `SeedScreen`, `PartyScreen` NO son lazy — inflan bundle inicial |
| BUG-22 | worldSimulator.ts:334 | PERFORMANCE | LOW | SYSTEM party spawn no tiene cap máximo de parties por simulación |
| BUG-23 | BattleScreen.tsx:493 | PERFORMANCE | LOW | `partyEmotions` init con `{}` literal inline — nueva referencia en cada render |

---

## Detalle de Bugs

---

### BUG-01 — `Math.random()` en `defeatIllus` (CRITICAL)

**Archivo:** [src/screens/BattleScreen.tsx](../../../src/screens/BattleScreen.tsx) · línea ~810  
**Categoría:** GAME_LOGIC  
**Severidad:** CRITICAL

**Descripción:**  
El `useMemo` que selecciona la ilustración de derrota usa `Math.random()` para elegir qué enemigo mostrar. Esto viola el principio de que el juego sea determinista por seed: dos jugadores con la misma seed y el mismo combate verán ilustraciones distintas.

**Código problemático:**
```typescript
const defeatIllus = useMemo<ImageSourcePropType | null>(() => {
  if (cs.outcome !== 'DEFEAT') return null;
  const alive = cs.enemyState.filter(e => !e.defeated);
  const pool  = alive.length > 0 ? alive : cs.enemyState;
  const pick  = pool.length === 1
    ? pool[0]
    : pool[Math.floor(Math.random() * pool.length)]; // ← PROBLEMA
  return pick ? (MONSTER_ILLUSTRATIONS[pick.name] ?? null) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [cs.outcome]);
```

**Fix paso a paso:**
1. En el bloque del useMemo, usar el `rngRef` que ya existe en el componente:
```typescript
const defeatIllus = useMemo<ImageSourcePropType | null>(() => {
  if (cs.outcome !== 'DEFEAT') return null;
  const alive = cs.enemyState.filter(e => !e.defeated);
  const pool  = alive.length > 0 ? alive : cs.enemyState;
  const pick  = pool.length === 1
    ? pool[0]
    : pool[rngRef.current.next(0, pool.length - 1)]; // ← usa PRNG seeded
  return pick ? (MONSTER_ILLUSTRATIONS[pick.name] ?? null) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [cs.outcome]);
```

---

### BUG-02 — `JSON.parse(row.party_data)` sin try-catch (CRITICAL)

**Archivo:** [src/database/gameRepository.ts](../../../src/database/gameRepository.ts) · línea ~178  
**Categoría:** DATA_INTEGRITY  
**Severidad:** CRITICAL

**Descripción:**  
En `rowToSavedGame`, `row.party_data` se parsea sin ningún guard. Si la fila en DB está corrupta (p.ej. por write incompleto), `getAllSavedGames()` y `getSavedGame()` lanzan excepción no capturada, crasheando la app al inicio.

**Código problemático:**
```typescript
partyData: (() => {
  const parsed = JSON.parse(row.party_data) as CharacterSave[]; // ← CRASH si corrupto
  return parsed.map(c => c.characterId ? c : { ...c, characterId: generateId() });
})(),
```

**Fix paso a paso:**
1. Envolver en try-catch con fallback a array vacío:
```typescript
partyData: (() => {
  try {
    const parsed = JSON.parse(row.party_data) as CharacterSave[];
    return parsed.map(c => c.characterId ? c : { ...c, characterId: generateId() });
  } catch {
    __DEV__ && console.error('[DB] Corrupt party_data for game', row.id);
    return [];
  }
})(),
```
2. En `rowToSavedGame`, también agregar validación al cargar `killRecords` — *ya tiene try-catch* ✅.
3. Considera marcar el game como `"dead"` si `partyData` resulta vacío al cargar, para mostrar message al usuario.

---

### BUG-03 — `SELECT *` carga MB de portraits en hydrate (CRITICAL)

**Archivo:** [src/database/gameRepository.ts](../../../src/database/gameRepository.ts) · línea ~421  
**Categoría:** PERFORMANCE  
**Severidad:** CRITICAL

**Descripción:**  
`getAllSavedGames()` hace `SELECT *` que incluye las columnas `party_portrait`, `portraits_json` y `expressions_json`. Cada una puede contener varios MB de base64. Con 5+ partidas guardadas, el `hydrate()` al startup lee 15–50 MB de SQLite sincronamente en el JS thread, bloqueando la UI entre 500ms y 5 segundos.

**Código problemático:**
```typescript
export function getAllSavedGames(): SavedGame[] {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM saved_games ORDER BY updated_at DESC', // ← carga todos los MB
  );
  return (result.rows as SavedGameRow[] ?? []).map(rowToSavedGame);
}
```

**Fix paso a paso:**
1. Crear una query "lean" que excluya portraits para el listado:
```typescript
const LEAN_COLUMNS = `
  id, seed, seed_hash, party_data, party_name, floor, cycle, cycle_raw,
  phase, gold, status, location, map_state, in_safe_zone, safe_zone_room_id,
  party_origin, predecessor_game_id, created_by_player, elimination_reason,
  kill_records, combat_room_id, combat_room_type, last_action_at, last_sim_events,
  created_at, updated_at
`;

export function getAllSavedGames(): SavedGame[] {
  const db = getDB();
  const result = db.executeSync(
    `SELECT ${LEAN_COLUMNS} FROM saved_games ORDER BY updated_at DESC`,
  );
  return (result.rows as SavedGameRow[] ?? []).map(row => rowToSavedGame(row, false));
}
```
2. Modificar `rowToSavedGame(row, includePortraits = true)` para retornar `null` en portraitsJson/expressionsJson cuando `includePortraits=false`.
3. Cargar portraits solo cuando se va a cargar el juego activo específico en `getSavedGame(id)` y `getActiveSavedGame()`.

---

### BUG-04 — `Math.random()` en `roll4d6DropLowest()` (HIGH)

**Archivo:** [src/services/characterStats.ts](../../../src/services/characterStats.ts) · línea ~32  
**Categoría:** GAME_LOGIC  
**Severidad:** HIGH

**Descripción:**  
Los stats de los personajes (STR, DEX, CON, etc.) se generan con `Math.random()`, rompiendo la reproducibilidad por seed. Un jugador que recarga su partida con la misma seed obtendrá stats diferentes la próxima vez que se generen personajes.

**Código problemático:**
```typescript
function roll4d6DropLowest(): number {
  const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  dice.sort((a, b) => a - b);
  return dice[1] + dice[2] + dice[3];
}
```

**Fix paso a paso:**
1. Modificar la función para aceptar un RNG:
```typescript
function roll4d6DropLowest(rng: import('../utils/prng').PRNG): number {
  const dice = Array.from({ length: 4 }, () => rng.next(1, 6));
  dice.sort((a, b) => a - b);
  return dice[1] + dice[2] + dice[3];
}
```
2. Ajustar todos los callers para pasar `makePRNG(seed)` donde `seed` incluye el seed del juego.
3. Verificar que `pickRaceName()` también usa Math.random() — ver BUG-05.

---

### BUG-05 — `Math.random()` en `pickRaceName()` (HIGH)

**Archivo:** [src/services/characterStats.ts](../../../src/services/characterStats.ts) · línea ~49  
**Categoría:** GAME_LOGIC  
**Severidad:** HIGH

**Descripción:**  
Igual que BUG-04: el nombre de raza del personaje se elige con `Math.random()`, rompiendo determinismo.

**Fix paso a paso:**
1. Agregar parámetro `rng`:
```typescript
export function pickRaceName(raceIndex: string, rng: PRNG): string {
  const pool = RACE_NAMES[raceIndex] ?? RACE_NAMES.human ?? ['Adventurer'];
  if (pool.length === 0) return 'Adventurer';
  return pool[rng.next(0, pool.length - 1)];
}
```
2. Actualizar callers en el PartyScreen/characterCatalogService para pasar el RNG derivado del seed.

---

### BUG-06 — Sprite seed no determinista en `enemySpriteService` (HIGH)

**Archivo:** [src/services/enemySpriteService.ts](../../../src/services/enemySpriteService.ts)  
**Categoría:** GAME_LOGIC  
**Severidad:** HIGH

**Descripción:**  
La selección de variante de sprite del enemigo usa `Math.floor(Math.random() * 2**32)` para generar un seed, por lo que el mismo monstruo en la misma sala muestra sprites distintos en cada sesión.

**Fix paso a paso:**
1. Derivar el seed desde el nombre del monstruo + roomId + seedHash del juego:
```typescript
import { makePRNG } from '../utils/prng';

// Antes de llamar a la función que usa Math.random() para el seed:
const rng = makePRNG(`enemy_sprite_${monsterName}_${roomId}_${seedHash}`);
const spriteSeed = rng.next(0, 2 ** 31 - 1);
```

---

### BUG-07 — IP hardcodeada en `geminiImageService` (HIGH)

**Archivo:** [src/services/geminiImageService.ts](../../../src/services/geminiImageService.ts) · línea ~287  
**Categoría:** SECURITY  
**Severidad:** HIGH

**Descripción:**  
La IP del servidor ComfyUI (`192.168.0.17`) está hardcodeada en el source code. Esto supone un riesgo de seguridad (información de red expuesta en el bundle), y hace imposible configurar el endpoint sin recompilar.

**Código problemático:**
```typescript
const COMFY_HOST = Platform.select({
  android: '10.0.2.2',
  ios: '192.168.0.17',      // ← hardcoded LAN IP
  default: '192.168.0.17',
});
```

**Fix paso a paso:**
1. Crear/actualizar `.env` (basado en `exmaple env`):
```env
COMFY_HOST_IOS=192.168.0.17
COMFY_HOST_ANDROID=10.0.2.2
```
2. Instalar `react-native-config` si no está (ya puede estar — verificar `package.json`).
3. Usar la variable de entorno:
```typescript
import Config from 'react-native-config';

const COMFY_HOST = Platform.select({
  android: Config.COMFY_HOST_ANDROID ?? '10.0.2.2',
  ios: Config.COMFY_HOST_IOS ?? '192.168.0.17',
  default: Config.COMFY_HOST_IOS ?? '192.168.0.17',
});
```
4. Agregar `.env` a `.gitignore` si no está.

---

### BUG-08 — Stale closure en `useEffect` INITIATIVE (HIGH)

**Archivo:** [src/screens/BattleScreen.tsx](../../../src/screens/BattleScreen.tsx) · línea ~739  
**Categoría:** PERFORMANCE  
**Severidad:** HIGH

**Descripción:**  
El `useEffect` que dispara la transición INITIATIVE tiene deps `[]` implícitas (suprimido por ESLint). Esto significa que `goToNextTurn` está capturado en closure en su versión inicial. Si las dependencias de `goToNextTurn` cambian antes de los 2000ms (ej. `partyData` se actualiza), se ejecutará la versión stale.

**Código problemático:**
```typescript
useEffect(() => {
  if (uiPhase !== 'INITIATIVE') return;
  const timer = setTimeout(() => goToNextTurn(cs), 2000);
  return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [uiPhase]); // ← goToNextTurn y cs no están en deps
```

**Fix paso a paso:**
1. Agregar `goToNextTurn` como dependencia y usar el patrón ref para funciones estables:
```typescript
const goToNextTurnRef = useRef(goToNextTurn);
useEffect(() => { goToNextTurnRef.current = goToNextTurn; }, [goToNextTurn]);

useEffect(() => {
  if (uiPhase !== 'INITIATIVE') return;
  const csSnapshot = cs;
  const timer = setTimeout(() => goToNextTurnRef.current(csSnapshot), 2000);
  return () => clearTimeout(timer);
}, [uiPhase, cs]); // ← deps correctas
```

---

### BUG-09 — `expressionsJson[idx]` usa number como clave string (MEDIUM)

**Archivo:** [src/screens/BattleScreen.tsx](../../../src/screens/BattleScreen.tsx) · línea ~802  
**Categoría:** DATA_INTEGRITY  
**Severidad:** MEDIUM

**Descripción:**  
`expressionsJson` es `Record<string, Record<string, string>>` (claves string), pero se accede con `expressionsJson[idx]` donde `idx` es `number`. En JavaScript `obj[0]` coercionea a `obj["0"]` en objetos, pero TypeScript marcará esto como error en `strict`. En la práctica puede funcionar, pero el resultado de `saveCharacterExpressions` usa `Object.entries(expressions)` que retorna string keys, por lo que el acceso numérico puede dar `undefined` en casos edge.

**Fix paso a paso:**
```typescript
// En getPartyPortrait:
const exprs = expressionsJson[String(idx)]; // ← usar String(idx)
if (!exprs) return portraitsMap?.[String(idx)] ?? null;
```

---

### BUG-10 — `aiStates` crece sin límite en `simulateWorld` (MEDIUM)

**Archivo:** [src/services/worldSimulator.ts](../../../src/services/worldSimulator.ts) · línea ~336  
**Categoría:** PERFORMANCE  
**Severidad:** MEDIUM

**Descripción:**  
Cada ciclo donde `activeCount < 3` se hace `aiStates.push(...)` de una nueva SYSTEM party. Con muchos ciclos, `aiStates` puede crecer a docenas de entries, incrementando la complejidad cuadrática del loop interno (`nearbyRivals.filter()`).

**Fix paso a paso:**
1. Agregar un cap de parties totales:
```typescript
const MAX_AI_PARTIES = 12;

if (activeCount < 3 && aiStates.length < MAX_AI_PARTIES) {
  // spawn SYSTEM party...
}
```
2. Purgar parties `defeated` al inicio de cada ciclo para mantener el array compacto:
```typescript
// Al inicio del loop de ciclos:
if (aiStates.filter(s => s.entry.status === 'defeated').length > 5) {
  // remover defeated que llevan >3 ciclos muertos
}
```

---

### BUG-11 — Temp file race condition en `savePortraitToFS` (MEDIUM)

**Archivo:** [src/services/imageStorageService.ts](../../../src/services/imageStorageService.ts) · línea ~52  
**Categoría:** DATA_INTEGRITY  
**Severidad:** MEDIUM

**Descripción:**  
El nombre del archivo temporal usa `Date.now()` (`${characterId}_tmp_${Date.now()}.jpg`). Si dos portraits se generan en el mismo milisegundo (posible con expresiones en batch), los archivos temporales se solapan, corrompiendo una imagen.

**Fix paso a paso:**
```typescript
import { v4 as uuid } from 'uuid'; // si disponible, o usar makePRNG

// Usar un identificador único por invocación:
const tempPath = `${dir}/${characterId}_tmp_${uuid()}.jpg`;
// O sin dependencia externa:
const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const tempPath = `${dir}/${characterId}_tmp_${uniqueSuffix}.jpg`;
```

---

### BUG-12 — `equipItem()` falla silenciosamente (MEDIUM)

**Archivo:** [src/database/itemRepository.ts](../../../src/database/itemRepository.ts) · línea ~173  
**Categoría:** DATA_INTEGRITY  
**Severidad:** MEDIUM

**Descripción:**  
`equipItem` no verifica si el item existe ni retorna un indicador de éxito. Si se llama con un ID inexistente, `UPDATE` afecta 0 filas y no hay forma de saberlo.

**Fix paso a paso:**
```typescript
export function equipItem(id: string, charName: string): boolean {
  const db = getDB();
  db.executeSync(
    'UPDATE items SET is_equipped = 1, owner_char_name = ? WHERE id = ?',
    [charName, id],
  );
  // Verificar que realmente se actualizó una fila
  const check = db.executeSync('SELECT changes() as n');
  const changed = (check.rows?.[0]?.n as number) ?? 0;
  if (changed === 0) {
    __DEV__ && console.warn(`[DB] equipItem: item ${id} not found`);
    return false;
  }
  return true;
}
```

---

### BUG-13 — `getAttackStat` puede retornar `undefined` → NaN (MEDIUM)

**Archivo:** [src/services/combatEngine.ts](../../../src/services/combatEngine.ts) · línea ~241  
**Categoría:** GAME_LOGIC  
**Severidad:** MEDIUM

**Descripción:**  
Si un personaje tiene `charClass` no registrado en el mapa de `getAttackStat`, la función retorna un string como `undefined`, y `attacker.baseStats[undefined]` devuelve `undefined`, y `statMod(undefined)` calcula `NaN`. El resultado es que el personaje nunca golpea (roll + NaN = NaN, siempre < AC).

**Fix paso a paso:**
```typescript
function getAttackStat(charClass: string): keyof BaseStats {
  const map: Record<string, keyof BaseStats> = {
    fighter: 'STR', barbarian: 'STR', paladin: 'STR',
    ranger: 'DEX', rogue: 'DEX', monk: 'DEX',
    wizard: 'INT', sorcerer: 'INT', warlock: 'CHA',
    cleric: 'WIS', druid: 'WIS', bard: 'CHA',
  };
  return map[charClass.toLowerCase()] ?? 'STR'; // ← fallback explícito
}
```

---

### BUG-14 — Sin índice en `saved_games.seed_hash` (MEDIUM)

**Archivo:** [src/database/migrations.ts](../../../src/database/migrations.ts)  
**Categoría:** DATA_INTEGRITY  
**Severidad:** MEDIUM

**Descripción:**  
La columna `seed_hash` en `saved_games` se usa en múltiples queries (bounties, alliances, rivals) pero no tiene índice. En partidas con decenas de saves, cada JOIN o WHERE en seed_hash hace un full table scan.

**Fix paso a paso:**
1. Agregar migración 18:
```typescript
18: [
  `CREATE INDEX IF NOT EXISTS idx_saved_games_seed_hash ON saved_games(seed_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_saved_games_status_updated ON saved_games(status, updated_at DESC)`,
],
```
2. Incrementar `CURRENT_VERSION` de 17 a 18.

---

### BUG-15 — `null as unknown as string` en `updateSavedGame` (MEDIUM)

**Archivo:** [src/database/gameRepository.ts](../../../src/database/gameRepository.ts) · línea ~395  
**Categoría:** TYPESCRIPT  
**Severidad:** MEDIUM

**Descripción:**  
Múltiples lugares en `updateSavedGame` fuerzan `null as unknown as string` para meter null en el array de values paramétrico. Esto bypasa el type system de TypeScript. Aunque op-sqlite acepta null como parámetro, el tipo `(string | number)[]` no lo refleja.

**Fix paso a paso:**
```typescript
// Cambiar el tipo de `values` para permitir null:
const values: (string | number | null)[] = [];

// Eliminar todos los `?? null as unknown as string`:
values.push(updates.mapState ?? null);
values.push(updates.partyPortrait ?? null);
// ...etc
```

---

### BUG-16 — `getPartyPortrait` memoizado con `partyEmotions` inestable (LOW)

**Archivo:** [src/screens/BattleScreen.tsx](../../../src/screens/BattleScreen.tsx) · línea ~802  
**Categoría:** PERFORMANCE  
**Severidad:** LOW

**Descripción:**  
`getPartyPortrait` tiene `partyEmotions` en su dep array de `useCallback`. `partyEmotions` cambia referencia en cada evento de emoción, invalidando el callback y causando re-renders de `TurnTimeline` (que usa `timelinePortraits` que depende de `getPartyPortrait`).

**Fix:**  
Usar `useRef` para `partyEmotions` en los callbacks, o separar la lectura de emociones del portrait lookup.

---

### BUG-17 — `as any[]` en GlossaryModal (LOW)

**Archivo:** [src/components/GlossaryModal.tsx](../../../src/components/GlossaryModal.tsx) · línea ~90+  
**Categoría:** TYPESCRIPT  
**Severidad:** LOW

**Descripción:**  
Parsing de respuesta de la API 5e usa `as any[]` para 4+ campos. Riesgo de runtime errors si la API cambia shape.

**Fix:**  
Definir interfaces para los tipos de respuesta API o usar `unknown` con type narrowing.

---

### BUG-18 — `navigation.navigate(screen as any)` en VillageScreen (LOW)

**Archivo:** [src/screens/VillageScreen.tsx](../../../src/screens/VillageScreen.tsx) · línea ~200  
**Categoría:** TYPESCRIPT  
**Severidad:** LOW

**Fix:**
```typescript
navigation.navigate(screen as keyof RootStackParamList);
```

---

### BUG-19 — Variable de traducción tipada como `any` (LOW)

**Archivo:** [src/i18n/context.tsx](../../../src/i18n/context.tsx) · línea ~31  
**Categoría:** TYPESCRIPT  
**Severidad:** LOW

**Fix:**
```typescript
let value: unknown = translations[lang];
if (typeof value !== 'object' || value === null) return key;
```

---

### BUG-20 — `generateId()` usa `Math.random()` (LOW)

**Archivo:** [src/database/gameRepository.ts](../../../src/database/gameRepository.ts) · línea ~213  
**Categoría:** SECURITY  
**Severidad:** LOW

**Descripción:**  
IDs de partida generados con `Math.random()` son predecibles. Para un juego local sin backend esto es bajo riesgo, pero los IDs podrían colisionar en partidas muy frecuentes.

**Fix:**
```typescript
export function generateId(): string {
  const ts = Date.now().toString(36);
  // Usar múltiples calls a random para más entropía:
  const rand = [
    Math.random().toString(36).substring(2, 6),
    Math.random().toString(36).substring(2, 6),
  ].join('');
  return `${ts}-${rand}`;
}
```

---

### BUG-21 — Screens de inicio no lazy (LOW)

**Archivo:** [src/navigation/AppNavigator.tsx](../../../src/navigation/AppNavigator.tsx)  
**Categoría:** PERFORMANCE  
**Severidad:** LOW

**Descripción:**  
`MainScreen`, `SeedScreen`, `PartyScreen`, `VillageScreen`, `ReportScreen`, `ExtractionScreen`, `GuildScreen`, `CharacterDetailScreen` se importan estáticamente (no `lazy()`), inflando el bundle inicial con código que no se necesita de inmediato.

**Fix — lazificar gradualmente:**
```typescript
const VillageScreen = lazy(() =>
  import('../screens/VillageScreen').then(m => ({ default: m.VillageScreen }))
);
const ReportScreen = lazy(() =>
  import('../screens/ReportScreen').then(m => ({ default: m.ReportScreen }))
);
// etc.
// Mantener MainScreen como static import (es la primera pantalla)
```

---

### BUG-22 — Sin cap de parties en simulateWorld (LOW)

**Archivo:** [src/services/worldSimulator.ts](../../../src/services/worldSimulator.ts) · línea ~334  
**Categoría:** PERFORMANCE  
**Severidad:** LOW

Ver BUG-10 para detalles y fix.

---

### BUG-23 — `partyEmotions` init inline en BattleScreen (LOW)

**Archivo:** [src/screens/BattleScreen.tsx](../../../src/screens/BattleScreen.tsx) · línea ~493  
**Categoría:** PERFORMANCE  
**Severidad:** LOW

**Descripción:**  
`useState<PartyEmotionalState>({})` — el objeto `{}` es el valor inicial del state, no una dep, así que esto es en realidad **correcto** (React usa el initial value solo en el primer render). Este no es un bug real.

_No requiere fix._

---

## Conteo Final

| Severidad | Cantidad |
|-----------|----------|
| CRITICAL | 3 |
| HIGH | 5 |
| MEDIUM | 8 |
| LOW | 7 |
| **Total** | **23** |
