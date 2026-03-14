# Code Review — Screens & Navigation
**Review:** review-001 | **Fecha:** 2026-03-14  
**Archivos revisados:** 22 pantallas + 2 archivos de navegación

---

## [src/screens/CampScreen.tsx]

### CR-018: `advanceToVillage` invocado dos veces en `handleWaitEndOfSeason`
**Severidad:** 🔴 Alta  
**Problema:** `handleWaitEndOfSeason` navega a `SimulationLoading` y llama `await advanceToVillage()` en paralelo. `SimulationLoadingScreen` ya llama `advanceToVillage()` en su propio `useEffect` al montar. Se ejecutan **dos simulaciones completas concurrentemente** en el mismo ciclo, con doble escritura en DB y doble navegación.

```tsx
// BUG en CampScreen:
navigation.navigate('SimulationLoading', { fromCycle: cycle });
await advanceToVillage(); // ← duplicado!
navigation.navigate('Village');

// FIX: eliminar las últimas dos líneas, SimulationLoadingScreen ya lo hace
const handleWaitEndOfSeason = useCallback(() => {
  navigation.navigate('SimulationLoading', { fromCycle: cycle });
}, [cycle, navigation]);
```

### CR-019: Selector `activeGame` completo — viola patrón de selectores granulares
**Severidad:** 🟡 Media  
**Problema:** `const activeGame = useGameStore(s => s.activeGame)` suscribe todo el objeto. Cualquier cambio (HP, gold, mapState) redibuja CampScreen. La code_style del proyecto lo prohíbe explícitamente.

```tsx
// FIX: extraer solo lo necesario
const seedHash = useGameStore(s => s.activeGame?.seedHash ?? '');
```

### CR-020: Navegación después de `await` sin guardia de desmontaje
**Severidad:** 🟡 Media  
**Problema:** Ambos handlers async (`handleLongRest`, `handleWaitEndOfSeason`) llaman `navigation.navigate()` después de un `await`. Si el usuario presiona back durante la espera, navegan sobre un stack ya modificado.

```tsx
// FIX: isMounted ref
const isMountedRef = useRef(true);
useEffect(() => () => { isMountedRef.current = false; }, []);
// En cada handler:
if (isMountedRef.current) navigation.navigate(...);
```

---

## [src/screens/BattleScreen.tsx]

### CR-021: `Math.random()` en `useMemo` de ilustración — no determinista
**Severidad:** 🟡 Media  
**Problema:** `pool[Math.floor(Math.random() * pool.length)]` dentro de `useMemo`. En Strict Mode se ejecuta dos veces, produce enemigos distintos, viola la consistencia determinista del engine.

```tsx
// FIX: usar rngRef.current.float()
const pick = pool.length === 1 ? pool[0] : pool[Math.floor(rngRef.current.float() * pool.length)];
```

### CR-022: `useEffect` de INITIATIVE captura `cs` stale (deps suprimidas)
**Severidad:** 🟡 Media  
**Problema:** `goToNextTurn(cs)` usa `cs` de closure omitido de las deps con eslint-disable. Con batching de React 18, `cs` puede estar desactualizado cuando el timer dispara.

```tsx
// FIX: ref para capturar cs más reciente
const csRef = useRef(cs);
useEffect(() => { csRef.current = cs; }, [cs]);
useEffect(() => {
  if (uiPhase !== 'INITIATIVE') return;
  const timer = setTimeout(() => goToNextTurn(csRef.current), 2000);
  return () => clearTimeout(timer);
}, [uiPhase, goToNextTurn]);
```

---

## [src/screens/ReportScreen.tsx]

### CR-023: `gold` stale en efecto de generación de loot (deps `[]`)
**Severidad:** 🟡 Media  
**Problema:** `updateProgress({ gold: gold + combatResult.goldEarned })` con `gold` capturado en el primer render. Con React 18 batching automático, puede calcular gold + goldEarned con valor desactualizado.

```tsx
// FIX: leer desde store en el momento del efecto
const currentGold = useGameStore.getState().activeGame?.gold ?? 0;
updateProgress({ gold: currentGold + combatResult.goldEarned });
```

---

## [src/screens/VillageScreen.tsx]

### CR-024: `getItemsByGame` (SQLite sync) dentro de `useMemo` — bloquea JS thread en render
**Severidad:** 🔴 Alta  
**Problema:** Query SQLite síncrona durante la fase de render. La code_style del proyecto prohíbe explícitamente: _"DB queries in useEffect (not useMemo), results stored in local useState"_.

