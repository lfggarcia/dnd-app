# TORRE — Best Practices y Performance
> Auditoría v3.0 · 2026-03-11
> **Estado:** Todos los PERFORMANCE_TASKS marcados [x]. Esta guía documenta patrones activos del proyecto y áreas de vigilancia futura.

---

## ✅ Performance completada — Resumen de lo que ya está hecho

El equipo completó todas las tareas del archivo `PERFORMANCE_TASKS.md`. Este es un resumen de los patrones implementados para que el equipo los mantenga en el futuro.

### Patrón 1 — Queries SQLite fuera de useMemo

**Regla:** Las queries síncronas de SQLite (op-sqlite) bloquean el hilo JS. Nunca dentro de `useMemo`, `useCallback`, o llamadas directas en el render.

```typescript
// ✅ CORRECTO — query en useEffect, datos en estado
useEffect(() => {
  const equipment = getResourcesByEndpoint('equipment');
  setMarketResources(equipment);
}, [seedHash, cycle, maxFloor]);

const marketItems = useMemo(() =>
  computeMarketItems(marketResources, seedHash),
  [marketResources, seedHash]
);

// ❌ INCORRECTO — query dentro de useMemo bloquea render
const marketItems = useMemo(() => {
  const equipment = getResourcesByEndpoint('equipment'); // ← bloquea el hilo
  return computeMarketItems(equipment, seedHash);
}, [seedHash, cycle]);
```

**Archivos afectados:** `VillageScreen`, `GuildScreen`, `GlossaryModal`

---

### Patrón 2 — Lookup O(1) en render SVG

**Regla:** Nunca usar `Array.find()` dentro de un `flatMap` en render. Crear un `Map` memoizado primero.

```typescript
// ✅ CORRECTO
const roomMap = useMemo(() =>
  new Map(floor.rooms.map(r => [r.id, r])),
  [floor]
);
// Uso: roomMap.get(targetId) → O(1)

// ❌ INCORRECTO — O(N×M) en cada render
floor.rooms.flatMap(room =>
  room.connections.map(targetId => {
    const target = floor.rooms.find(r => r.id === targetId); // ← O(N) aquí
  })
);
```

**Archivos afectados:** `MapScreen`

---

### Patrón 3 — Selectores granulares de Zustand

**Regla:** Nunca suscribirse al store completo. Siempre selectors específicos para evitar re-renders innecesarios.

```typescript
// ✅ CORRECTO — solo re-renderiza si gold, cycle o floor cambian
const gold  = useGameStore(s => s.activeGame?.gold);
const cycle = useGameStore(s => s.activeGame?.cycle);
const floor = useGameStore(s => s.activeGame?.floor);

// ❌ INCORRECTO — re-renderiza en cualquier cambio del store
const { activeGame } = useGameStore();
const { gold, cycle, floor } = activeGame ?? {};
```

**Archivos afectados:** `BattleScreen`, `VillageScreen`, `ExtractionScreen`

---

### Patrón 4 — CRTOverlay con SVG pattern

**Por qué:** El overlay original usaba 100+ `View` components para simular las líneas de escaneo. Cada View es un nodo en el árbol de Fabric. El reemplazo usa un SVG pattern: 1 nodo, mismo efecto visual.

```tsx
// ✅ IMPLEMENTADO en CRTOverlay.tsx
<Svg style={StyleSheet.absoluteFill} opacity={0.04}>
  <Defs>
    <Pattern id="scanlines" x="0" y="0" width="1" height="4"
      patternUnits="userSpaceOnUse">
      <Line x1="0" y1="0" x2="100%" y2="0"
        stroke="white" strokeWidth="1" />
    </Pattern>
  </Defs>
  <Rect width="100%" height="100%" fill="url(#scanlines)" />
</Svg>
```

---

### Patrón 5 — React.lazy en navegación

**Por qué:** Las pantallas más pesadas (`MapScreen`, `BattleScreen`, `CycleTransitionScreen`, `WorldLogScreen`) se cargan solo cuando se navega a ellas. Reduce el bundle inicial y el tiempo hasta primer render.

```typescript
// AppNavigator.tsx — ya implementado
const MapScreen = React.lazy(() =>
  import('../screens/MapScreen').then(m => ({ default: m.MapScreen }))
);
// Con Suspense alrededor del Navigator
```

---

## Áreas de vigilancia futura (no son bugs, son riesgos de escala)

### PF-01 🟠 — worldSimulator en hilo principal

**Contexto:** `simulateWorld()` corre síncronamente en el hilo JS. Para 10 parties IA × 60 ciclos, el benchmark mostró ~80ms en dispositivos mid-range.

**Estado actual:** Hay un guard de 100ms implementado. El SimulationLoadingScreen lo oculta con animación.

**Monitorear:** Si `PARTY_COUNT` sube de 10 o los ciclos simulados pasan de 60, medir de nuevo. El threshold de pain está en ~150ms.

