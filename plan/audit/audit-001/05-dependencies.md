# 📦 Dependencias — Auditoría RN

> **Severidad general:** 🟡 Media  
> **Esfuerzo estimado:** 1-2 horas

---

## Resumen ejecutivo
0 vulnerabilidades en npm audit (✅). Sin embargo, 6 paquetes nativos están instalados pero sin usar — agregan peso al binary nativo (~8-10 MB) y complejidad de linking sin beneficio. Un parche custom existe para react-native-image-manipulator.

---

## Hallazgos

### [DEP-001] react-native-fast-image instalado pero sin importar (0 usos)
**Severidad:** 🟡 Media  
**Impacto:** Agrega ~1.5 MB al binary nativo. Requiere linking y pod install.

**Solución:**
```bash
npm uninstall react-native-fast-image
cd ios && pod install
```

**Tiempo estimado:** 5 min  
**Prioridad:** P1

---

### [DEP-002] @shopify/react-native-skia instalado pero sin importar (0 usos)
**Severidad:** 🔴 Alta  
**Impacto:** Skia es uno de los paquetes nativos más pesados (~5 MB). 0 imports encontrados en src/.

**Solución:**
```bash
npm uninstall @shopify/react-native-skia
cd ios && pod install
```

**Tiempo estimado:** 5 min  
**Prioridad:** P1 — Ganancia de tamaño significativa

---

### [DEP-003] react-native-worklets instalado pero sin importar
**Severidad:** 🟡 Media  
**Impacto:** Módulo nativo sin uso. Puede ser dependencia transitiva de Reanimated — verificar antes de remover.

**Solución:**
1. Verificar si Reanimated 4 lo necesita como peerDep
2. Si no → `npm uninstall react-native-worklets`

**Tiempo estimado:** 10 min  
**Prioridad:** P2

---

### [DEP-004] @react-native-masked-view/masked-view sin importar
**Severidad:** 🟢 Baja  
**Impacto:** Menor. Puede ser requerido por React Navigation (header transitions).

**Solución:** Verificar si React Navigation lo necesita. Si no → uninstall.

**Tiempo estimado:** 10 min  
**Prioridad:** P3

---

### [DEP-005] @react-native/new-app-screen sin importar
**Severidad:** 🟢 Baja  
**Impacto:** Template code de RN init. No se usa.

**Solución:** `npm uninstall @react-native/new-app-screen`

**Tiempo estimado:** 2 min  
**Prioridad:** P2

---

### [DEP-006] uuid + @types/uuid sin importar
**Severidad:** 🟢 Baja  
**Impacto:** Paquete JS puro (no nativo). Peso mínimo pero innecesario.

**Solución:** `npm uninstall uuid @types/uuid`

**Tiempo estimado:** 2 min  
**Prioridad:** P3

---

### [DEP-007] react-native-dotenv configura @env pero nadie lo importa
**Severidad:** 🟡 Media  
**Impacto:** Babel plugin activo que transforma `@env` imports pero 0 archivos lo usan. Agrega overhead al build.

**Solución:**
1. Remover el plugin de `babel.config.js`
2. Eliminar `src/types/env.d.ts`  
3. `npm uninstall react-native-dotenv` (devDependency)

**Tiempo estimado:** 10 min  
**Prioridad:** P1 — También resuelve SEG-001

---

### [DEP-008] Parche custom para @oguzhnatly/react-native-image-manipulator
**Archivo:** `patches/@oguzhnatly+react-native-image-manipulator+1.0.17.patch`  
**Severidad:** 🟢 Baja (documentar)  
**Impacto:** Hay un parche que se aplica con `patch-package`. Necesita documentación de por qué existe.

**Solución:** Agregar comentario en el archivo del parche o en README explicando qué resuelve.

**Tiempo estimado:** 10 min  
**Prioridad:** P3

---

### [DEP-009] 0 vulnerabilidades npm audit ✅
**Estado:** PASS — Sin vulnerabilidades conocidas.

---

## Checklist de verificación
- [ ] DEP-001 — react-native-fast-image removido
- [ ] DEP-002 — @shopify/react-native-skia removido
- [ ] DEP-003 — react-native-worklets verificado/removido
- [ ] DEP-005 — @react-native/new-app-screen removido
- [ ] DEP-006 — uuid removido
- [ ] DEP-007 — react-native-dotenv removido + babel cleanup