```tsx
// FIX:
const [inventoryItems, setInventoryItems] = useState<LootDrop[]>([]);
useEffect(() => {
  if (!showArmory || !activeGameId) { setInventoryItems([]); return; }
  try { setInventoryItems(getItemsByGame(activeGameId).map(item => ({...}))); }
  catch { setInventoryItems([]); }
}, [showArmory, activeGameId]);
```

### CR-025: `advanceCycle().then(navigation)` en rama Inn sin guardia de desmontaje
**Severidad:** 🟡 Media  
**Fix:** Igual que CR-020 — usar `isMountedRef`.

---

## [src/screens/MapScreen.tsx]

### CR-026: Selector `activeGame` completo en la pantalla más compleja del juego
**Severidad:** 🔴 Alta  
**Problema:** `MapScreen` suscribe `activeGame` completo. Es la pantalla con mayor complejidad visual (SVG canvas, pulso Reanimated, múltiples componentes memoizados). Cualquier cambio en gold/HP mid-combat provoca re-render completo del canvas.

```tsx
// FIX: selectores granulares de los campos usados
const seedHash    = useGameStore(s => s.activeGame?.seedHash ?? '');
const floor       = useGameStore(s => s.activeGame?.floor ?? 1);
const cycle       = useGameStore(s => s.activeGame?.cycle ?? 1);
const mapState    = useGameStore(s => s.activeGame?.mapState ?? null);
const combatRoomId = useGameStore(s => s.activeGame?.combatRoomId ?? null);
```

### CR-027: `handleReturnToVillage` / `handleNextFloor` sin guardia de unmount
**Severidad:** 🟡 Media  
**Fix:** Igual que CR-020.

---

## [src/screens/CycleTransitionScreen.tsx]

### CR-028: `Animated.loop` sin referencia — memory leak en desmontaje
**Severidad:** 🔴 Alta  
**Problema:** El loop de animación no almacena referencia y **no se detiene al desmontar**. Continúa corriendo después de la navegación automática a Village, causando actualizaciones de estado en componente desmontado.

```tsx
// BUG: referencia perdida
Animated.loop(Animated.sequence([...])).start(); // sin ref

// FIX (igual que SimulationLoadingScreen lo hace correctamente):
useEffect(() => {
  const timing = Animated.timing(fadeAnim, {...});
  timing.start();
  const loop = Animated.loop(Animated.sequence([...]));
  loop.start();
  return () => { timing.stop(); loop.stop(); };
}, []);
```

---

## [src/screens/SimulationLoadingScreen.tsx]

### CR-029: Progress bar estática — `cycle` de Zustand no actualiza durante `advanceToVillage()`
**Severidad:** 🟡 Media  
**Problema:** `advanceToVillage()` actualiza el store al final de todos los ciclos. Durante la ejecución, `cycle` queda en el valor inicial → `progress` siempre muestra 0%. La barra nunca avanza.

```tsx
// FIX: animación sintética independiente del store
// Usar withTiming 0→100 basado en duración estimada, sin depender del cycle del store
```

---

## [src/screens/NegotiationScreen.tsx]

### CR-030: `handleFlee` captura `seedHash` y `cycle` stale
**Severidad:** 🔴 Alta  
**Problema:** `useCallback` de `handleFlee` usa `seedHash` y `cycle` para `makePRNG` pero no los incluye en deps. El dado de huida puede usar valores del primer render.

```tsx
// FIX:
}, [partyData, navigation, rivalName, seedHash, cycle]);
```

### CR-031: `handleProposeAlliance` navega a `Alliance` sin pasar `rivalName`
**Severidad:** 🟡 Media  
**Problema:** El rival pre-seleccionado en Negotiation no se pre-selecciona en AllianceScreen.

```tsx
// FIX: añadir proposingRival?: string al tipo de Alliance en types.ts y pasar el param
navigation.navigate('Alliance', { proposingRival: rivalName });
```

---

## [src/screens/LevelUpScreen.tsx]

### CR-032: `setTimeout` de navegación sin ref de cleanup
**Severidad:** 🟡 Media  
**Problema:** `setTimeout(() => navigation.goBack(), 1200)` sin cleanup. Si el usuario presiona back en los 1200ms, la pantalla se desmonta y el timeout navega sobre el stack ya modificado.

```tsx
// FIX:
const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);
timeoutRef.current = setTimeout(() => navigation.goBack(), 1200);
```

---

## [src/screens/GuildScreen.tsx]

### CR-033: `useGameStore.getState()` directo dentro de `useEffect` y handlers
**Severidad:** 🟡 Media  
**Problema:** `useGameStore.getState().saveCharacterExpressions(...)` — acceso imperativo al store dentro de efectos. El orden de actualización respecto a otros efectos del mismo render cycle es no determinista.

