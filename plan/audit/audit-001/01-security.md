# 🔒 Seguridad — Auditoría TORRE (dnd3)

> **Severidad general:** 🟡 Media  
> **Archivos afectados:** 3  
> **Esfuerzo estimado:** 2-4 horas

---

## Resumen ejecutivo

La app no tiene credenciales hardcodeadas en el código fuente (bien), y el archivo `.env` está en `.gitignore`. Sin embargo, el mecanismo `react-native-dotenv` bunde la API key de Gemini/ComfyUI directamente en el bundle JS del app — cualquier usuario técnico puede extraerla del APK/IPA. No hay datos sensibles en AsyncStorage ni HTTP en lugar de HTTPS. El principal riesgo es la exposición de la API key.

---

## Hallazgos

### [SEC-001] API key de Gemini/ComfyUI bundleada en el JS bundle

> **Fuente:** 🤖 Auto-descubierto (BRF-006)

**Archivo(s):** `src/types/env.d.ts`, `src/services/geminiImageService.ts`, `src/services/enemySpriteService.ts`  
**Severidad:** 🟡 Media  
**Impacto:** La key `NANO_BANANA_API` se inyecta en el JS bundle en build time vía `react-native-dotenv`. Un atacante puede hacer `strings dnd3.apk | grep -A1 NANO_BANANA` o decompilar el JSBundle y encontrar la key. Si la key tiene cuota de pago, puede generarse un costo no autorizado.

**Evidencia:**
```ts
// src/types/env.d.ts
declare module '@env' {
  export const NANO_BANANA_API: string;
}
// La key llega al bundle desde .env en build time
```

**Por qué es un problema:**
`react-native-dotenv` no cifra las variables — las inline en el bundle. Es conveniente para desarrollo, pero inseguro para keys de pago en producción.

**Solución paso a paso:**

1. Crear un proxy backend (ej: Cloudflare Worker, Vercel Edge Function, Firebase Function) que reciba la petición del app, agregue la API key del lado del servidor, y reenvíe a Gemini/ComfyUI.

2. En el app, llamar al proxy en lugar de a la API directamente:
```ts
// Antes (key en bundle):
const response = await fetch(`https://api.gemini.com/...`, {
  headers: { Authorization: `Bearer ${NANO_BANANA_API}` }
});

// Después (key solo en server):
const response = await fetch('https://tu-proxy.workers.dev/gemini', {
  method: 'POST',
  body: JSON.stringify({ prompt })
});
```

3. Alternativamente, si el proxy no es viable, restringir la key por `bundle identifier` en el dashboard de la API (iOS: `com.tuempresa.torre`, Android: `com.tuempresa.torre`).

**Tiempo estimado:** 2-4 horas (proxy simple)  
**Prioridad:** P2 — Antes del release público

---

### [SEC-002] 15 casts `as React.ComponentType<object>` suprimen errores de tipos en navegación

> **Fuente:** 🤖 Auto-descubierto (BRF-007)

**Archivo(s):** `src/navigation/AppNavigator.tsx`  
**Severidad:** 🟢 Baja  
**Impacto:** No es un riesgo de seguridad directo, pero oculta posibles errores de tipado en parámetros de pantallas que podrían pasar datos inesperados.

**Evidencia:**
```tsx
<Stack.Screen name="Battle" component={BattleScreen as React.ComponentType<object>} />
```

**Solución:**
Tipar cada screen con `ScreenProps<'ScreenName'>` y eliminar los casts. Ver [ARCH-003] en `03-architecture.md`.

**Tiempo estimado:** 1-2 horas  
**Prioridad:** P3

---

## Checklist de verificación

- [ ] SEC-001: API key movida a proxy backend o restringida por bundle ID
- [ ] SEC-002: Casts de navegación eliminados (ver `03-architecture.md`)
