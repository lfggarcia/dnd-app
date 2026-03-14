# ⚙️ Rendimiento — Auditoría RN

> **Severidad general:** 🟡 Media  
> **Archivos afectados:** 12  
> **Esfuerzo estimado:** 6-8 horas

---

## Resumen ejecutivo
La app tiene buenas bases (lazy loading de 15 pantallas, granular Zustand selectors), pero sufre de: animaciones en JS thread cuando Reanimated ya está disponible, work pesado durante transitions de pantalla (SQLite sync, loot generation), y falta de React.memo/useCallback en componentes de lista. BattleScreen es el punto más crítico con 6 useEffects interdependientes.

---

## Hallazgos

### [PERF-001] Animated API (JS thread) en lugar de Reanimated en 4 componentes
**Archivo(s):** `src/screens/CycleTransitionScreen.tsx` L11-55, `src/screens/SimulationLoadingScreen.tsx` L19-31, `src/screens/BattleScreen.tsx` L376-384 (DefeatAnimation), `src/components/NarrativeMomentPanel.tsx` L36-46  
**Severidad:** 🟡 Media  
**Impacto:** Animaciones corren en JS thread causando potencial jank durante work concurrente. Reanimated 4 ya está instalado.

**Código actual:**
```tsx
// CycleTransitionScreen.tsx
const fadeAnim = useRef(new Animated.Value(0)).current;
Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
```

**Solución:**
```tsx
const fade = useSharedValue(0);
useEffect(() => { fade.value = withTiming(1, { duration: 800 }); }, []);
```

**Tiempo estimado:** 2 horas (4 componentes)  
**Prioridad:** P2

---

### [PERF-002] BattleScreen tiene 6 useEffects interdependientes — cadena frágil
**Archivo(s):** `src/screens/BattleScreen.tsx` L495, L507, L665, L672, L760, L380  
**Severidad:** 🟡 Media  
**Impacto:** Cada cambio de turno dispara 2-3 effects en cascada. Lógica compleja difícil de depurar. `eslint-disable` oculta problemas de deps.

**Solución:** Refactorizar lógica de turnos en un `useBattleTurns` hook dedicado o un state machine. No es urgente pero reduce riesgo de bugs.

**Tiempo estimado:** 4+ horas (refactor)  
**Prioridad:** P3 — Mejora de mantenibilidad

---

### [PERF-003] ReportScreen ejecuta loot generation + DB writes en mount (bloquea transition)
**Archivo(s):** `src/screens/ReportScreen.tsx` L31-87  
**Severidad:** 🔴 Alta  
**Impacto:** Múltiples `generateRoomLoot()`, `generateBossUniqueLoot()`, y `createItem()` DB writes se ejecutan síncronamente durante la transición de entrada. Causa jank visible al navegar de Battle → Report.

**Código actual:**
```tsx
useEffect(() => {
  // ... 50 líneas de generación + escritura
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Solución:**
```tsx
useEffect(() => {
  InteractionManager.runAfterInteractions(() => {
    // mover toda la lógica aquí
  });
}, []);
```

**Tiempo estimado:** 30 min  
**Prioridad:** P1 — Jank visible al usuario

---

### [PERF-004] react-native-fast-image instalado pero sin usar (0 imports)
**Archivo(s):** `package.json`  
**Severidad:** 🟢 Baja  
**Impacto:** Agrega peso al binary nativo sin beneficio. Todas las imágenes son locales/base64.

**Solución:** `npm uninstall react-native-fast-image` y `npx pod-install` (ya cubierto en DEP-001).

**Tiempo estimado:** 5 min  
**Prioridad:** P2

---

### [PERF-005] Funciones inline en .map() dentro de JSX (7+ pantallas)
**Archivo(s):** `VillageScreen.tsx` L414/L459, `PartyScreen.tsx` L495-817 (7 .map blocks), `CampScreen.tsx` L166, `CharacterDetailScreen.tsx` L518, `MainScreen.tsx` L237, `WorldLogScreen.tsx` L144  
**Severidad:** 🟡 Media  
**Impacto:** Cada render crea nuevas funciones para cada item, impidiendo React.memo optimization.

**Solución:** Extraer items en sub-componentes memoizados para las pantallas de alta frecuencia (Battle, Map). Bajo riesgo para pantallas estáticas.

**Tiempo estimado:** 2 horas (solo pantallas críticas)  
**Prioridad:** P3

---

### [PERF-006] React.memo en solo 4 componentes — falta en CRTOverlay y character cards
**Archivo(s):** `src/components/CRTOverlay.tsx`, `src/components/TorreLogo.tsx`, componentes de party/character cards  
**Severidad:** 🟡 Media  
**Impacto:** CRTOverlay se renderiza en casi todas las pantallas y se re-renderiza con cada cambio de parent.

**Solución:** Agregar `React.memo` a `CRTOverlay`, `TypewriterText`, `TorreLogo`, y character card components.

**Tiempo estimado:** 30 min  
**Prioridad:** P2

---

### [PERF-007] FlatList en CatalogPortraitPicker sin props de optimización
**Archivo(s):** `src/components/party/CatalogPortraitPicker.tsx` L141-155  
**Severidad:** 🟡 Media  
**Impacto:** Sin `initialNumToRender`, `windowSize`, `maxToRenderPerBatch`. renderItem inline.

**Solución:**
```tsx
<FlatList
  data={entries}
  keyExtractor={item => item.key}
  numColumns={3}
  initialNumToRender={12}
  windowSize={5}
  maxToRenderPerBatch={9}
  renderItem={renderPortraitThumb}
  showsVerticalScrollIndicator={false}
