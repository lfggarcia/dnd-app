# ⚙️ Rendimiento — Auditoría RN

> **Severidad general:** 🟡 Media  
> **Archivos afectados:** 8  
> **Esfuerzo estimado:** 3–5 horas

---

## Resumen ejecutivo

La codebase muestra una buena adopción de `memo()`, `useCallback`, `useMemo` y `useNativeDriver: true` en animaciones. El patrón de lazy loading en `AppNavigator` para las pantallas pesadas es excelente. Los problemas principales son: (1) timers `setTimeout` sin cleanup en varias pantallas que pueden causar setState-after-unmount, y (2) el `FlatList` en `CatalogPortraitPicker` carece de `initialNumToRender`/`maxToRenderPerBatch` para un grid de imágenes potencialmente grande. `ScrollView` se usa extensivamente pero en pantallas con contenido fijo (no listas dinámicas largas), lo cual es aceptable.

---

## Hallazgos

### [PERF-001] `setTimeout` sin `clearTimeout` — posible setState-after-unmount
**Archivos:**
- `src/screens/NegotiationScreen.tsx` líneas 86, 90
- `src/screens/LevelUpScreen.tsx` línea 27
- `src/screens/GuildScreen.tsx` línea 435

**Severidad:** 🟡 Media — Puede causar warning "Can't perform a React state update on an unmounted component" y comportamiento inesperado si el usuario navega rápidamente  

**Código actual (problema) — NegotiationScreen.tsx:**
```tsx
// Sin useEffect, directamente en un handler
if (roll >= FLEE_DC) {
  setFleeResult('SUCCESS');
  setTimeout(() => navigation.goBack(), 1500);  // ← no hay cleanup
} else {
  setFleeResult('FAIL');
  setTimeout(() => {
    navigation.navigate('Battle', { ... });
  }, 1500);  // ← no hay cleanup
}
```

**Código actual (problema) — LevelUpScreen.tsx:**
```tsx
const handleConfirm = useCallback(() => {
  // ...
  setTimeout(() => navigation.goBack(), 1200);  // ← no hay cleanup
}, [...]);
```

**Por qué es un problema:**
Si el usuario navega hacia atrás manualmente antes de que el timer dispare, el callback intenta navegar o hacer setState sobre un componente ya desmontado. En React Native esto genera warnings y puede causar crashes en edge cases.

**Solución paso a paso — NegotiationScreen.tsx:**
```tsx
// Usar useRef para trackear el timer
const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// Limpiar en desmontaje
useEffect(() => {
  return () => {
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
  };
}, []);

const handleFlee = useCallback(() => {
  // ...
  if (roll >= FLEE_DC) {
    setFleeResult('SUCCESS');
    navTimerRef.current = setTimeout(() => navigation.goBack(), 1500);
  } else {
    setFleeResult('FAIL');
    navTimerRef.current = setTimeout(() => {
      navigation.navigate('Battle', { roomId: `rival_flee_${rivalName}`, roomType: 'ELITE' });
    }, 1500);
  }
}, [...]);
```

**Solución — LevelUpScreen.tsx:**
```tsx
const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);

const handleConfirm = useCallback(() => {
  // ...
  navTimerRef.current = setTimeout(() => navigation.goBack(), 1200);
}, [...]);
```

**Tiempo estimado:** 45 min (3 archivos)  
**Prioridad:** P2 — Puede generar crashes en sesiones rápidas de navegación

---

### [PERF-002] `FlatList` en `CatalogPortraitPicker` sin props de optimización de batch
**Archivo:** `src/components/party/CatalogPortraitPicker.tsx` líneas 141–153  
**Severidad:** 🟡 Media — Grid de imágenes potencialmente grande (~100+ items) sin virtualización optimizada  

**Código actual (problema):**
```tsx
<FlatList
  data={entries}
  keyExtractor={item => item.key}
  numColumns={3}
  contentContainerStyle={S.grid}
  renderItem={({ item }) => (
    <PortraitThumb ... />
  )}
  showsVerticalScrollIndicator={false}
  // ← faltan: initialNumToRender, maxToRenderPerBatch, windowSize, getItemLayout
/>
```

**Por qué es un problema:**
Con un catálogo de portraits que puede tener 50–200+ imágenes, sin `initialNumToRender` y `maxToRenderPerBatch`, React Native renderizará más items del necesario en el mount inicial, causando jank visible.

