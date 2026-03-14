# 📦 Dependencias — Auditoría RN

> **Severidad general:** 🟡 Media  
> **Archivos afectados:** `package.json`, `patches/`  
> **Esfuerzo estimado:** 2–4 horas

---

## Resumen ejecutivo

El stack de dependencias es moderno y apropiado para un juego React Native de esta envergadura: RN 0.84.0 (la más reciente en la línea 0.84), Zustand 5, `react-native-reanimated` 4, NativeWind 4, `@shopify/react-native-skia` 2.5. No se encontraron dependencias duplicadas resolviendo el mismo problema. Los hallazgos relevantes son: (1) `react-native-fast-image@8.6.3` lleva más de 2 años sin release y el repositorio original tiene actividad mínima — hay alternativas más mantenidas; (2) `@oguzhnatly/react-native-image-manipulator@1.0.17` es un fork de nicho con baja adopción que ya requiere un patch; (3) `react-native-fs@2.20.0` tiene alternativas más modernas; (4) sin `package-lock.json`, `npm audit` no puede ejecutarse — la seguridad de dependencias es opaca.

---

## Hallazgos

### [DEP-001] Sin `package-lock.json` — `npm audit` inutilizable
**Archivo:** Proyecto raíz  
**Severidad:** 🟡 Media — Sin lockfile no se puede verificar CVEs ni garantizar builds reproducibles

**Por qué es un problema:**
El proyecto usa `npm` pero no tiene `package-lock.json` commiteado (probablemente ignorado en `.gitignore` o nunca generado). Esto causa dos problemas:
1. `npm audit` falla con `ENOLOCK` — no se puede escanear vulnerabilidades.
2. Las instalaciones no son deterministas — versiones de sub-dependencias pueden diferir entre máquinas.

**Solución paso a paso:**

```bash
# Generar el lockfile
npm install --package-lock-only

# Verificar vulnerabilidades
npm audit

# Agregar al repositorio
git add package-lock.json
git commit -m "chore: add package-lock.json"
```

Añadir `.gitignore` note: asegurarse que `package-lock.json` no está en `.gitignore`.

---

### [DEP-002] `react-native-fast-image@8.6.3` — mantenimiento bajo
**Archivo:** `package.json` › `dependencies`  
**Severidad:** 🟢 Baja — Funciona actualmente, riesgo a medio plazo con nuevas versiones de RN

**Por qué es un problema:**
`react-native-fast-image` lleva ~2+ años sin publicar una versión nueva. El último release (8.6.3) data de 2022. Con React Native 0.74+ y la New Architecture (Fabric), la librería podría presentar incompatibilidades futuras.

**Alternativas evaluadas:**

| Opción | Estado | Notas |
|--------|--------|-------|
| `react-native-fast-image` | ⚠️ Bajo mantenimiento | Funciona en RN 0.84 con Old Arch |
| `expo-image` | ✅ Activo | Compatible con RN bare workflow, soporta New Arch |
| `@d11/react-native-fast-image` | ✅ Activo | Fork mantenido de la librería original |

**Acción recomendada:** No es urgente. Evaluar migración a `@d11/react-native-fast-image` (drop-in replacement) en el próximo sprint de mantenimiento.

---

### [DEP-003] `@oguzhnatly/react-native-image-manipulator@1.0.17` — fork de nicho + patch aplicado
**Archivos:** `package.json`, `patches/@oguzhnatly+react-native-image-manipulator+1.0.17.patch`  
**Severidad:** 🟡 Media — El patch aplicado indica que la librería tiene bugs no resueltos upstream; actualizar romperá el patch

**Por qué es un problema:**
1. Es un fork con baja adopción (no es el paquete oficial `@oguzhnatly/react-native-image-manipulator` del creator original).
2. Ya hay un patch local (`patches/`) aplicado sobre la versión — esto significa que hay un bug conocido que no fue solucionado en la librería y que cualquier actualización de versión puede invalidar el patch.
3. Solo se usa en `imageStorageService.ts` para una operación de redimensionamiento.

**Solución paso a paso:**

1. Evaluar si la operación puede hacerse con `@shopify/react-native-skia` (ya en el proyecto):
```ts
// Redimensionar con Skia en lugar de ImageManipulator
import { Skia, Surface } from '@shopify/react-native-skia';
```

2. Si no, considerar `react-native-image-resizer` (más mantenida, ~3k⭐) como alternativa al fork actual.

3. Documentar en `package.json` por qué se usa este fork (comentario en README o en el propio `imageStorageService.ts`).

---

### [DEP-004] `react-native-fs@2.20.0` — última versión de 2022
**Archivo:** `package.json` › `dependencies`  
**Severidad:** 🟢 Baja — Funcional actualmente, riesgo futuro con New Architecture

**Por qué es un problema:**
`react-native-fs` lleva más de 2 años sin actualizaciones y no tiene soporte documentado para New Architecture (Fabric/TurboModules). Si el proyecto migra a New Arch, esta librería puede fallar.

**Alternativa:** `react-native-blob-util` (fork muy activo de react-native-fetch-blob) que también provee file system access y está activamente mantenida con soporte para New Arch.

**Acción:** No urgente. Añadir a backlog de migración si se planea New Architecture.

---

## Inventario de dependencias clave

| Dependencia | Versión | Estado | Notas |
|-------------|---------|--------|-------|
| `react-native` | 0.84.0 | ✅ Actual | Versión más reciente de la rama 0.84 |
| `react` | 19.2.3 | ✅ Actual | |
| `zustand` | 5.0.11 | ✅ Actual | |
| `react-native-reanimated` | 4.2.2 | ✅ Actual | |
| `@shopify/react-native-skia` | 2.5.1 | ✅ Actual | |
| `nativewind` | 4.2.2 | ✅ Actual | |
| `@react-navigation/native` | 7.1.30 | ✅ Actual | |
| `@op-engineering/op-sqlite` | 15.2.5 | ✅ Actual | |
| `react-native-gesture-handler` | 2.30.0 | ✅ Actual | |
| `react-native-fast-image` | 8.6.3 | ⚠️ Sin updates 2+ años | Ver DEP-002 |
| `react-native-fs` | 2.20.0 | ⚠️ Sin updates 2+ años | Ver DEP-004 |
| `@oguzhnatly/react-native-image-manipulator` | 1.0.17 | ⚠️ Fork + patch | Ver DEP-003 |
