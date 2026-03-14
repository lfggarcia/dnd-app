# BRIEFING.md — TORRE (dnd3)
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Pipeline:** pipeline-001

---

## Resumen

| Severidad | Issues |
|---|---|
| 🔴 Alta | 3 |
| 🟡 Media | 5 |
| 🟢 Baja | 1 |

---

## Issues

### [BRF-001] Assets folder de 1.3 GB — 1322 imágenes de ~2-3 MB cada una

**Área:** Assets / Bundle Size  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🔴 Alta  
**Impacto:** Un IPA/APK con 1.3 GB de assets es inaprobable en ambas stores. El límite OTA de iOS es 25 MB y el APK base de Play Store es 150 MB (AAB). Incluso con asset delivery diferida, el tamaño indica que las imágenes no están optimizadas para mobile.

**Evidencia encontrada:**
```bash
du -sh assets/
# 1.3G    assets/
du -sh assets/*/
# 1.3G    assets/images/
# 1.3M    assets/fonts/
find assets/ -name "*.png" -o -name "*.jpg" | wc -l
# 1322
```

**Archivos afectados:** 1322 imágenes (principalmente `assets/images/monsters/*/illustration.png`)  
**Muestra representativa:**
- `assets/images/monsters/wight/illustration.png` — 2.9 MB  
- `assets/images/monsters/skeleton/illustration.png` — 2.9 MB  
- `assets/images/monsters/werewolf/illustration.png` — 2.8 MB  
*(Ver lista completa en `plan/discover/discover-001/BRF-001-assets.txt`)*

**Lo que hay que hacer:**
1. Comprimir todas las imágenes de monsters a JPEG/WebP ≤ 200 KB (pipeline con `sharp` o `squoosh`)
2. Reducir resolución de 2048px → 512px (suficiente para mobile)  
3. Evaluar si todas las 1322 imágenes deben estar en el bundle o si algunas pueden cargarse dinámicamente (download-on-demand)  
4. Usar Asset Delivery diferida (Play Asset Delivery / On-Demand Resources en iOS) para el catálogo completo de monsters

---

### [BRF-002] 2 suites de test fallan — `@op-engineering/op-sqlite` no mockeado en Jest

**Área:** Testing / CI  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🔴 Alta  
**Impacto:** CI roto. App.test.tsx y CampScreen.test.tsx no pueden ejecutarse porque el native module `op-sqlite` lanza `SyntaxError: Cannot use import statement outside a module` al ser importado por Jest.

**Evidencia encontrada:**
```bash
npm test 2>&1 | grep "FAIL\|PASS"
# FAIL __tests__/App.test.tsx      ← Test suite failed to run
# FAIL __tests__/CampScreen.test.tsx  ← Test suite failed to run

# Error raíz:
# SyntaxError: Cannot use import statement outside a module
# > 1 | import { open, type DB } from '@op-engineering/op-sqlite';
```

**`jest.config.js` actual:**
```js
transformIgnorePatterns: [
  'node_modules/(?!(@react-native|react-native|@react-navigation|nativewind|react-native-css-interop)/)',
],
// @op-engineering/op-sqlite no está en la whitelist ^ y tampoco tiene mock
```

**Archivos afectados:** `jest.config.js`, `jest.setup.js`  
**Lo que hay que hacer:**
1. Agregar `@op-engineering/op-sqlite` al `transformIgnorePatterns` whitelist, O
2. Agregar un mock manual en `jest.setup.js`:
```js
jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(() => ({
    execute: jest.fn(() => ({ rows: { _array: [] } })),
    executeAsync: jest.fn(() => Promise.resolve({ rows: { _array: [] } })),
    close: jest.fn(),
  })),
}));
```

---

### [BRF-003] Cobertura de tests crítica — 14.96% de branches, 27.61% de statements

**Área:** Testing  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🔴 Alta  
**Impacto:** Con < 15% de branch coverage, la mayoría del flujo de la app no tiene validación automática. Refactors y nuevas features no tienen red de seguridad.

**Evidencia encontrada:**
```
Coverage summary:
Statements   : 27.61% ( 193/699 )
Branches     : 14.96% ( 57/381 )
Functions    : 29.78% ( 42/141 )
Lines        : 29.15% ( 172/590 )
```

**Archivos sin cobertura (representativa):** La mayoría de screens, stores, y servicios de dominio no están testeados.

**Lo que hay que hacer:**
- Agregar tests para `gameStore` (hydrate, startNewGame, updateProgress)
- Agregar tests para `combatEngine` (ya tiene tests pero falta cobertura de branches)
- Agregar tests de integración para flujos críticos: BattleScreen → ReportScreen, Village → Map → Battle

---

### [BRF-004] 38 strings hardcodeados en JSX — bypasean el sistema i18n

**Área:** i18n  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🟡 Media  
**Impacto:** La app tiene sistema i18n (ES/EN) pero 38 strings visibles al usuario están hardcodeados. Algunos en inglés (DEFEATED, KO), otros en español (HERRERÍA, MERCADO, DESERCIÓN).

