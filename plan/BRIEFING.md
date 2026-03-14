# BRIEFING — TORRE (dnd3)

**Generado:** 2026-03-14  
**Fuente:** 🤖 Auto-descubierto — `rn-discover`  
**Proyecto:** React Native 0.84.0 | Zustand | op-sqlite | NativeWind | React Navigation 7

---

## Resumen del proyecto

- **104 archivos** TypeScript/TSX en `src/`
- **25,403 líneas** de código
- **23 pantallas**, todas registradas en el stack de navegación
- **1,360 imágenes** locales (1.3 GB total en `assets/`)
- Stack: RN 0.84 + Hermes, Zustand, op-sqlite, NativeWind 4, Skia, Reanimated 4

---

### [BRF-001] Assets locales de 1.3 GB — excede límites de stores

**Área:** Assets / Bundle  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🔴 Alta  
**Impacto:** Bloquea aprobación en App Store (100 MB APK / 25 MB OTA). El bundle final será enorme.

**Evidencia encontrada:**
```
assets/           1.3 GB total
  images/characters/  1.3 GB  (1,288 imágenes PNG en 14 dirs)
  images/monsters/    92 MB   (34 imágenes PNG en 36 dirs)
  fonts/              1.3 MB
```
Cada imagen de monstruo/personaje pesa ~2.7-2.9 MB (PNG sin optimizar).

**Archivos afectados:** 1,360 imágenes  
**Lo que hay que hacer:**  
- Comprimir PNGs (tinypng/pngquant) → ~70-80% reducción
- Considerar mover imágenes a CDN y cargar on-demand
- Evaluar WebP como formato alternativo
- Para MVP: al menos reducir resolución a tamaño pantalla móvil

---

### [BRF-002] Strings hardcodeados en español sin i18n en 12+ pantallas

**Área:** i18n  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🟡 Media  
**Impacto:** App no internacionalizable. Mezcla español hardcodeado con sistema i18n existente (es.ts/en.ts).

**Evidencia encontrada:**
- `VillageScreen.tsx`: "RESURRECCIÓN", "TODOS LOS MIEMBROS ESTÁN VIVOS", "INICIAR NUEVA TEMPORADA"
- `BattleScreen.tsx`: "DEFEATED", "KO", "DESERCIÓN", "ACCIÓN TÁCTICA", "TURNO ENEMIGO..."
- `MapScreen.tsx`: "DESCENDIENDO", "Explorando territorio desconocido..."
- `ExtractionScreen.tsx`: "EL MUNDO CONTINÚA SIN TI...", "SIN ÍTEMS"
- `BlacksmithScreen.tsx`: "HERRERÍA", "Mejora el equipo aumentando su rareza"
- `MarketScreen.tsx`: "MERCADO", "SIN STOCK", "INVENTARIO VACÍO"
- `GuildScreen.tsx`: "HOLD: GENERAR", "RNK", "ALI", "MIS", "LOG"
- `DatabaseGate.tsx`: "ERROR DE BASE DE DATOS", "⚔ TORRE ⚔"

**Archivos afectados:** 12+ archivos  
**Lo que hay que hacer:**  
Extraer todos los strings a los archivos de traducción existentes (`src/i18n/translations/es.ts` y `en.ts`) y usar la función `t()` del sistema i18n.

---

### [BRF-003] Sin ErrorBoundary — la app puede crashear sin recuperación

**Área:** Arquitectura  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🔴 Alta  
**Impacto:** Cualquier error de render crashea la app completa sin pantalla de fallback.

**Evidencia encontrada:**
```bash
grep -rn 'ErrorBoundary\|componentDidCatch' src/  → 0 resultados
```

**Archivos afectados:** App.tsx (root)  
**Lo que hay que hacer:**  
Crear un ErrorBoundary component y envolverlo en el root de la app. Mostrar pantalla de "algo salió mal" con opción de reiniciar.

---

### [BRF-004] API key de Google expuesta en .env

**Área:** Seguridad  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🟡 Media  
**Impacto:** Aunque `.env` está en `.gitignore`, la key (patrón `AIzaSy*`) se bundlea en el JS — extraíble por reverse-engineering del APK.

