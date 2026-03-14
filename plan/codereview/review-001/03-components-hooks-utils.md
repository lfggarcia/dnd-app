# Code Review — Components, Hooks, i18n & Utils
**Review:** review-001 | **Fecha:** 2026-03-14  
**Archivos revisados:** 16 archivos (components, hooks, i18n, utils, remaining services)

---

## [src/components/CRTOverlay.tsx]

### CR-060: Missing `cancelAnimation` cleanup — Reanimated worklet huérfano
**Severidad:** 🔴 Alta  
**Problema:** `useEffect` inicia `withRepeat(..., -1, true)` pero la cleanup no llama `cancelAnimation`. En navigators con remounting frecuente, los worklets huérfanos se acumulan en el hilo UI.

```tsx
// FIX:
import { cancelAnimation } from 'react-native-reanimated';

useEffect(() => {
  flicker.value = withRepeat(withSequence(...), -1, true);
  return () => cancelAnimation(flicker);
}, []);
```

---

## [src/components/TypewriterText.tsx]

### CR-061: Cursor blink se detiene permanentemente al reutilizar el componente
**Severidad:** 🟡 Media  
**Problema:** El `useEffect` del cursor solo depende de `[showCursor]`. Cuando `text` cambia (componente reutilizado), el cursor timer previo fue destruido y `[showCursor]` no cambia → cursor congelado mientras se escribe el nuevo texto.

```tsx
// FIX: añadir text a las deps del cursor effect
}, [showCursor, text]);
```

---

## [src/components/DatabaseGate.tsx]

### CR-062: `syncNow` ausente en deps del `useEffect` auto-sync
**Severidad:** 🟡 Media  
**Problema:** `syncNow` es un `useCallback([status])` en `useDatabase` — cambia de referencia cada vez que `status` cambia. El efecto cierra sobre la versión anterior (stale).

```tsx
// FIX:
}, [status, syncStatus, syncNow]);
```

---

## [src/components/TutorialOverlay.tsx]

### CR-063: Shared values de Reanimated no canceladas al desmontar abruptamente
**Severidad:** 🟡 Media  
**Problema:** Si el `Modal` se desmonta sin pasar por `visible=false`, el `withTiming` en curso sigue corriendo en el UI thread sin cleanup.

```tsx
// FIX:
useEffect(() => {
  if (visible) {
    cardOpacity.value = withTiming(1, { duration: 250 });
    cardScale.value = withTiming(1, { duration: 300 });
  } else {
    cardOpacity.value = 0;
    cardScale.value = 0.92;
  }
  return () => {
    cancelAnimation(cardOpacity);
    cancelAnimation(cardScale);
  };
}, [visible]);
```

---

## [src/components/GlossaryModal.tsx]

### CR-064: `useEffect` de carga DB se dispara aunque el modal esté oculto
**Severidad:** 🟡 Media  
**Problema:** Las deps son `[activeCategory, lang]` pero no `visible`. Cambiar idioma con el modal cerrado ejecuta DB querys y setters innecesariamente. Cuando el modal se abre sin cambiar `activeCategory`, se muestran datos potencialmente stale.

```tsx
// FIX: añadir visible a deps con early-return
useEffect(() => {
  if (!visible) return;
  // ...lógica de carga...
}, [activeCategory, lang, visible]);
```

---

## [src/components/party/CatalogPortraitPicker.tsx]

### CR-065: `FlatList` sin `getItemLayout`, `windowSize` ni `maxToRenderPerBatch`
**Severidad:** 🟡 Media  
**Problema:** Con `numColumns={3}` y 30-100 retratos, RN debe medir cada celda. Sin hints, todos los items fuera de pantalla se montan de golpe en el primer render.

```tsx
// FIX:
const ITEM_HEIGHT = THUMB_SIZE + 8;
<FlatList
  getItemLayout={(_, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * Math.floor(index / 3),
    index,
  })}
  windowSize={5}
  maxToRenderPerBatch={12}
  initialNumToRender={12}
  // ...resto de props
/>
```

---

## [src/services/imageStorageService.ts]

