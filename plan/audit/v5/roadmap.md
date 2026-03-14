# TORRE (dnd3) — Audit Roadmap v5

> **Fecha:** 2026-03-13  
> **Sprint de referencia:** Post-Sprint 7 / Pre-Sprint 8  
> **Objetivo:** Resolver todos los issues del Audit v5 en orden de prioridad e impacto

---

## Resumen Ejecutivo

El audit v5 identificó **23 issues** en el codebase de TORRE. Los más críticos afectan la **integridad de datos al startup** (crash si un save está corrupto) y la **performance de lectura de DB** (portraits base64 en SELECT *). Hay también problemas de **determinismo de seed** que afectan la reproducibilidad del juego, y varios issues de **TypeScript** y **best practices** que degradan la mantenibilidad.

### Estado actual de impacto

| Área | Issues | Riesgo |
|------|--------|--------|
| Performance | 6 | Startup lento (500ms–5s bloqueados) |
| Data Integrity | 6 | Crash al cargar save corrupto |
| Game Logic | 5 | Non-determinismo rompe seed fidelity |
| TypeScript | 4 | Bug latentes, dificulta refactoring |
| Security | 2 | IP expuesta en bundle |

---

## Fase 1 — Hotfixes Críticos (Sprint 8, Días 1–3)

> **Objetivo:** Eliminar riesgos de crash y degradación severa de performance al startup.

---

### TASK-01: Proteger `rowToSavedGame` de party_data corrupto

**Bug referenciado:** BUG-02  
**Archivo:** `src/database/gameRepository.ts`  
**Esfuerzo:** 30 min  
**Impacto:** Evita crash total al abrir la app si un save está corrupto

**Pasos:**
1. Abrir `src/database/gameRepository.ts`
2. Localizar la función `rowToSavedGame` (~línea 165)
3. Envolver el bloque `JSON.parse(row.party_data)` en try-catch:

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

4. Agregar un guard en `loadGame` que informe al usuario si `partyData` está vacío:
```typescript
loadGame: (id) => {
  const game = getSavedGame(id);
  if (!game) return false;
  if (game.partyData.length === 0) {
    console.warn('[Store] Game loaded with empty partyData:', id);
  }
  set({ activeGame: game });
  return true;
},
```

5. Ejecutar `yarn test __tests__/migrations.test.ts` para verificar que no se rompen los tests de DB.

---

### TASK-02: SELECT lean en `getAllSavedGames` (eliminar carga de portraits)

**Bug referenciado:** BUG-03  
**Archivo:** `src/database/gameRepository.ts`  
**Esfuerzo:** 1–2h  
**Impacto:** Reduce tiempo de startup hasta ~5s en devices con múltiples saves

**Pasos:**

1. Definir las columnas lean como constante al inicio del archivo:
```typescript
const LEAN_GAME_COLUMNS = [
  'id', 'seed', 'seed_hash', 'party_data', 'party_name',
  'floor', 'cycle', 'cycle_raw', 'phase', 'gold', 'status',
  'location', 'map_state', 'in_safe_zone', 'safe_zone_room_id',
  'party_origin', 'predecessor_game_id', 'created_by_player',
  'elimination_reason', 'kill_records', 'combat_room_id',
  'combat_room_type', 'last_action_at', 'last_sim_events',
  'created_at', 'updated_at',
].join(', ');
```

2. Modificar `getAllSavedGames()`:
```typescript
export function getAllSavedGames(): SavedGame[] {
  const db = getDB();
  const result = db.executeSync(
    `SELECT ${LEAN_GAME_COLUMNS} FROM saved_games ORDER BY updated_at DESC`,
  );
  return (result.rows as SavedGameRow[] ?? []).map(row => rowToSavedGame(row));
}
```