```tsx
// FIX: extraer action como selector al inicio del componente
const saveCharacterExpressions = useGameStore(s => s.saveCharacterExpressions);
```

---

## [src/screens/AllianceScreen.tsx]

### CR-034: `generateRivals()` en cuerpo del componente sin `useMemo`
**Severidad:** 🟡 Media  
**Problema:** Se recalcula en cada re-render, incluyendo los causados por `setShowProposal`, `setSelectedRival`.

```tsx
// FIX:
const rivals = useMemo(
  () => generateRivals(seedHash, floor, cycle).filter(r => r.status !== 'defeated'),
  [seedHash, floor, cycle],
);
```

---

## [src/screens/CharacterDetailScreen.tsx]

### CR-035: `generatingPortrait` en deps de `useCallback` — invalida callback innecesariamente
**Severidad:** 🟢 Baja  
**Fix:** Usar `useRef` para el guard en lugar del estado. Ver patrón isGeneratingRef en CR-069.

---

## [src/screens/MarketScreen.tsx / BlacksmithScreen.tsx]

### CR-036: `RARITY_COLOR` definido inline en render
**Severidad:** 🟢 Baja  

```tsx
// FIX: mover a nivel de módulo (fuera del componente)
const RARITY_COLORS: Record<string, string> = {
  common: 'rgba(0,255,65,0.7)',
  // ...
};
```

---

## [src/navigation/AppNavigator.tsx]

### CR-037: Screens pesadas no lazy-loaded (`GuildScreen`, `CharacterDetailScreen`, `PartyScreen`)
**Severidad:** 🟡 Media  
**Problema:** Los screens con lógica de portrait generation (gran árbol de dependencias) se importan estáticamente, inflando el bundle inicial y aumentando el TTI.

```tsx
// FIX: mismo patrón ya usado para otras screens
const GuildScreen = lazy(() =>
  import('../screens/GuildScreen').then(m => ({ default: m.GuildScreen }))
);
```

---

## [src/navigation/types.ts]

### CR-038: `eventType: string` — tipo demasiado amplio
**Severidad:** 🟢 Baja  

```typescript
// FIX:
EventResolution: { roomId: string; eventType: EventType | 'AUTO'; eventSeed: string };
```

### CR-039: `Extraction: { fromDefeat?: boolean } | undefined` — union innecesaria
**Severidad:** 🟢 Baja  

```typescript
// FIX:
Extraction: { fromDefeat?: boolean };
```

---

## [src/screens/SeedScreen.tsx]

### CR-040: Hash de seed calculado dos veces sin `useMemo` — ejecuta en cada keystroke
**Severidad:** 🟢 Baja  

```tsx
// FIX:
const seedHash = useMemo(
  () => seed.length >= 4
    ? seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0).toString(16).toUpperCase()
    : '----',
  [seed],
);
```

---

## Resumen

| ID | Archivo | Severidad |
|---|---|---|
| CR-018 | CampScreen.tsx | 🔴 Alta |
| CR-024 | VillageScreen.tsx | 🔴 Alta |
| CR-026 | MapScreen.tsx | 🔴 Alta |
| CR-028 | CycleTransitionScreen.tsx | 🔴 Alta |
| CR-030 | NegotiationScreen.tsx | 🔴 Alta |
| CR-019 | CampScreen.tsx | 🟡 Media |
| CR-020 | CampScreen.tsx | 🟡 Media |
| CR-021 | BattleScreen.tsx | 🟡 Media |
| CR-022 | BattleScreen.tsx | 🟡 Media |
| CR-023 | ReportScreen.tsx | 🟡 Media |
| CR-025 | VillageScreen.tsx | 🟡 Media |
| CR-027 | MapScreen.tsx | 🟡 Media |
| CR-029 | SimulationLoadingScreen.tsx | 🟡 Media |
| CR-031 | NegotiationScreen.tsx | 🟡 Media |
| CR-032 | LevelUpScreen.tsx | 🟡 Media |
| CR-033 | GuildScreen.tsx | 🟡 Media |
| CR-034 | AllianceScreen.tsx | 🟡 Media |
| CR-037 | AppNavigator.tsx | 🟡 Media |
| CR-035 | CharacterDetailScreen.tsx | 🟢 Baja |
| CR-036 | MarketScreen/BlacksmithScreen | 🟢 Baja |
| CR-038 | types.ts | 🟢 Baja |
| CR-039 | types.ts | 🟢 Baja |
| CR-040 | SeedScreen.tsx | 🟢 Baja |
