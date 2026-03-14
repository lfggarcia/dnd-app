# 🔒 Seguridad — Auditoría RN

> **Severidad general:** 🟡 Media  
> **Archivos afectados:** 8  
> **Esfuerzo estimado:** 3-4 horas

---

## Resumen ejecutivo
La app es offline-first y no maneja datos de usuario sensibles (sin auth, sin pagos). Los riesgos principales son: una API key inactiva que podría activarse en el futuro sin protección, servicios dev-only (ComfyUI) con IPs hardcodeadas que se bundlean en producción, y `console.warn` sin `__DEV__` guard que pueden filtrar stack traces.

---

## Hallazgos

### [SEG-001] API key declarada en .env se bundlea via react-native-dotenv
**Archivo(s):** `babel.config.js` L6-12, `src/types/env.d.ts` L1-3, `.env`  
**Severidad:** 🟡 Media (actualmente no se importa `@env` en ningún archivo — riesgo latente)  
**Impacto:** Si alguien agrega `import { NANO_BANANA_API } from '@env'`, la key se incrusta en el bundle.

**Configuración actual (problema):**
```js
// babel.config.js
['module:react-native-dotenv', {
  moduleName: '@env',
  blacklist: null,   // nada excluido
  whitelist: null,   // todo incluido
  safe: false,
  allowUndefined: true,
}]
```

**Por qué es un problema:**
La infraestructura está lista para exponer secrets — solo falta un `import`. Es una trampa para futuros devs.

**Solución paso a paso:**
1. Dado que `@env` no se importa en ningún archivo, **eliminar react-native-dotenv** de babel.config.js y devDependencies.
2. Eliminar `src/types/env.d.ts`.
3. Si en el futuro se necesitan env vars, usar `whitelist` para exponer solo las no-sensibles.

**Tiempo estimado:** 15 min  
**Prioridad:** P2 — Hacer antes de primera release pública

---

### [SEG-002] IPs LAN hardcodeadas en servicios ComfyUI
**Archivo(s):** `src/services/geminiImageService.ts` L286-291, `src/services/enemySpriteService.ts` L69-74  
**Severidad:** 🟡 Media  
**Impacto:** La IP `192.168.0.17` y `10.0.2.2` se bundlean en producción. Expone topología de red del dev.

**Código actual (problema):**
```ts
const COMFY_HOST = Platform.select({
  android: '10.0.2.2',
  ios: '192.168.0.17',
  default: '192.168.0.17',
});
const COMFY_BASE_URL = `http://${COMFY_HOST}:8089`;
```

**Solución paso a paso:**
1. Agregar guard `__DEV__` al inicio de cada función pública de ComfyUI:
```ts
export async function generatePortrait(...) {
  if (!__DEV__) return null; // ComfyUI es dev-only
  // ...resto de la función
}
```
2. Mover host a `.env` si se desea: `COMFYUI_HOST=192.168.0.17`

**Tiempo estimado:** 30 min  
**Prioridad:** P2

---

### [SEG-003] Peticiones HTTP (sin HTTPS) a ComfyUI
**Archivo(s):** `src/services/geminiImageService.ts` L291, `src/services/enemySpriteService.ts` L74  
**Severidad:** 🟡 Media (dev-only en la práctica)  
**Impacto:** 8+ fetch calls sobre HTTP sin cifrado. ATS de iOS requiere excepción.

**Solución:** Mismo fix que SEG-002 — gating con `__DEV__` resuelve ambos issues.

**Tiempo estimado:** Incluido en SEG-002  
**Prioridad:** P2

---

### [SEG-004] URL de API externa hardcodeada
**Archivo(s):** `src/services/api5e.ts` L1  
**Severidad:** 🟢 Baja  
**Impacto:** Si `dnd5eapi.co` cambia dominio, requiere release nueva para actualizar.

```ts
const BASE_URL = 'https://www.dnd5eapi.co/api/2014';
```

**Solución:** Convertir en constante con comentario de por qué está fija. Aceptable para un API pública estable.

**Tiempo estimado:** 5 min  
**Prioridad:** P3

---

### [SEG-005] console.warn sin __DEV__ guard en producción
**Archivo(s):** `src/screens/VillageScreen.tsx` L176, `src/screens/BlacksmithScreen.tsx` L69, `src/screens/MarketScreen.tsx` L101, L110  
**Severidad:** 🟡 Media  
**Impacto:** `console.warn` NO se elimina en builds de producción con Hermes. Puede filtrar stack traces y estado interno.

**Código actual (problema):**
```ts
} catch (e) { console.warn('Equip failed', e); }
```

**Solución:**
```ts
} catch (e) { __DEV__ && console.warn('Equip failed', e); }
```

**Tiempo estimado:** 10 min (4 archivos)  
**Prioridad:** P1

---

### [SEG-006] __DEV__ bypass de economía de juego (revive gratis)
**Archivo(s):** `src/screens/VillageScreen.tsx` L155-161, L415  
**Severidad:** 🟢 Baja (solo activo en desarrollo)  
**Impacto:** En dev, el revive es gratis y resetea deathCount a 0. `__DEV__` es false en producción.

**Solución:** Aceptable como debug tool. Documentar con comentario `// DEBUG: free revive for testing`.

**Tiempo estimado:** 5 min  
**Prioridad:** P3

---

### [SEG-009] JSON.parse sin try/catch en datos de DB
**Archivo(s):** `src/services/translationBridge.ts` L23, `src/hooks/useResources.ts` L57, `src/components/GlossaryModal.tsx` L254, `src/database/eventRepository.ts` L94, `src/database/itemRepository.ts` L75, `src/database/rivalRepository.ts` L80-81  
**Severidad:** 🟡 Media  
**Impacto:** JSON corrupto en SQLite crashea la app sin recovery. Los repositorios del `gameRepository.ts` ya tienen protección (catch con fallback), pero 6 otros sitios no.

**Solución paso a paso:**
1. Crear helper en `src/utils/`:
```ts
export function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; }
  catch { return fallback; }
}
```
2. Reemplazar `JSON.parse(row.data)` → `safeParse(row.data, {})` en los 6 archivos.

**Tiempo estimado:** 30 min  
**Prioridad:** P1 — Previene crashes en producción

---

## Checklist de verificación
- [ ] SEG-001 — react-native-dotenv removido
- [ ] SEG-002 — ComfyUI gated con __DEV__
- [ ] SEG-003 — (resuelto con SEG-002)
- [ ] SEG-004 — Documentado
- [ ] SEG-005 — console.warn con __DEV__ guard
- [ ] SEG-006 — Documentado
- [ ] SEG-009 — safeParse implementado