3. `rowToSavedGame` para rows sin portraits: el mapeo ya devuelve `null` cuando la columna no existe en el row:
```typescript
// Estas líneas ya son seguras — retornan null si la columna no viene:
portraitsJson,    // será null si no viene en el SELECT
expressionsJson,  // será null si no viene en el SELECT
partyPortrait: row.party_portrait ?? null,
```

4. Verificar que `getSavedGame(id)` y `getActiveSavedGame()` sigan usando `SELECT *` para cargar el juego activo (necesitan los portraits).

5. Ejecutar app y usar React Native DevTools para medir el tiempo de hydrate antes/después.

---

### TASK-03: Migración 18 — Índices faltantes en saved_games

**Bug referenciado:** BUG-14  
**Archivo:** `src/database/migrations.ts`  
**Esfuerzo:** 20 min  
**Impacto:** Reduce tiempo de queries en bounties/alliances ~50% con 10+ saves

**Pasos:**

1. Abrir `src/database/migrations.ts`
2. Agregar la migración 18 al final del objeto `migrations`:
```typescript
18: [
  `CREATE INDEX IF NOT EXISTS idx_saved_games_seed_hash ON saved_games(seed_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_saved_games_status_updated ON saved_games(status, updated_at DESC)`,
],
```

3. Incrementar `CURRENT_VERSION`:
```typescript
const CURRENT_VERSION = 18; // era 17
```

4. Ejecutar `yarn test __tests__/migrations.test.ts` — debe pasar sin cambios.

---

## Fase 2 — Determinismo de Seed (Sprint 8, Días 4–6)

> **Objetivo:** Todo elemento de juego derivado de la seed debe ser reproducible.

---

### TASK-04: Eliminar `Math.random()` de `defeatIllus` en BattleScreen

**Bug referenciado:** BUG-01  
**Archivo:** `src/screens/BattleScreen.tsx`  
**Esfuerzo:** 10 min

**Pasos:**

1. Buscar en BattleScreen.tsx el bloque:
```typescript
const pick = pool.length === 1
  ? pool[0]
  : pool[Math.floor(Math.random() * pool.length)];
```

2. Reemplazar por:
```typescript
const pick = pool.length === 1
  ? pool[0]
  : pool[rngRef.current.next(0, pool.length - 1)];
```

3. Eliminar el comentario `// eslint-disable-next-line react-hooks/exhaustive-deps` si solo estaba suprimiendo por este `Math.random`.

---

### TASK-05: Inyectar RNG en `characterStats.ts`

**Bugs referenciados:** BUG-04, BUG-05  
**Archivo:** `src/services/characterStats.ts`  
**Esfuerzo:** 1–2h (incluye actualizar callers)

**Pasos:**

1. Modificar `roll4d6DropLowest` para aceptar RNG:
```typescript
import type { PRNG } from '../utils/prng';

function roll4d6DropLowest(rng: PRNG): number {
  const dice = Array.from({ length: 4 }, () => rng.next(1, 6));
  dice.sort((a, b) => a - b);
  return dice[1] + dice[2] + dice[3];
}
```

2. Modificar `pickRaceName`:
```typescript
export function pickRaceName(raceIndex: string, rng: PRNG): string {
  const pool = RACE_NAMES[raceIndex] ?? RACE_NAMES.human ?? ['Adventurer'];
  if (!pool || pool.length === 0) return 'Adventurer';
  return pool[rng.next(0, pool.length - 1)];
}
```

3. Buscar todos los callers de `roll4d6DropLowest` y `pickRaceName` (usar Serena `find_referencing_symbols`) y pasarles el RNG derivado del seed del juego.

4. En las pantallas de creación de personaje (PartyScreen), el RNG se inicializa desde el seed ingresado por el usuario:
```typescript
import { makePRNG } from '../utils/prng';
const rng = makePRNG(`party_gen_${seed}_${charIndex}`);
```

---

### TASK-06: Seed determinista en `enemySpriteService`

**Bug referenciado:** BUG-06  
**Archivo:** `src/services/enemySpriteService.ts`  
**Esfuerzo:** 30 min

**Pasos:**

1. Localizar la generación del sprite seed (buscar `Math.random()` en ese archivo).
2. Cambiar a seed derivada:
```typescript
import { makePRNG } from '../utils/prng';

// Donde antes era: const seed = Math.floor(Math.random() * 2**32)
const rng = makePRNG(`sprite_${monsterName}_${roomId}_${seedHash}`);
const spriteSeed = rng.next(0, 2 ** 31 - 1);
```
3. Verificar que la función que llama a esta tiene acceso a `seedHash` — si no, propagarlo como parámetro.

---

## Fase 3 — Seguridad y Configuración (Sprint 8, Días 7–8)

---

### TASK-07: Mover IP de ComfyUI a variables de entorno

**Bug referenciado:** BUG-07  
**Archivo:** `src/services/geminiImageService.ts`  
**Esfuerzo:** 45 min

**Pasos:**

1. Verificar si `react-native-config` está en `package.json`. Si no:
```bash
yarn add react-native-config
cd ios && pod install
```

2. Crear/actualizar `.env` en la raíz (basado en `exmaple env`):
```env
COMFY_HOST_IOS=192.168.0.17
COMFY_HOST_ANDROID=10.0.2.2
COMFY_PORT=8089
```

3. Agregar `.env` y `*.local` a `.gitignore`.

4. Actualizar `geminiImageService.ts`:
```typescript
import Config from 'react-native-config';

const COMFY_HOST = Platform.select({
  android: Config.COMFY_HOST_ANDROID ?? '10.0.2.2',
  ios:     Config.COMFY_HOST_IOS    ?? '192.168.0.17',
  default: Config.COMFY_HOST_IOS    ?? '192.168.0.17',
});
const COMFY_BASE_URL = `http://${COMFY_HOST}:${Config.COMFY_PORT ?? '8089'}`;
```

5. Crear `exmaple.env` (o renombrar `exmaple env`) con los keys sin valores:
```env
COMFY_HOST_IOS=
COMFY_HOST_ANDROID=
COMFY_PORT=8089
```

---

## Fase 4 — TypeScript y Data Integrity (Sprint 9, Días 1–3)

---

### TASK-08: Corregir tipo de `values` en `updateSavedGame`

**Bug referenciado:** BUG-15  
**Archivo:** `src/database/gameRepository.ts`  
**Esfuerzo:** 30 min

**Pasos:**

1. Cambiar el tipo del array de values:
```typescript
const values: (string | number | null)[] = [];
```

2. Reemplazar todos los `?? null as unknown as string` por `?? null`:
```typescript
// Antes:
values.push(updates.mapState ?? null as unknown as string);
// Después:
values.push(updates.mapState ?? null);
```

3. Repetir para todos los campos opcionales: `partyPortrait`, `portraitsJson`, `expressionsJson`, `safeZoneRoomId`, `lastActionAt`, `lastSimEvents`, `combatRoomId`, `combatRoomType`, `partyName`.

---

### TASK-09: Corregir acceso `expressionsJson[idx]` en BattleScreen

**Bug referenciado:** BUG-09  
**Archivo:** `src/screens/BattleScreen.tsx`  
**Esfuerzo:** 10 min

1. En `getPartyPortrait`, cambiar:
```typescript
const exprs = expressionsJson[idx];
```
por:
```typescript
const exprs = expressionsJson[String(idx)];
```

---

### TASK-10: `equipItem` con validación y return

**Bug referenciado:** BUG-12  
**Archivo:** `src/database/itemRepository.ts`  
**Esfuerzo:** 20 min

```typescript
export function equipItem(id: string, charName: string): boolean {
  const db = getDB();
  db.executeSync(
    'UPDATE items SET is_equipped = 1, owner_char_name = ? WHERE id = ?',
    [charName, id],
  );
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

### TASK-11: Fallback explícito en `getAttackStat`

**Bug referenciado:** BUG-13  
**Archivo:** `src/services/combatEngine.ts`  
**Esfuerzo:** 10 min

```typescript
function getAttackStat(charClass: string): keyof BaseStats {
  const map: Record<string, keyof BaseStats> = {
    fighter: 'STR', barbarian: 'STR', paladin: 'STR',
    ranger: 'DEX', rogue: 'DEX', monk: 'DEX',
    wizard: 'INT', sorcerer: 'INT', warlock: 'CHA',
    cleric: 'WIS', druid: 'WIS', bard: 'CHA',
  };
  return map[charClass.toLowerCase()] ?? 'STR';
}
```

---

### TASK-12: Fix stale closure en useEffect INITIATIVE

**Bug referenciado:** BUG-08  
**Archivo:** `src/screens/BattleScreen.tsx`  
**Esfuerzo:** 30 min

```typescript
// Agregar después de definir goToNextTurn:
const goToNextTurnRef = useRef(goToNextTurn);
useEffect(() => {
  goToNextTurnRef.current = goToNextTurn;
});

// Modificar el useEffect de INITIATIVE:
useEffect(() => {
  if (uiPhase !== 'INITIATIVE') return;
  const csSnapshot = cs;
  const timer = setTimeout(() => goToNextTurnRef.current(csSnapshot), 2000);
  return () => clearTimeout(timer);
}, [uiPhase, cs]);
// NOTA: Se puede mantener la supresión remove si cs en deps causa loops — revisar
```

---

## Fase 5 — Performance y Refactoring (Sprint 9, Días 4–7)

---

### TASK-13: Cap de AI parties en `simulateWorld`

**Bug referenciado:** BUG-10  
**Archivo:** `src/services/worldSimulator.ts`  
**Esfuerzo:** 20 min

```typescript
const MAX_AI_PARTIES = 12;

// En el bloque de spawn:
if (activeCount < 3 && aiStates.length < MAX_AI_PARTIES) {
  // spawn...
}

// Limpiar defeated al inicio de cada ciclo para mantener array pequeño:
// (opcional, pero recomendado para ciclos largos)
```

---

### TASK-14: Lazy load de screens restantes en AppNavigator

**Bug referenciado:** BUG-21  
**Archivo:** `src/navigation/AppNavigator.tsx`  
**Esfuerzo:** 30 min

Lazificar todas las screens excepto `MainScreen`:
```typescript
const VillageScreen = lazy(() =>
  import('../screens/VillageScreen').then(m => ({ default: m.VillageScreen }))
);
const ReportScreen = lazy(() =>
  import('../screens/ReportScreen').then(m => ({ default: m.ReportScreen }))
);
const ExtractionScreen = lazy(() =>
  import('../screens/ExtractionScreen').then(m => ({ default: m.ExtractionScreen }))
);
const GuildScreen = lazy(() =>
  import('../screens/GuildScreen').then(m => ({ default: m.GuildScreen }))
);
const CharacterDetailScreen = lazy(() =>
  import('../screens/CharacterDetailScreen').then(m => ({ default: m.CharacterDetailScreen }))
);
```

Medir TTI antes/después con React Native DevTools.

---

### TASK-15: Aplicar `React.memo` en sub-componentes de BattleScreen

**Archivo:** `src/screens/BattleScreen.tsx`  
**Esfuerzo:** 1h

Los siguientes componentes definidos en BattleScreen.tsx son candidatos para `React.memo` ya que se re-renderizan con cada turno:
- `EnemyCard` — recibe `enemy`, `isTargetable`, `onPress`
- `PartyCard` — recibe `char`, `isAllyTargetable`, `portraitSource`
- `TurnToken` — recibe propiedades simples del turno

```typescript
export const EnemyCard = React.memo(({ enemy, isTargetable, onPress }: EnemyCardProps) => {
  // ...
});
```

---

## Fase 6 — TypeScript Cleanup (Sprint 10)

### TASK-16: Eliminar `as any` en GlossaryModal
- Definir interfaces `APIAbilityBonus`, `APITrait`, `APIArmorClass`
- Reemplazar `as any[]` por los tipos correctos

### TASK-17: Tipar correctamente `i18n/context.tsx`
- Cambiar `let value: any` por `let value: unknown`
- Agregar type narrowing antes de acceder a propiedades

### TASK-18: Fix `navigation.navigate(screen as any)` en VillageScreen
- Usar `screen as keyof RootStackParamList`
- O construir un mapa tipado de screens por building

### TASK-19: Temp file determinista en `imageStorageService`
- En `savePortraitToFS`, usar combinación de `characterId` + `expressionKey` + timestamp + contador para evitar colisiones

---

## Métricas de Validación

| Métrica | Antes | Objetivo (Fase 1–2) | Herramienta |
|---------|-------|---------------------|-------------|
| Tiempo hydrate startup | ~2–5s (estimado) | <500ms | RN DevTools Profiler |
| Tamaño bundle JS | ? | Medir base con `source-map-explorer` | Paso previo |
| Tests pasando | ? | 100% | `yarn test` |
| TypeScript errors | ? | 0 | `yarn tsc --noEmit` |
| ESLint warnings | ? | 0 `react-hooks/exhaustive-deps` no suprimidos | `yarn lint` |

### Cómo medir el baseline ahora:
```bash
# 1. TypeScript errors
yarn tsc --noEmit 2>&1 | tail -20

# 2. Tests
yarn test

# 3. Lint
yarn lint

# 4. Bundle size (iOS)
npx react-native bundle \
  --entry-file index.js \
  --bundle-output /tmp/bundle.js \
  --platform ios \
  --sourcemap-output /tmp/bundle.js.map \
  --dev false --minify true
ls -lh /tmp/bundle.js
```

---

## Orden Recomendado de Tasks

```
Sprint 8 (Días 1–3: Críticos)
├── TASK-01: rowToSavedGame try-catch    [30 min, CRITICAL]
├── TASK-02: SELECT lean en getAllSaved  [2h, CRITICAL]
└── TASK-03: Migración 18 + índices     [20 min, MEDIUM]

Sprint 8 (Días 4–6: Determinismo)
├── TASK-04: defeatIllus rngRef          [10 min, CRITICAL]
├── TASK-05: characterStats RNG          [2h, HIGH]
└── TASK-06: enemySpriteService seed     [30 min, HIGH]

Sprint 8 (Días 7–8: Seguridad)
└── TASK-07: IP a env vars               [45 min, HIGH]

Sprint 9 (Días 1–3: TypeScript/Integrity)
├── TASK-08: values[] null type          [30 min, MEDIUM]
├── TASK-09: expressionsJson String(idx) [10 min, MEDIUM]
├── TASK-10: equipItem return bool       [20 min, MEDIUM]
├── TASK-11: getAttackStat fallback      [10 min, MEDIUM]
└── TASK-12: stale closure INITIATIVE   [30 min, HIGH]

Sprint 9 (Días 4–7: Performance)
├── TASK-13: worldSimulator cap          [20 min, MEDIUM]
├── TASK-14: lazy screens remaining      [30 min, LOW]
└── TASK-15: React.memo sub-components  [1h, LOW]

Sprint 10 (TypeScript cleanup)
├── TASK-16: GlossaryModal types         [1h, LOW]
├── TASK-17: i18n typing                 [30 min, LOW]
├── TASK-18: VillageScreen nav cast      [15 min, LOW]
└── TASK-19: imageStorageService temp    [15 min, LOW]
```

---

## Referencias

- [bugs.md](./bugs.md) — Catálogo detallado de todos los bugs
- [best_practices.md](./best_practices.md) — Guía de best practices para TORRE
- [React Native Optimization](../../.github/skills/react-native-best-practices/SKILL.md) — Guía de performance de Callstack