**Evidencia encontrada:**
```bash
grep -rn "<Text[^>]*>[^{<]*[a-zA-ZáéíóúñÁÉÍÓÚÑ][^{<]*</Text>" --include="*.tsx" src/ | grep -Ev ">\s*\{" | wc -l
# 38
```

**Muestra representativa:**
- `src/screens/BattleScreen.tsx:239` — `DEFEATED`
- `src/screens/BattleScreen.tsx:316` — `KO`
- `src/screens/BattleScreen.tsx:902` — `⚠ DESERCIÓN`
- `src/screens/BlacksmithScreen.tsx:89` — `HERRERÍA`
- `src/screens/MapScreen.tsx:619` — `El guardián del piso ha caído. El próximo descenso aguarda.`
- `src/components/DatabaseGate.tsx:46` — `ERROR DE BASE DE DATOS`

*(Ver lista completa en `plan/discover/discover-001/BRF-004-hardcoded.txt`)*

**Lo que hay que hacer:**
- Agregar las claves faltantes a `src/i18n/translations/es.ts` y `en.ts`
- Reemplazar los literales con llamadas `{t('key')}`

---

### [BRF-005] Sin ErrorBoundary — cualquier error no capturado crashea la app

**Área:** Arquitectura  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🟡 Media  
**Impacto:** Un error no capturado en cualquier componente del árbol React produce pantalla en blanco sin mensaje de error. El usuario no puede recuperarse sin reiniciar la app.

**Evidencia encontrada:**
```bash
grep -rn "ErrorBoundary\|componentDidCatch" --include="*.tsx" --include="*.ts" src/
# (sin resultados)
```

**Lo que hay que hacer:**
- Crear un `ErrorBoundary` en `src/components/ErrorBoundary.tsx`
- Wrappear el stack navigator en `App.tsx` con este componente

---

### [BRF-006] API key de Gemini bundleada en el app — extraíble por atacantes

**Área:** Seguridad  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🟡 Media  
**Impacto:** La API key `NANO_BANANA_API` se inyecta en el bundle JS vía `react-native-dotenv`. Cualquier persona con acceso al APK/IPA puede extraerla haciendo `strings` sobre el bundle JS. La key da acceso a la API de Gemini / ComfyUI.

**Evidencia encontrada:**
```bash
cat src/types/env.d.ts
# declare module '@env' {
#   export const NANO_BANANA_API: string;
# }
cat "exmaple env"
# NANO_BANANA_API=...apikey...
```

**Lo que hay que hacer:**
- Usar un proxy backend (serverless function) que tenga la key y no la exponga al cliente
- O restringir la key por IP/bundle-ID en el dashboard de la API
- Esta key es particularmente sensible si es de pago (puede generar costos)

---

### [BRF-007] 15 casts `as React.ComponentType<object>` en AppNavigator — tipado de navegación incompleto

**Área:** TypeScript / Arquitectura  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🟡 Media  
**Impacto:** Las pantallas con params tipados están casteadas a `object` para que TypeScript no se queje, ocultando posibles incompatibilidades de tipos en los parámetros de navegación.

**Evidencia encontrada:**
```tsx
// src/navigation/AppNavigator.tsx
<Stack.Screen name="Battle" component={BattleScreen as React.ComponentType<object>} />
<Stack.Screen name="Camp" component={CampScreen as React.ComponentType<object>} />
// ... 13 más
```

**Lo que hay que hacer:**
- Tipar los componentes de pantalla con `ScreenProps<'ScreenName'>` en cada screen
- Eliminar los casts `as React.ComponentType<object>`

---

### [BRF-008] BattleScreen.tsx con 1571 líneas — violación de SRP

**Área:** Arquitectura / Mantenibilidad  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🟡 Media  
**Impacto:** Un archivo de 5x el límite recomendado (300 líneas) mezcla lógica de UI, lógica de negocio de combate, y animaciones. Dificulta el testing, el debugging y el onboarding.

**Archivos afectados:**
- `src/screens/BattleScreen.tsx` — 1571 líneas
- `src/screens/CharacterDetailScreen.tsx` — 1279 líneas
- `src/services/combatEngine.ts` — 983 líneas
- `src/screens/PartyScreen.tsx` — 923 líneas

---

### [BRF-009] `as any` en cálculo de porcentaje en CharacterDetailScreen

**Área:** TypeScript  
**Fuente:** 🤖 Auto-descubierto — `rn-discover` 2026-03-14  
**Severidad:** 🟢 Baja  
**Impacto:** Uso de `as any` para aceptar strings de porcentaje en estilos de RN. Moderno RN acepta strings de porcentaje sin necesidad del cast.

**Evidencia:**
```tsx
// src/screens/CharacterDetailScreen.tsx ~línea 150
style={[S.statBarTick, { left: `${tickPct}%` as any }]}
```
