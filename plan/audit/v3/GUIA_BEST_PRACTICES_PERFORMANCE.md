# TORRE — Best Practices y Performance
> Auditoría v4.0 · 2026-03-12
> Estado: Todos los PERFORMANCE_TASKS completados. Esta versión documenta el estado de salud actual y áreas de riesgo.

---

## ✅ Performance completada — Inventario

Todos los ítems del `PERFORMANCE_TASKS.md` están marcados `[x]`. Estos son los patrones establecidos:

| Patrón | Dónde se aplica | Por qué |
|--------|----------------|---------|
| DB queries en `useEffect`, no en `useMemo` | `VillageScreen`, `GuildScreen`, `GlossaryModal` | op-sqlite es síncrono en hilo JS |
| Lookup O(1) con `Map` memoizado | `MapScreen` | Elimina `find()` en flatMap SVG |
| Selectores granulares de Zustand | `BattleScreen`, `VillageScreen`, `ExtractionScreen` | Evita re-render por cambios no relacionados |
| `React.lazy` en `AppNavigator` | 10 pantallas | Bundle inicial más pequeño |
| `React.memo` en componentes puros | `ConfirmModal`, items de lista, `ConnectionLines` | Evita re-renders en padres que cambian |
| SVG pattern en `CRTOverlay` | `CRTOverlay.tsx` | 1 nodo vs 100 Views |
| `useCallback` con deps correctas | Handlers en todas las pantallas | Estabilidad de referencias |

---

## Nuevas áreas de riesgo detectadas en v4.0

### PF-01 🔴 — ExtractionScreen: `getItemsByGame` sin paginación

**Contexto:** Cuando se implemente `FEAT-01` (ExtractionScreen real), `getItemsByGame(activeGameId)` va a traer **todos** los ítems del juego, no solo los de la última sesión. En late game con 80+ ciclos, esto puede ser 200-400 registros.

**Guard preventivo al implementar:**

```typescript
// itemRepository.ts — añadir función paginada
export function getRecentItems(gameId: string, sinceCycle: number): Item[] {
  return getDB().execute(
    'SELECT * FROM items WHERE owner_game_id = ? AND obtained_cycle >= ? ORDER BY obtained_cycle DESC LIMIT 50',
    [gameId, sinceCycle]
  ).rows.map(rowToItem);
}
```

```typescript
// ExtractionScreen.tsx — usar versión paginada
const sessionItems = getRecentItems(activeGameId, activeCycle - 1);
// Solo ítems del ciclo actual o anterior — no toda la historia
```

---

### PF-02 🟠 — MarketScreen: regenerar stock en cada render

**Contexto:** `generateMarketStock(seedHash, cycle, maxFloor)` debe ser determinístico y costoso de calcular (implica PRNG + filtros de floor). Si se llama en el render o en una dependencia inestable, se ejecutará en cada re-render.

**Patrón correcto al crear `MarketScreen`:**

```typescript
// ✅ CORRECTO — memoizar con deps estables
const marketStock = useMemo(
  () => generateMarketStock(seedHash, cycle, maxFloor),
  [seedHash, cycle, maxFloor] // solo cambia cuando el ciclo avanza
);

// ❌ INCORRECTO — recalcula en cada render
const marketStock = generateMarketStock(seedHash, cycle, maxFloor);
```

---

### PF-03 🟠 — BattleScreen: slots de items consumibles con query por render

**Contexto:** Cuando se implementen los slots de ítems en combat (UI-01, Slot 4), hay que cargar los consumibles del inventario. La query `getItemsByGame` no debe llamarse en cada ciclo de turno.

```typescript
// ✅ CORRECTO — query una vez al montar, invalidar solo si el inventario cambia
const [consumables, setConsumables] = useState<Item[]>([]);
useEffect(() => {
  if (!activeGameId) return;
  refreshConsumables();
}, [activeGameId]); // solo al montar y si cambia el gameId

const refreshConsumables = useCallback(() => {
  const items = getItemsByGame(activeGameId).filter(i =>
    i.type === 'consumable' && !i.claimed
  );
  setConsumables(items);
}, [activeGameId]);

// Llamar refreshConsumables() después de usar un ítem en combate
```