**Evidencia encontrada:**
```
.env → NANO_BANANA_API=AIzaSy...
```
La variable se usa en el código y termina en el bundle de Hermes.

**Archivos afectados:** .env, código que consume la variable  
**Lo que hay que hacer:**  
- Para app offline/local: aceptar el riesgo documentándolo
- Para producción: usar server proxy o firebase app check

---

### [BRF-005] BattleScreen.tsx tiene 1,571 líneas — archivo masivo

**Área:** Arquitectura / Mantenibilidad  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🟡 Media  
**Impacto:** Archivo difícil de mantener, depurar y testear. Riesgo de re-renders innecesarios.

**Evidencia encontrada:**
```
src/screens/BattleScreen.tsx     1,571 líneas
src/screens/CharacterDetailScreen.tsx  1,279 líneas
src/screens/PartyScreen.tsx        923 líneas
src/screens/MapScreen.tsx          769 líneas
src/screens/GuildScreen.tsx        762 líneas
```

**Lo que hay que hacer:**  
Extraer hooks custom (useBattleLogic, useBattleAnimations) y sub-componentes (BattleHUD, TurnIndicator, etc.).

---

### [BRF-006] Mezcla de StyleSheet.create e inline styles con NativeWind

**Área:** Arquitectura / Convenciones  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🟢 Baja  
**Impacto:** Inconsistencia de estilos dificulta mantener un sistema de diseño unificado.

**Evidencia encontrada:**
```
StyleSheet.create: 15 archivos
className= (NativeWind): 601 usos
inline style={{ }}: extensivo en VillageScreen, CharacterDetailScreen, etc.
```

**Lo que hay que hacer:**  
Elegir un patrón principal (NativeWind ya es el dominante) y migrar gradualmente los StyleSheet.create restantes.

---

### [BRF-007] Casts `as React.ComponentType<object>` en 12 rutas de navegación

**Área:** TypeScript  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🟡 Media  
**Impacto:** Estos casts ocultan problemas de tipado. Las props de las pantallas no se validan en compile time.

**Evidencia encontrada:**
12 de 23 pantallas usan `as React.ComponentType<object>` en el navigation stack.

**Lo que hay que hacer:**  
Tipar correctamente `RootStackParamList` en React Navigation 7 y eliminar los casts.

---

### [BRF-008] Uso de `as any` en 13+ puntos del código

**Área:** TypeScript  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🟢 Baja  
**Impacto:** Pérdida de seguridad de tipos. La mayoría concentrada en GlossaryModal.tsx (6 usos) y FormData uploads (2 usos).

**Evidencia encontrada:**
- `GlossaryModal.tsx`: 6× `as any[]` / `as any` para datos raw de DnD 5e
- `geminiImageService.ts`: 1× `(formData as any).append`
- `enemySpriteService.ts`: 1× `(formData as any).append`
- `VillageScreen.tsx`: 1× `navigation.navigate(screen as any)`
- `CharacterDetailScreen.tsx`: 1× percentage cast
- `i18n/context.tsx`: 1× dynamic translation access

**Lo que hay que hacer:**  
Crear tipos para datos DnD 5e raw. El FormData issue es un workaround conocido de RN — aceptable.

---

### [BRF-009] console.log en producción — 12 instancias (todas __DEV__ gated)

**Área:** Calidad  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🟢 Baja  
**Impacto:** Ninguno en producción ya que todas están protegidas con `__DEV__ &&`.

**Evidencia encontrada:**
- `geminiImageService.ts`: 8× (ComfyUI debug logs)
- `aiProfileEngine.ts`: 1× (adoption debug)
- `enemySpriteService.ts`: 3× (sprite generation debug)

**Lo que hay que hacer:**  
No requiere acción inmediata. Considerar un logger configurable a futuro.

---

## Resumen

| Severidad | Issues |
|---|---|
| 🔴 Alta | 2 (BRF-001, BRF-003) |
| 🟡 Media | 4 (BRF-002, BRF-004, BRF-005, BRF-007) |
| 🟢 Baja | 3 (BRF-006, BRF-008, BRF-009) |