**Solución:**
```tsx
<FlatList
  data={entries}
  keyExtractor={item => item.key}
  numColumns={3}
  contentContainerStyle={S.grid}
  renderItem={({ item }) => (
    <PortraitThumb ... />
  )}
  showsVerticalScrollIndicator={false}
  initialNumToRender={12}      // 4 filas de 3 → visible inicial
  maxToRenderPerBatch={9}      // 3 filas por batch
  windowSize={5}               // 2.5x la pantalla visible en memoria
  removeClippedSubviews        // libera nodos fuera de pantalla
/>
```

**Tiempo estimado:** 15 min  
**Prioridad:** P2 — Mejora perceptible en dispositivos mid-range

---

### [PERF-003] `LogStrip` en `BattleScreen` re-renderiza el array de log completo
**Archivo:** `src/screens/BattleScreen.tsx` línea 348  
**Severidad:** 🟢 Baja — Rendimiento aceptable para logs de combate (~20 líneas máx), pero puede optimizarse  

**Código actual:**
```tsx
const LogStrip = memo(({ log }: { log: string[] }) => {
  // Renderiza todas las líneas en un ScrollView
  return (
    <ScrollView ...>
      {log.map((line, i) => (
        <Text key={i} ...>{line}</Text>
      ))}
    </ScrollView>
  );
});
```

**Por qué es un problema:**
El `log` crece durante el combate. Cada nuevo mensaje re-renderiza TODO el log (el memo protege de renders del padre, pero el array interno siempre cambia de referencia). La key `i` también es inestable.

**Solución:**
```tsx
const LogStrip = memo(({ log }: { log: string[] }) => {
  const flatRef = useRef<FlatList>(null);
  
  useEffect(() => {
    // Auto-scroll al último mensaje
    flatRef.current?.scrollToEnd({ animated: true });
  }, [log.length]);
  
  return (
    <FlatList
      ref={flatRef}
      data={log}
      keyExtractor={(_, i) => `log-${i}`}
      renderItem={({ item }) => <Text style={...}>{item}</Text>}
      initialNumToRender={8}
      maxToRenderPerBatch={5}
    />
  );
});
```

**Tiempo estimado:** 30 min  
**Prioridad:** P3 — Optimización menor; el log de combate raramente supera 20 líneas

---

### [PERF-004] Importación duplicada de `COMFY_HOST`/`COMFY_BASE_URL` en servicios
**Archivos:**
- `src/services/geminiImageService.ts` líneas 286–291
- `src/services/enemySpriteService.ts` líneas 69–74

**Severidad:** 🟢 Baja — Duplicación de lógica (no impacta rendimiento en runtime, pero aumenta riesgo de inconsistencia)  

**Por qué es un problema:**
Si se cambia el puerto de ComfyUI (actualmente 8089) hay que actualizarlo en dos archivos. No es un problema de rendimiento sino de mantenibilidad.

**Solución:**
Extraer a un módulo compartido `src/services/comfyConfig.ts`:
```ts
import { Platform } from 'react-native';

export const COMFY_HOST = Platform.select({
  android: '10.0.2.2',
  ios: '192.168.0.17',
  default: '192.168.0.17',
});
export const COMFY_BASE_URL = `http://${COMFY_HOST}:8089`;
export const POLL_INTERVAL_MS = 1500;
export const POLL_MAX_ATTEMPTS = 80;
```

**Tiempo estimado:** 20 min  
**Prioridad:** P3 — Refactor de mantenibilidad

---

## Lo que está bien ✅

- **Lazy loading** en `AppNavigator.tsx`: las 12 pantallas pesadas usan `React.lazy()` ✅
- **`useNativeDriver: true`** en todas las animaciones revisadas ✅
- **`memo()`** aplicado consistentemente en sub-componentes de `BattleScreen`, `PartyScreen`, `GuildScreen`, `CharacterDetailScreen` ✅
- **`useCallback` y `useMemo`** presentes en 175+ usos ✅
- **`FlatList` con `keyExtractor`** en `GlossaryModal` con `initialNumToRender` y `windowSize` ✅
- **No se usa Lodash ni librerías pesadas** para operaciones simples ✅

---

## Checklist de verificación

- [ ] PERF-001: `setTimeout` con cleanup en NegotiationScreen, LevelUpScreen, GuildScreen
- [ ] PERF-002: `FlatList` en CatalogPortraitPicker con props de optimización
- [ ] PERF-003: (Opcional) LogStrip migrado a FlatList
- [ ] PERF-004: (Opcional) Extraer config de ComfyUI a módulo compartido