**Solución futura si se necesita:**
```typescript
// Mover a un WorkerThread con react-native-threads
// o usar InteractionManager.runAfterInteractions para ceder el hilo entre batches
import { InteractionManager } from 'react-native';

async function simulateWorldBatched(...) {
  for (let i = 0; i < parties.length; i += BATCH_SIZE) {
    await InteractionManager.runAfterInteractions();
    processBatch(parties.slice(i, i + BATCH_SIZE));
  }
}
```

---

### PF-02 🟡 — essenceRepository queries en CharacterDetailScreen

**Contexto:** `getEssencesByChar()` se llama en `useEffect` al montar `CharacterDetailScreen`. Si un personaje tiene muchas esencias (late game, rank 5 con 20+ ítems), la query puede tardar.

**Monitorear:** Añadir `console.time('essenceQuery')` en dev cuando el número de esencias en DB supere 50.

**Solución si se necesita:**
```sql
-- Asegurar índice en essenceRepository
CREATE INDEX IF NOT EXISTS idx_essences_owner
  ON essences (seed_hash, owner_char_name);
```

---

### PF-03 🟡 — FlatList en GlossaryModal con >500 ítems

**Contexto:** Ya se migró de ScrollView a FlatList con `windowSize`. Si el catálogo de monstruos crece a 500+, ajustar:

```tsx
<FlatList
  windowSize={5}         // mantener 5 viewports en memoria
  maxToRenderPerBatch={10}
  initialNumToRender={8}
  removeClippedSubviews  // ← añadir si hay lag en scroll
/>
```

---

## Guards de integridad activos (no romper)

Estos patterns protegen la consistencia del motor determinístico. **Nunca eliminarlos.**

### IG-01 — PRNG nunca random nativo

```typescript
// ✅ SIEMPRE
import { makePRNG } from '../utils/prng';
const rng = makePRNG(`${seedHash}_${context}`);
const value = rng.float();

// ❌ NUNCA en lógica de juego
Math.random(); // rompe determinismo
```

**Por qué:** El motor de simulación es determinístico por seed. Si cualquier servicio usa `Math.random()`, dos ejecuciones con la misma seed producen resultados distintos. Esto rompe la reproducibilidad, la herencia de parties y el sistema de unificación.

---

### IG-02 — CharacterSave siempre desde gameRepository

**Por qué:** `CharacterSave` es el tipo canónico. Si alguien define una interfaz similar en otro archivo y la usa localmente, los campos pueden desincronizarse con el schema SQL.

```typescript
// ✅ SIEMPRE importar desde el canónico
import type { CharacterSave } from '../database/gameRepository';

// ❌ NUNCA redefinir el tipo
interface MyChar { name: string; level: number; ... } // crea divergencia
```

---

### IG-03 — Migrations siempre incrementales, nunca modificar existentes

**Por qué:** SQLite no permite rollback de schema. Si se modifica una migration ya aplicada en dispositivos de test, los dispositivos con esa versión quedan en estado inconsistente y la app crashea al abrir.

```typescript
// ✅ CORRECTO — siempre nueva versión
14: [`CREATE TABLE rival_states (...)`]

// ❌ INCORRECTO — modificar la 13 que ya está deployada
13: [`... ALTER TABLE essences ADD COLUMN new_field TEXT`] // rompe dispositivos con v13
```

---

### IG-04 — updateSavedGame siempre con campos tipados

**Por qué:** `updateSavedGame` acepta `Partial<SavedGame>`. Si se pasa un campo con nombre incorrecto, SQLite no lo persiste sin error. El bug es silencioso.

```typescript
// ✅ CORRECTO — TypeScript valida los campos
updateSavedGame(id, { cycleRaw: 4.5, lastActionAt: new Date().toISOString() });

// ❌ PELIGROSO — typo silencioso
updateSavedGame(id, { cycle_raw: 4.5 }); // no existe en el tipo → TypeScript error
```

---

## Checklist de PR para cualquier nuevo servicio

Antes de mergear código nuevo al proyecto, verificar:

- [ ] ¿El nuevo servicio usa `makePRNG` y no `Math.random()`?
- [ ] ¿Las queries SQL van en un repository, no en el servicio o pantalla?
- [ ] ¿Los nuevos campos de `CharacterSave` se añaden a `gameRepository.ts`?
- [ ] ¿La nueva migration tiene número > 13 (o el current actual)?
- [ ] ¿Los componentes nuevos pesados están en `React.memo`?
- [ ] ¿Los callbacks costosos están en `useCallback`?
- [ ] ¿Los valores derivados están en `useMemo` con deps correctas?
- [ ] ¿Las queries SQLite no están en `useMemo` o en el cuerpo del render?
- [ ] ¿Los `console.log` tienen guard `if (__DEV__)`?