/>
```

**Tiempo estimado:** 20 min  
**Prioridad:** P2

---

### [PERF-009] SeedScreen matrix animation corre cuando no está en foco
**Archivo(s):** `src/screens/SeedScreen.tsx` L39-42  
**Severidad:** 🟢 Baja  
**Impacto:** Interval sigue corriendo si la screen está en el stack pero no visible.

**Solución:** Reemplazar `useEffect` → `useFocusEffect` de React Navigation.

**Tiempo estimado:** 10 min  
**Prioridad:** P3

---

### [PERF-010] ExtractionScreen gold counter: 30ms setInterval = 33 re-renders/seg
**Archivo(s):** `src/screens/ExtractionScreen.tsx` L55-69  
**Severidad:** 🔴 Alta  
**Impacto:** 33 setState + re-renders por segundo en JS thread para un simple counter visual.

**Código actual:**
```ts
const interval = setInterval(() => {
  current += step;
  setDisplayedGold(current);
}, 30);
```

**Solución:** Usar Reanimated `useSharedValue` + `withTiming` + `useAnimatedProps`, o al menos `requestAnimationFrame` con un solo state update al final.

**Tiempo estimado:** 30 min  
**Prioridad:** P1

---

### [PERF-011] VillageScreen: queries SQLite síncronos durante mount
**Archivo(s):** `src/screens/VillageScreen.tsx` L120-133  
**Severidad:** 🟡 Media  
**Impacto:** 2 queries SQLite + array transforms bloquean JS thread durante la transición de entrada.

**Solución:** Wrap con `InteractionManager.runAfterInteractions()`.

**Tiempo estimado:** 15 min  
**Prioridad:** P2

---

### [PERF-012] GuildScreen: portrait assignment loop en cada mount
**Archivo(s):** `src/screens/GuildScreen.tsx` L234-265  
**Severidad:** 🟡 Media  
**Impacto:** Itera partido completo (5 chars × 3 funciones) en cada mount. Deps incluyen `saveCharacterPortraits` que escribe al store — riesgo de loop.

**Solución:** Early exit si todos los characters ya tienen portrait. Memoizar check.

**Tiempo estimado:** 20 min  
**Prioridad:** P2

---

## Checklist de verificación
- [ ] PERF-001 — Migrar 4 componentes a Reanimated
- [ ] PERF-003 — InteractionManager en ReportScreen
- [ ] PERF-005 — Extraer sub-componentes en pantallas críticas
- [ ] PERF-006 — React.memo en CRTOverlay y otros
- [ ] PERF-007 — FlatList props en CatalogPortraitPicker
- [ ] PERF-010 — Gold counter con Reanimated
- [ ] PERF-011 — InteractionManager en VillageScreen
- [ ] PERF-012 — Early exit en GuildScreen portrait loop
