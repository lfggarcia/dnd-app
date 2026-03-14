# 🔒 Seguridad — Auditoría RN

> **Severidad general:** 🟡 Media  
> **Archivos afectados:** 4  
> **Esfuerzo estimado:** 2–3 horas

---

## Resumen ejecutivo

No se encontraron API keys ni tokens hardcodeados en el código fuente. El `.gitignore` protege correctamente el `.env`. El riesgo principal es la habilitación de `cleartext traffic` en Android y la presencia de IPs locales hardcodeadas en dos servicios de imagen, lo que es aceptable en desarrollo pero peligroso si se publica la app. Uno de los `console.warn` (en `VillageScreen`, `BlacksmithScreen`, `MarketScreen`) no está protegido por `__DEV__`.

---

## Hallazgos

### [SEG-001] `usesCleartextTraffic: true` en AndroidManifest.xml
**Archivo:** `android/app/src/main/AndroidManifest.xml` línea 12  
**Severidad:** 🟡 Media — Permite tráfico HTTP plano en Android, potencial interceptación en red abierta  
**Impacto:** Cualquier build (incluyendo release) puede enviar datos vía HTTP sin cifrado.

**Código actual (problema):**
```xml
android:usesCleartextTraffic="true"
```

**Por qué es un problema:**
Esta flag aplica en modo release. Las llamadas a `http://10.0.2.2:8089` (ComfyUI) son intencionalmente locales en desarrollo, pero si esta flag se deja activa en un release build y en el futuro se agregan otros endpoints HTTP, quedarían expuestos.

**Solución paso a paso:**

1. Crear un `network_security_config.xml` para restringir cleartext solo a hosts locales:
```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">10.0.2.2</domain>
        <domain includeSubdomains="false">192.168.0.17</domain>
        <domain includeSubdomains="false">localhost</domain>
    </domain-config>
    <base-config cleartextTrafficPermitted="false" />
</network-security-config>
```

2. Referenciar el config en `AndroidManifest.xml`:
```xml
<application
  android:networkSecurityConfig="@xml/network_security_config"
  <!-- eliminar android:usesCleartextTraffic="true" -->
  ...>
```

**Tiempo estimado:** 30 min  
**Prioridad:** P2 — Hacer antes del primer release público

---

### [SEG-002] IPs locales hardcodeadas en servicios de imagen
**Archivos:**
- `src/services/geminiImageService.ts` líneas 286–291
- `src/services/enemySpriteService.ts` líneas 69–74

**Severidad:** 🟢 Baja — No representa riesgo de seguridad inmediato (son IPs LAN privadas), pero dificulta la configuración entre devs  

**Código actual (problema):**
```ts
const COMFY_HOST = Platform.select({
  android: '10.0.2.2',
  ios: '192.168.0.17',   // IP de la máquina de desarrollo hardcodeada
  default: '192.168.0.17',
});
const COMFY_BASE_URL = `http://${COMFY_HOST}:8089`;
```

**Por qué es un problema:**
La IP `192.168.0.17` es específica de la máquina del desarrollador. Otro desarrollador con una IP diferente tendrá que editar código para hacer funcionar la generación de imágenes.

**Solución paso a paso:**

1. Agregar al `.env` (ya existe):
```
COMFY_HOST_IOS=192.168.0.17
COMFY_HOST_ANDROID=10.0.2.2
```

2. Declarar en `src/types/env.d.ts`:
```ts
declare module '@env' {
  export const NANO_BANANA_API: string;
  export const COMFY_HOST_IOS: string;
  export const COMFY_HOST_ANDROID: string;
}
```

3. Actualizar ambos servicios:
```ts
import { COMFY_HOST_IOS, COMFY_HOST_ANDROID } from '@env';

const COMFY_HOST = Platform.select({
  android: COMFY_HOST_ANDROID ?? '10.0.2.2',
  ios: COMFY_HOST_IOS ?? '192.168.0.17',
  default: COMFY_HOST_IOS ?? '192.168.0.17',
});
```

**Tiempo estimado:** 20 min  
**Prioridad:** P3 — Mejora de configurabilidad

---

### [SEG-003] `console.warn` sin guarda `__DEV__` en pantallas de producción
**Archivos:**
- `src/screens/VillageScreen.tsx` línea 176
- `src/screens/BlacksmithScreen.tsx` línea 69
- `src/screens/MarketScreen.tsx` líneas 101, 110

**Severidad:** 🟢 Baja — No expone datos sensibles (solo errores de equip/buy/sell), pero genera ruido en producción  

**Código actual (problema):**
```ts
} catch (e) { console.warn('Equip failed', e); }
} catch (e) { console.warn('Buy failed', e); }
} catch (e) { console.warn('Sell failed', e); }
```

**Por qué es un problema:**
En un build de producción, estos `console.warn` pueden aparecer en logs accesibles con herramientas de debugging. Podrían exponer mensajes de error internos.

**Solución:**
```ts
} catch (e) { if (__DEV__) console.warn('Equip failed', e); }
```

**Tiempo estimado:** 10 min  
**Prioridad:** P3 — Limpieza menor

---

## Checklist de verificación

- [ ] SEG-001: `network_security_config.xml` creado y `usesCleartextTraffic` eliminado
- [ ] SEG-002: IPs ComfyUI movidas a `.env`
- [ ] SEG-003: `console.warn` en pantallas protegidos con `__DEV__`
