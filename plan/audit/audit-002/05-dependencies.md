# 📦 Dependencies — Auditoría TORRE (dnd3) — audit-002

> **Severidad general:** 🟢 Baja  
> **Archivos afectados:** `package.json`  
> **Esfuerzo estimado:** 2-3 horas  
> **Fecha:** 2026-03-14

---

## Resumen ejecutivo

Las dependencias principales están actualizadas y bien elegidas. React Native 0.84 con React 19
es la versión más reciente. Zustand 5, NativeWind 4, y op-sqlite son versiones actuales. Se
detectaron 3 dependencias menores que merecen revisión: `react-native-fast-image` (tiene un
parche personalizado), `@oguzhnatly/react-native-image-manipulator` (fork no-oficial), y
`react-native-worklets` (package separado de reanimated que puede ser redundante con
reanimated 4).

---

## Hallazgos

### [DEP-001] Fork no oficial de react-native-image-manipulator

**Archivo(s):** `package.json`, `patches/`  
**Severidad:** 🟢 Baja  
**Impacto:** `@oguzhnatly/react-native-image-manipulator@^1.0.17` es un fork personal del
manipulador de imágenes oficial. Los forks de mantenedores no oficiales pueden quedar
desactualizados o abandonados, dejando vulnerabilidades sin parchear.

**Evidencia:**
```json
"@oguzhnatly/react-native-image-manipulator": "^1.0.17",
```

También hay un parche en `patches/@oguzhnatly+react-native-image-manipulator+1.0.17.patch`
que indica que la versión del fork también requirió modificaciones locales.

**Solución:**
1. Evaluar si `expo-image-manipulator` o `react-native-image-manipulator` oficial cubre los 
   casos de uso necesarios.
2. Si el fork es necesario, verificar que el repositorio sigue activo y responde a issues.
3. Documentar por qué se usa el fork en los comentarios del `package.json` o en README.

**Tiempo estimado:** 1 hora de evaluación  
**Prioridad:** P3 — Riesgo bajo pero deuda técnica

---

### [DEP-002] `react-native-worklets` puede ser redundante con reanimated 4

**Archivo(s):** `package.json`  
**Severidad:** 🟢 Baja  
**Impacto:** Reanimated 4 incluye `react-native-worklets-core` internamente. Tener
`react-native-worklets@^0.7.4` como dependencia separada puede causar conflictos de versiones
o incluir worklets duplicados en el bundle.

**Evidencia:**
```json
"react-native-reanimated": "^4.2.2",
"react-native-worklets": "^0.7.4",
```

**Solución:**
1. Verificar si algún código importa directamente de `react-native-worklets`:
```bash
grep -rn "react-native-worklets" src/ --include="*.ts" --include="*.tsx"
```
2. Si no hay imports directos, remover la dependencia:
```bash
yarn remove react-native-worklets
```
3. Si hay imports, evaluar si se pueden migrar a `react-native-reanimated`.

**Tiempo estimado:** 30 min  
**Prioridad:** P3 — Limpieza

---

### [DEP-003] `@react-native/new-app-screen` en dependencias de producción

**Archivo(s):** `package.json`  
**Severidad:** 🟢 Baja  
**Impacto:** `@react-native/new-app-screen@0.84.0` es el template screen que RN genera al
crear un nuevo proyecto. No debe estar en `dependencies` (producción) sino en `devDependencies`
o eliminado completamente si no se usa.

**Evidencia:**
```json
"dependencies": {
  "@react-native/new-app-screen": "0.84.0",
```

**Solución:**
1. Verificar si se usa en algún lugar:
```bash
grep -rn "new-app-screen" src/ --include="*.ts" --include="*.tsx"
```
2. Si no se usa, eliminarlo:
```bash
yarn remove @react-native/new-app-screen
```
3. Si se usa por alguna razón (poco probable), moverlo a `devDependencies`.

**Tiempo estimado:** 5 min  
**Prioridad:** P3 — Limpieza del bundle

---

## Stack de dependencias — Estado general

| Paquete | Versión actual | Estado |
|---------|---------------|--------|
| react-native | 0.84.0 | ✅ Última estable |
| react | 19.2.3 | ✅ Última |
| typescript | ^5.8.3 | ✅ Última |
| zustand | ^5.0.11 | ✅ Última v5 |
| nativewind | ^4.2.2 | ✅ Última v4 |
| @op-engineering/op-sqlite | ^15.2.5 | ✅ Reciente |
| react-native-reanimated | ^4.2.2 | ✅ Última v4 |
| @react-navigation/native-stack | ^7.14.1 | ✅ Última v7 |
| react-native-svg | ^15.15.3 | ✅ Reciente |
| @shopify/react-native-skia | ^2.5.1 | ✅ Reciente |

---

## Checklist de verificación

- [ ] DEP-001: Fork evaluado, documentado o migrado a oficial
- [ ] DEP-002: `react-native-worklets` verificado y removido si no se usa directamente
- [ ] DEP-003: `@react-native/new-app-screen` removido de dependencies