---

### PF-04 🟡 — worldSimulator: `loadRivals` en cada `simulateWorld`

**Contexto:** Con la nueva `rivalRepository`, `simulateWorld` carga los rivales persistidos antes de correr la simulación. Si `loadRivals` hace una query completa en cada llamada (incluyendo los ciclos rápidos en el dungeon), puede convertirse en overhead.

**Estado actual en `rivalRepository.saveRivalsWithState`:** Usa `executeBatch` para writes — correcto. Pero la función de lectura hace un `SELECT *` completo.

**Guard preventivo:**

```typescript
// rivalRepository.ts — limitar a los más recientes por piso
export function loadRivals(seedHash: string, limit = 15): PersistedRival[] {
  return getDB().execute(
    'SELECT * FROM rival_states WHERE seed_hash = ? ORDER BY floor DESC LIMIT ?',
    [seedHash, limit]
  ).rows.map(rowToRival);
}
// 15 rivales máximo — refleja el diseño de ~10 parties activas simultáneas
```

---

## Guards de integridad activos

### IG-01 — PRNG nunca nativo
```typescript
// ✅ SIEMPRE — import { makePRNG } from '../utils/prng'
// ❌ NUNCA — Math.random() en lógica de juego
```

### IG-02 — CharacterSave canónico en gameRepository
```typescript
// ✅ SIEMPRE — import type { CharacterSave } from '../database/gameRepository'
// ❌ NUNCA — redefinir la interfaz localmente
```

### IG-03 — Migrations solo incrementales
```typescript
// ✅ CORRECTO — CURRENT_VERSION = 16 para el próximo cambio de schema
// ❌ INCORRECTO — modificar migration 15 que ya está en dispositivos
```

### IG-04 — charClass siempre lowercase en DB, uppercase para i18n keys
```typescript
// Almacenar: char.charClass = 'paladin' (del API 5e index)
// Traducir:  t(`party.class_${char.charClass.toUpperCase()}`)
//            ↑ produce 'party.class_PALADIN' que existe en translations
```

### IG-05 — room.visited se persiste ANTES de navegar a Battle
```typescript
// MapScreen.tsx handleEnterRoom — comportamiento actual y correcto:
// 1. setFloor({ rooms: [..., { ...room, visited: true }] })  ← persiste en mapState
// 2. navigation.navigate('Battle', ...)
//
// Consecuencia conocida: si el app se cierra durante el combate,
// la sala aparece como visitada al reabrir → BUG-04/05
// La solución correcta requiere un estado 'in_combat' en SavedGame (ver BUG-04)
```

---

## Checklist de PR para código nuevo

- [ ] ¿Nuevas deps nativas tienen soporte para New Architecture (Fabric)?
- [ ] ¿Worklets de Reanimated no acceden a closures de React directamente?
- [ ] ¿Queries SQLite no están en `useMemo` ni en el cuerpo del render?
- [ ] ¿Clases de NativeWind son strings completos, no interpolados dinámicamente?
- [ ] ¿Valores de columnas SQLite hacen cast explícito con fallback?
- [ ] ¿Transacciones SQL agrupan writes relacionados?
- [ ] ¿Se usa `charClass.toUpperCase()` al construir keys de i18n para clase?
- [ ] ¿`cancelAnimation` se llama en cleanup de effects con Reanimated?
- [ ] ¿Nuevas pantallas están en `React.lazy` en `AppNavigator`?
- [ ] ¿Nuevas migrations tienen número mayor al `CURRENT_VERSION` actual?
- [ ] ¿Nuevo código que genera rooms o loot usa `makePRNG`, no `Math.random()`?
