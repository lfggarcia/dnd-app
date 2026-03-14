# TORRE (dnd3) — Best Practices Guide v5

> **Aplica a:** React Native 0.84 + React 19 + TypeScript 5.8 + NativeWind 4 + Zustand 5  
> **Basado en:** Callstack "Ultimate Guide to React Native Optimization" + análisis del codebase

---

## 1. Zustand: Selectores Granulares

### ❌ Anti-pattern
```typescript
// Suscribe a todo activeGame — re-render en cada campo que cambie
const game = useGameStore(s => s.activeGame);
const partyData = game?.partyData;
const gold = game?.gold;
```

### ✅ Patrón correcto (ya implementado en BattleScreen)
```typescript
// Cada selector suscribe solo al campo que necesita
const partyData = useGameStore(s => s.activeGame?.partyData ?? EMPTY_PARTY_DATA);
const gold      = useGameStore(s => s.activeGame?.gold ?? 0);
const seedHash  = useGameStore(s => s.activeGame?.seedHash ?? '');
```

### Regla
- Nunca suscribir a `s => s.activeGame` entero en un componente.
- Definir `const EMPTY_X = Object.freeze({})` fuera del componente para valores fallback estables.
- Acciones (`updateProgress`, `setCombatResult`) pueden extraerse en un único selector ya que son funciones estables de Zustand.

---

## 2. Memoization: Cuándo y Cómo

### `useMemo` — para valores derivados costosos
```typescript
// ✅ Correcto: cálculo costoso o creación de array derivado
const aliveParty = useMemo(
  () => partyData.filter(c => c.alive),
  [partyData],
);

// ❌ Incorrecto: memoizar algo trivial que no vale el overhead
const title = useMemo(() => `Floor ${floor}`, [floor]);
// Mejor: simplemente `const title = \`Floor ${floor}\``
```

### `useCallback` — para funciones pasadas como props a componentes hijo
```typescript
// ✅ Correcto: la función se pasa a un componente memoizado
const handlePress = useCallback(() => {
  navigation.navigate('Battle', { roomId, roomType });
}, [navigation, roomId, roomType]);

// ❌ Incorrecto: función sin hijos ni deps externas — no necesita useCallback
const getTitle = useCallback(() => 'Battle', []);
```

### `React.memo` — en componentes "puros" con muchas re-renders
```typescript
// ✅ Aplicar en componentes que reciben props simples y renderizan frecuente
export const EnemyCard = React.memo(({ enemy, isTargetable, onPress }: EnemyCardProps) => {
  // ...
});

// Regla: Si un componente re-renderiza >10 veces por acción de usuario → React.memo
```

### Componentes sub-componentes en BattleScreen
`EnemyCard`, `PartyCard`, `TurnToken` dentro de BattleScreen.tsx son excelentes candidatos para `React.memo` si se confirma que reciben las mismas props frecuentemente.

---

## 3. SQLite / Database: Patrones Seguros

### Siempre envolver JSON.parse en try-catch al leer de BD
```typescript
// ❌ Crash si row.party_data está corrupto
const parsed = JSON.parse(row.party_data) as CharacterSave[];

// ✅ Seguro con fallback
let partyData: CharacterSave[] = [];
try {
  partyData = JSON.parse(row.party_data) as CharacterSave[];
} catch {
  __DEV__ && console.error('[DB] Corrupt party_data for game', row.id);
}
```

### SELECT lean — nunca SELECT * en tablas con BLOB/TEXT grande
```typescript
// ❌ Carga portrait_json (MB) incluso en listados
const result = db.executeSync('SELECT * FROM saved_games');

// ✅ Solo los campos necesarios para el listado
const result = db.executeSync(
  `SELECT id, seed, seed_hash, party_name, floor, cycle, status, updated_at
   FROM saved_games ORDER BY updated_at DESC`
);
```

### Usar `null` explícito en parámetros (no `null as unknown as string`)
```typescript
// ❌ Bypasa el type system
const values: (string | number)[] = [];
values.push(updates.mapState ?? null as unknown as string);

