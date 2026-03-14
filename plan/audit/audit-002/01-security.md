# 🔒 Seguridad — Auditoría TORRE (dnd3) — audit-002

> **Severidad general:** 🟡 Media  
> **Archivos afectados:** 3  
> **Esfuerzo estimado:** 2-4 horas  
> **Fecha:** 2026-03-14

---

## Resumen ejecutivo

El estado de seguridad es equivalente al detectado en audit-001. La API key de Gemini/ComfyUI
sigue bundleada en el JS bundle vía `react-native-dotenv` — este es el único riesgo real de
seguridad activo. No hay SQL injection posible (queries via op-sqlite con paramerizacion),
no hay datos sensibles en AsyncStorage, y el `.env` está en `.gitignore`. La única mejora
necesaria es mover la key a un proxy backend.

---

## Hallazgos

### [SEC-001] API key de Gemini/ComfyUI bundleada en el JS bundle

> **Fuente:** 🤖 Auto-descubierto (BRF-006) — confirmado sin cambios

**Archivo(s):** `src/types/env.d.ts`, `src/services/geminiImageService.ts`, `src/services/enemySpriteService.ts`  
**Severidad:** 🟡 Media  
**Impacto:** La key `NANO_BANANA_API` se inyecta en el JS bundle en build time vía `react-native-dotenv`. Un atacante puede hacer `strings dnd3.apk | grep NANO_BANANA` o descompilar el JSBundle y encontrar la key. Si la key tiene cuota de pago, puede generarse un costo no autorizado.

**Evidencia:**
```ts
// src/types/env.d.ts
declare module '@env' {
  export const NANO_BANANA_API: string;
}
```

**Por qué es un problema:**
`react-native-dotenv` transpila las variables de entorno como literales de string en el bundle JS. A diferencia del backend, el bundle JS de una app mobile es accesible a cualquier persona con el APK/IPA.

**Solución paso a paso:**

1. Crear un endpoint serverless (Cloudflare Workers, Vercel Function, o similar):
```js
// worker.js — proxy para Gemini/ComfyUI
export default {
  async fetch(request, env) {
    // Validar origen (bundle ID, token de sesión, etc.)
    const body = await request.json();
    const response = await fetch('https://api.gemini.../generate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.NANO_BANANA_API}` },
      body: JSON.stringify(body),
    });
    return response;
  }
};
```

2. En la app, llamar al proxy en lugar de directo a Gemini:
```ts
// src/services/geminiImageService.ts
const PROXY_URL = 'https://your-worker.workers.dev/generate';
// Eliminar import { NANO_BANANA_API } from '@env';
```

3. Eliminar `react-native-dotenv` de las dependencias si ya no se usa en ningún otro lugar:
```bash
yarn remove react-native-dotenv
```

**Tiempo estimado:** 2-3 horas  
**Prioridad:** P2 — Antes de publicar en stores

---

### [SEC-002] `FormData.append` con cast `as any` en requests multipart

**Archivo(s):** `src/services/geminiImageService.ts:455`, `src/services/enemySpriteService.ts:223`  
**Severidad:** 🟢 Baja  
**Impacto:** El cast silencia TypeScript, pero en React Native el objeto `FormData` acepta la sintaxis de blob object natively. No es un riesgo de seguridad directamente, pero oculta posibles errores de tipo en requests HTTP.

**Código actual (problema):**
```ts
// src/services/geminiImageService.ts:455
(formData as any).append('image', {
  uri: imageUri,
  type: 'image/jpeg',
  name: 'image.jpg'
});
```

**Solución:**
```ts
// React Native FormData acepta esta forma sin cast
formData.append('image', {
  uri: imageUri,
  type: 'image/jpeg',
  name: 'image.jpg',
} as unknown as Blob);
```

**Tiempo estimado:** 15 min  
**Prioridad:** P3 — Limpieza de código

---

## Checklist de verificación

- [ ] SEC-001: Proxy backend creado y desplegado
- [ ] SEC-001: App apunta al proxy (no a Gemini directamente)
- [ ] SEC-001: `NANO_BANANA_API` eliminada del bundle
- [ ] SEC-002: Casts `as any` en FormData reemplazados
