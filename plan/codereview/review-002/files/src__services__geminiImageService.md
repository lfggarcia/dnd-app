# Code Review: `src/services/geminiImageService.ts`

**Revisado:** 2026-03-14  
**Líneas de código:** 606  
**Severidad general:** 🟡 Observaciones menores  
**Comentarios:** 4 observaciones (1🔴 nombre incorrecto, 1🟡 as any, 2✅)

---

## Resumen

Este servicio orquesta la generación de retratos e imágenes de expresión de personajes vía
**ComfyUI** (flujo local de Stable Diffusion, modelo `perfectdeliberate_v8`). El nombre del
archivo es incorrecto — **no usa Gemini API** en ninguna parte. Contiene prompt builders,
workflow JSON builders para ComfyUI, y el polling HTTP para obtener el resultado.
La migración a ComfyUI fue completa pero el nombre del archivo no se actualizó.

---

## [CR-037] Nombre del archivo incorrecto — contiene `gemini` pero es ComfyUI 🔴

> **Tipo:** Naming / Mantenibilidad  
> **Severidad:** 🔴 Alta (genera confusión sobre seguridad)

**Problema:**
```
src/services/geminiImageService.ts  ← nombre mentiroso
```

El archivo **no contiene ninguna llamada a la API de Gemini**. La función se llama con
`COMFY_BASE_URL` (localhost o LAN), es un modelo local, no hay API key en ninguna parte.
Esto también invalida el finding `SEC-001` del audit (que asumía API key de Gemini en el bundle).

**Impacto real de SEC-001:** No hay API key de Gemini — el finding del audit fue incorrecto.
El servicio apunta a un servidor ComfyUI local (seguro por diseño, solo funciona en dev/LAN).

**Propuesta:**
```
// Renombrar a:
src/services/comfyImageService.ts

// Actualizar imports en:
src/screens/CharacterDetailScreen.tsx    (línea 25)
src/screens/GuildScreen.tsx              (línea 22)
src/screens/PartyScreen.tsx              (línea 35)
src/hooks/usePartyRoster.ts              (línea 19)
```

**Nota:** El comentario en `PartyScreen.tsx` línea 283 dice `"Fallback: live generation via Gemini/ComfyUI"` — también desactualizado.

---

## [CR-038] `(formData as any).append(...)` — SEC-002 verificado 🟡

> **Línea:** ~454  
> **Tipo:** TypeScript / Type Safety  
> **Referencia audit:** SEC-002, TS-001

```ts
// React Native FormData pseudo-file pattern: pass the data URI as the image source
(formData as any).append('image', {
  uri: base64DataUri,
  name: 'portrait_upload.png',
  type: 'image/png',
});
```

**Problema:** El `as any` es necesario porque el tipo estándar `FormData` de TypeScript no
incluye el patrón de archivo de React Native (`{ uri, name, type }`). Sin embargo, el cast
silencia errores relacionados.

**Propuesta — type assertion mínima en lugar de `any`:**
```ts
type RNFormDataValue = { uri: string; name: string; type: string };
(formData as FormData & { append(name: string, value: RNFormDataValue): void }).append('image', {
  uri: base64DataUri,
  name: 'portrait_upload.png',
  type: 'image/png',
});
```

O más simple, declarar una interfaz una vez:
```ts
interface RNFormData extends FormData {
  append(name: string, value: { uri: string; name: string; type: string }): void;
}
const formData = new FormData() as RNFormData;
formData.append('image', { uri: base64DataUri, name: 'portrait_upload.png', type: 'image/png' });
```

**Prioridad:** P3 — No es un riesgo real (este es un endpoint local), pero mejora type safety.

---

## [CR-039] `console.log` usa `__DEV__` correctamente ✅

> **Tipo:** Positivo  
> **Referencia audit:** ARCH-004

```ts
__DEV__ && console.log('[ComfyUI] Queuing portrait for:', char.name, '| seed:', seed);
__DEV__ && console.log('[ComfyUI] Prompt queued:', promptId);
__DEV__ && console.log('[ComfyUI] Image ready:', filename);
```

Todos los `console.log` están detrás de `__DEV__`. No hay logs escapando a producción.
Este archivo es un ejemplo positivo del patrón correcto (vs `aiProfileEngine.ts` línea 163
que no usa `__DEV__`, ref ARCH-004).

---

## [CR-040] Polling sin abort — POLL_MAX_ATTEMPTS cubre el timeout ✅

> **Tipo:** Análisis de robustez

```ts
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 80;
// → 80 × 1500ms = 120s máximo
```

El loop de polling fallará con `throw new Error('[ComfyUI] Timeout ...')` después de 120s.
No hay `AbortController`, pero tampoco hay riesgo de memory leak porque la función es `async`
y el error se captura en los `try/catch` de PartyScreen y CharacterDetailScreen. Correcto.

---

## Patrones positivos adicionales

- ✅ Tipos bien definidos: `CharacterPortraitInput`, `ComfyPromptResponse`, `ComfyHistoryEntry`, `ComfyUploadResponse`
- ✅ `buildCharacterPrompt` y `buildExpressionPrompt` son funciones puras — fáciles de testear
- ✅ `EXPRESSION_PRESETS` exportado — permite que `CharacterDetailScreen` acceda a las claves de expresión sin reimplementar
- ✅ 606 líneas justificadas: ~200 de datos (prompt maps, EXPRESSION_PRESETS), ~200 de workflow JSON, ~200 de lógica de polling. Alta densidad de datos, no code smell.
- ✅ Detección de plataforma para COMFY_HOST con `Platform.select` — correcto para emulador Android vs iOS vs físico