// ✅ Tipar correctamente
const values: (string | number | null)[] = [];
values.push(updates.mapState ?? null);
```

### Transacciones para operaciones multi-step
```typescript
// ✅ Ya implementado en runMigrations — aplicar también en operaciones batch:
db.executeSync('BEGIN TRANSACTION');
try {
  db.executeSync('UPDATE items SET is_equipped = 0 WHERE owner_char_name = ?', [charName]);
  db.executeSync('UPDATE items SET is_equipped = 1 WHERE id = ?', [itemId]);
  db.executeSync('COMMIT');
} catch (e) {
  db.executeSync('ROLLBACK');
  throw e;
}
```

---

## 4. Determinismo por Seed: Regla de Oro

**En TORRE, todo elemento visual o mecánico que afecte al juego debe ser determinista por seed.**

### ❌ Nunca usar `Math.random()` en:
- Generación de stats de personajes
- Selección de sprites/ilustraciones
- Generación de nombres
- Loot drops
- Encuentros
- Animaciones de combate

### ✅ Siempre usar `makePRNG(seed)` de `src/utils/prng.ts`:
```typescript
import { makePRNG } from '../utils/prng';

// El seed debe incluir el seedHash del juego + contexto único
const rng = makePRNG(`combat_${seedHash}_${roomId}`);
const dmg = rng.next(1, 8); // 1d8 determinista
```

### Jerarquía de Seeds para TORRE
```
game.seedHash
├── combat_{roomId}          → combatEngine.ts (✅ ya implementado)
├── loot_{roomId}_{floor}    → lootService.ts (✅ ya implementado)
├── world_{cycle}            → worldSimulator.ts (✅ ya implementado)
├── stats_{charName}         → characterStats.ts (❌ usa Math.random())
├── sprite_{monster}_{room}  → enemySpriteService.ts (❌ usa Math.random())
└── defeat_illus_{roomId}    → BattleScreen.tsx (❌ usa Math.random())
```

---

## 5. useEffect: Patrones y Anti-patterns

### Nunca suprimir ESLint `react-hooks/exhaustive-deps` sin justificación documentada
```typescript
// ❌ Supresión sin explicación — bug waiting to happen
useEffect(() => {
  doSomethingWith(value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// ✅ Si la supresión es necesaria, documentar explícitamente por qué
useEffect(() => {
  // Solo ejecutar una vez al montar: el seed no cambia durante el juego
  bossLootClaimedRef.current = isBossLootClaimed(seedHash, roomId);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional: solo mount
}, []);
```

### Patrón ref para funciones en useEffect con timers
```typescript
// Problema: goToNextTurn cambia de referencia pero useEffect no lo detecta
useEffect(() => {
  const timer = setTimeout(() => goToNextTurn(cs), 2000);
  return () => clearTimeout(timer);
}, [uiPhase]); // goToNextTurn no está → stale closure

// ✅ Solución con ref:
const callbackRef = useRef(goToNextTurn);
useEffect(() => { callbackRef.current = goToNextTurn; });

useEffect(() => {
  if (uiPhase !== 'INITIATIVE') return;
  const csSnapshot = cs;
  const timer = setTimeout(() => callbackRef.current(csSnapshot), 2000);
  return () => clearTimeout(timer);
}, [uiPhase, cs]);
```

### Siempre hacer cleanup de timers, listeners y suscripciones
```typescript
// ✅ Cleanup necesario en BattleScreen — ya implementado:
useEffect(() => {
  const sub = BackHandler.addEventListener('hardwareBackPress', () => {
    if (cs.outcome) handleContinue();
    return true;
  });
  return () => sub.remove(); // ← cleanup ✅
}, [handleContinue, cs.outcome]);
```

---

## 6. TypeScript: Eliminar `any`

### Reglas de tipado para TORRE

| Anti-pattern | Alternativa |
|-------------|-------------|
| `as any` | Define la interface concreta |
| `as any[]` | `as ConcreteType[]` |
| `as unknown as X` | Validar primero con type guard |
| `value!` (non-null assertion) | Usar `??` o type guard |
| `null as unknown as string` | Cambiar tipo de array a `(T \| null)[]` |

### Ejemplo: typing de API responses
```typescript
// ❌ En GlossaryModal:
const bonuses = ((raw.ability_bonuses as any[]) ?? [])

// ✅ Definir interface:
interface APIAbilityBonus {
  ability_score: { index: string; name: string };
  bonus: number;
}
const bonuses = ((raw.ability_bonuses as APIAbilityBonus[]) ?? [])
```

### Type guards para discriminated unions
```typescript
// ✅ Para room types:
const COMBAT_ROOM_TYPES = new Set(['NORMAL', 'ELITE', 'BOSS'] as const);
type CombatRoomType = 'NORMAL' | 'ELITE' | 'BOSS';

function isCombatRoom(type: string): type is CombatRoomType {
  return COMBAT_ROOM_TYPES.has(type as CombatRoomType);
}
```

---

## 7. Performance: Bundle y Lazy Loading

### Lazy loading de screens (ya parcialmente implementado)

TORRE ya usa `React.lazy()` para screens pesadas. Extender a todas las screens excepto `MainScreen`:

```typescript
// Screens que deberían ser lazy (aún no lo son):
const VillageScreen = lazy(() =>
  import('../screens/VillageScreen').then(m => ({ default: m.VillageScreen }))
);
const ReportScreen = lazy(() =>
  import('../screens/ReportScreen').then(m => ({ default: m.ReportScreen }))
);
const GuildScreen = lazy(() =>
  import('../screens/GuildScreen').then(m => ({ default: m.GuildScreen }))
);
```

### Dynamic imports en Zustand actions (ya implementado)
```typescript
// ✅ El patrón de dynamic import en advanceCycle es correcto:
const { advanceTime } = await import('../services/timeService');
const { simulateWorld } = await import('../services/worldSimulator');
// Esto code-splits el bundle — worldSimulator no se carga en startup
```

### Evitar imports de barril (barrel exports) con re-exports masivos
```typescript
// ❌ Importar toda la carpeta services
import * as services from '../services';

// ✅ Importar solo lo necesario
import { resolveCombat } from '../services/combatEngine';
import { generateRoomLoot } from '../services/lootService';
```

---

## 8. Images y Portraits: Memory Management

### Problema actual
Los portraits se almacenan como base64 en SQLite (`party_portrait`, `portraits_json`, `expressions_json`). Cada portrait completo puede pesar 1–3MB. Con expressions (6 variantes × 4+ personajes), una row puede tener 20+ MB.

### Arquitectura correcta (imageStorageService ya existe)
```
Flujo correcto:
1. AI genera base64 → savePortraitToFS() → comprime a 512px → guarda en FileSystem
2. DB guarda solo el path: "file:///data/.../portraits/char_0_base.jpg"
3. Zustand solo tiene el path, NO el base64
4. Image component carga desde path local

Flujo actual (problemático):
1. AI genera base64 → guarda base64 completo en SQLite
2. getAllSavedGames() lee todo el base64 de SQLite
3. Zustand tiene MB de base64 en memoria
```

### Migración recomendada
En `updateSavedGame` y `savePortrait`, verificar si el valor es un path (`file://`) o base64, y migrar automáticamente:
```typescript
async function ensurePortraitOnFS(characterId: string, data: string): Promise<string> {
  if (data.startsWith('file://')) return data; // ya en filesystem
  // Migrar: guardar en FS, retornar path
  return savePortraitToFS(characterId, data);
}
```

---

## 9. Error Handling: Sin Fallos Silenciosos

### Principio
Todo `catch {}` vacío debe al menos loggear en `__DEV__`:

```typescript
// ❌ Silencioso — dificulta debugging
try {
  portraitsJson = JSON.parse(row.portraits_json);
} catch { /* ignore */ }

// ✅ Con logging en dev
try {
  portraitsJson = JSON.parse(row.portraits_json);
} catch (e) {
  __DEV__ && console.warn('[DB] Failed to parse portraits_json for game', row.id, e);
}
```

### Errores de DB que deben propagarse
No silenciar errores de operaciones críticas como `createSavedGame`, `updateSavedGame`, `runMigrations`:
```typescript
// ✅ Ya implementado en runMigrations — lanza error en catch ✅
// Asegurar que updateSavedGame también propague (actualmente no tiene try-catch)
```

---

## 10. React Native Específico: FlatList y SVG

### FlatList / listas de items
```typescript
// ✅ Props esenciales para performance en FlatList:
<FlatList
  data={items}
  renderItem={renderItem}           // debe estar memoizado con useCallback
  keyExtractor={item => item.id}    // evitar usar index
  removeClippedSubviews={true}      // Android: unmount fuera de viewport
  maxToRenderPerBatch={10}          // limitar renders por batch
  windowSize={5}                    // ventana de renderizado
  initialNumToRender={6}            // renders iniciales
  getItemLayout={(_, index) =>      // si items tienen altura fija
    ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
/>
```

### SVG en MapScreen
MapScreen usa `react-native-svg` para renderizar el mapa. Con floors grandes (30+ nodos):
- Usar `shouldRasterizeIOS={true}` en el contenedor SVG para iOS
- Considerar `needsOffscreenAlphaCompositing` para Android
- Memoizar los nodos del mapa con `React.memo`

### Animations: siempre `useNativeDriver: true`
```typescript
// ✅ Para animaciones de posición/opacidad:
Animated.timing(value, {
  toValue: 1,
  duration: 300,
  useNativeDriver: true, // ← SIEMPRE para transform y opacity
}).start();

// ❌ useNativeDriver: false solo cuando se anima layout (height, width)
```

---

## 11. Seguridad: Variables de Entorno

### Qué no debe estar hardcodeado en el bundle
- IPs de servicios externos (ComfyUI host)
- Claves de API (si se usa Gemini directamente desde el cliente)
- URLs de desarrollo

### Patrón con react-native-config
```typescript
// ✅ src/config/env.ts
import Config from 'react-native-config';

export const ENV = {
  COMFY_HOST_IOS: Config.COMFY_HOST_IOS ?? '192.168.0.17',
  COMFY_HOST_ANDROID: Config.COMFY_HOST_ANDROID ?? '10.0.2.2',
  IS_DEV: __DEV__,
} as const;
```

```env
# .env (no commitear)
COMFY_HOST_IOS=192.168.0.17
COMFY_HOST_ANDROID=10.0.2.2
```

---

## 12. Testing: Qué y Cómo

### Tests críticos para TORRE

| Área | Qué testear | Herramienta |
|------|-------------|-------------|
| combatEngine | Determinismo: mismo seed → mismo outcome | Jest |
| economyService | Cálculos de revive/inn cost | Jest |
| lootService | Generación de loot por floor/rarity | Jest |
| migrations | Que cada migración aplica sin error | Jest + real SQLite |
| prng | Distribución estadística de outputs | Jest |
| BattleScreen | Render inicial, acción de ataque | RNTL |
| MapScreen | Render del mapa, navegación entre rooms | RNTL |

### Patrón para tests de determinismo
```typescript
it('combat with same seed always produces same outcome', () => {
  const party = createTestParty();
  const enemies = generateEnemiesForRoom('NORMAL', 'room_1', 1, 1);
  
  const result1 = resolveCombat(party, enemies, 'room_1', []);
  const result2 = resolveCombat(party, enemies, 'room_1', []);
  
  expect(result1.outcome).toBe(result2.outcome);
  expect(result1.roundsElapsed).toBe(result2.roundsElapsed);
  expect(result1.goldEarned).toBe(result2.goldEarned);
});
```
