# ♿ Accesibilidad — Auditoría RN

> **Severidad general:** 🔴 Alta  
> **Archivos afectados:** Todos los archivos con UI  
> **Esfuerzo estimado:** 4-6 horas (mínimo viable)

---

## Resumen ejecutivo
La app tiene **0 props de accesibilidad** (`accessibilityLabel`, `accessibilityRole`, `accessibilityHint`) en todo el codebase. Esto significa que es completamente inaccesible para usuarios con lectores de pantalla (VoiceOver/TalkBack). Solo 4 componentes usan `hitSlop`.

---

## Hallazgos

### [A11Y-001] Zero accessibilityLabel en toda la app
**Archivo(s):** Todos los archivos `.tsx` en `src/screens/` y `src/components/`  
**Severidad:** 🔴 Alta  
**Impacto:** VoiceOver/TalkBack no puede describir ningún elemento interactivo. App inutilizable para usuarios con discapacidad visual.

```bash
# Resultado de búsqueda
grep -rn 'accessibilityLabel' src/ → 0 resultados
```

**Solución mínima viable:**
1. Agregar `accessibilityLabel` a todos los `TouchableOpacity`/`Pressable` con acciones
2. Agregar `accessibilityRole="button"` a botones
3. Agregar `accessible={false}` a imágenes decorativas

**Tiempo estimado:** 3 horas (150+ elementos interactivos)  
**Prioridad:** P2 — Requerido para cumplir WCAG y guidelines de stores

---

### [A11Y-002] Imágenes sin accessibility props
**Severidad:** 🟡 Media  
**Impacto:** Lectores de pantalla leen "image" sin contexto para cada imagen.

**Solución:** Para imágenes de personajes/monstruos: `accessibilityLabel={`Retrato de ${character.name}`}`. Para decorativas: `accessible={false}`.

**Tiempo estimado:** 1 hora  
**Prioridad:** P2

---

### [A11Y-003] Touch targets menores a 44x44 puntos
**Severidad:** 🟡 Media  
**Impacto:** Solo 4 componentes usan `hitSlop`. Muchos botones tienen áreas táctiles pequeñas (especialmente en BattleScreen tactical actions).

**Solución:** Agregar `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` a botones con target < 44pt.

**Tiempo estimado:** 1 hora  
**Prioridad:** P3

---

## Checklist de verificación
- [ ] A11Y-001 — accessibilityLabel en todos los botones principales
- [ ] A11Y-002 — Imágenes con accessibility props
- [ ] A11Y-003 — hitSlop en botones pequeños