### CR-066: Race condition — nombres de archivo temp colisionan en `saveExpressionsToFS`
**Severidad:** 🔴 Alta  
**Problema:** `saveExpressionsToFS` usa `Promise.all` para 12 expresiones en paralelo. Dentro de `savePortraitToFS`, el path temp es `${dir}/${characterId}_tmp_${Date.now()}.jpg`. `Date.now()` tiene resolución de **1ms** — múltiples llamadas simultáneas obtendrán el mismo timestamp y sobreescribirán el mismo archivo temp. Las expresiones resultantes quedan corruptas o faltantes.

```ts
// FIX: incluir expressionKey en el nombre del temp
const suffix = expressionKey ?? 'base';
const tempPath = `${dir}/${characterId}_tmp_${suffix}.jpg`;
```

---

## [src/i18n/context.tsx]

### CR-067: Tipo `any` en la función `t()` — anula type-checking de keys
**Severidad:** 🟡 Media  
**Problema:** `let value: any = translations[lang]` viola la regla "No `any` types" del proyecto. `t('clave.inexistente')` falla en runtime sin advertencia del compilador.

```tsx
// FIX: tipar con la forma del objeto de traducciones
type DeepString = { [key: string]: string | DeepString };
let value: DeepString | string | undefined = translations[lang];
```

---

## [src/hooks/useResources.ts]

### CR-068: `mountedRef` compartido es frágil ante requests concurrentes
**Severidad:** 🟡 Media  
**Problema:** Cuando `indexKey` cambia muy rápido, N requests async están en vuelo. Todas comprueban `mountedRef.current` que ya fue reseteado a `true` por la invocación más reciente. Respuestas de requests anteriores pasarán el check y actualizarán el estado con datos del item anterior.

```ts
// FIX: reemplazar por AbortController por invocación
useEffect(() => {
  if (!indexKey) { setData(null); setLoading(false); return; }
  const controller = new AbortController();
  setLoading(true);
  const loadDetail = async () => {
    try {
      let resource = getResource(endpoint, indexKey);
      if (!resource) {
        await syncEndpoint(endpoint);
        resource = getResource(endpoint, indexKey);
      }
      if (controller.signal.aborted) return;
      setData(resource ?? null);
    } catch (err) {
      if (!controller.signal.aborted) setError(String(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  loadDetail();
  return () => controller.abort();
}, [endpoint, indexKey, lang]);
```

---

## [src/hooks/usePartyRoster.ts]

### CR-069: Operaciones pesadas async sin guard de desmontaje en `handleGeneratePortrait`
**Severidad:** 🟢 Baja  
**Problema:** La cadena generate → compress → save FS → generate expressions → save expressions continúa si el usuario navega fuera. Setters se ejecutan sobre componente desmontado + trabajo de compresión de imágenes innecesario.

```ts
// FIX: unmountedRef o AbortController
const mountedRef = useRef(true);
useEffect(() => () => { mountedRef.current = false; }, []);
// En cada setter dentro del handler:
if (!mountedRef.current) return;
setCharPortraits(prev => ({ ...prev, [activeSlot]: localUri }));
```

---

## [src/services/aiProfileEngine.ts]

### CR-070: Log de adopción de profile semánticamente incorrecto
**Severidad:** 🟢 Baja  

```ts
// FIX:
console.log(
  `[aiProfileEngine] ${memory.partyName} adopts profile "${neighborProfiles[idx]}" from ${adoptFrom} at cycle ${cycle}`,
);
```

---

## Resumen

| ID | Archivo | Severidad |
|---|---|---|
| CR-060 | CRTOverlay.tsx | 🔴 Alta |
| CR-066 | imageStorageService.ts | 🔴 Alta |
| CR-061 | TypewriterText.tsx | 🟡 Media |
| CR-062 | DatabaseGate.tsx | 🟡 Media |
| CR-063 | TutorialOverlay.tsx | 🟡 Media |
| CR-064 | GlossaryModal.tsx | 🟡 Media |
| CR-065 | CatalogPortraitPicker.tsx | 🟡 Media |
| CR-067 | i18n/context.tsx | 🟡 Media |
| CR-068 | useResources.ts | 🟡 Media |
| CR-069 | usePartyRoster.ts | 🟢 Baja |
| CR-070 | aiProfileEngine.ts | 🟢 Baja |
