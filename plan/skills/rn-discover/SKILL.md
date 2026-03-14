---
name: rn-discover
description: >
  Investiga el codebase automáticamente para descubrir issues ocultos que el análisis
  estático normal no detecta: strings hardcodeados sin i18n, assets locales que exceden
  límites de stores, require() estático donde debería haber URIs dinámicas, dependencias
  removidas con referencias huérfanas, migraciones de DB faltantes, features a medio
  implementar, pantallas sin conectar a la navegación, y más. Úsala antes de rn-audit o
  como parte del pipeline. También se activa cuando el usuario dice "qué más hay roto",
  "qué no has visto", "busca cosas ocultas", "investigación profunda", o "qué está incompleto".
  Genera plan/BRIEFING.md automáticamente sin necesitar input del desarrollador.
---

# RN Discover — Investigación Profunda Automática

## Propósito

Encontrar lo que el análisis de patrones no ve. Ejecuta comandos específicos para
descubrir issues que solo aparecen cuando buscas activamente: texto sin traducir,
assets que rompen el límite de stores, código que asume que una librería removida
sigue existiendo, migraciones que nunca se escribieron.

**No necesita input humano. Todo viene del código.**

---

## Paso 1 — Reconocimiento del proyecto

Antes de investigar, entender con qué tipo de proyecto se trabaja:

```bash
# Stack tecnológico
cat package.json | grep -E '"react-native"|"expo"|"dependencies"' | head -30

# ORM / Base de datos
cat package.json | grep -E 'sqlite|realm|watermelon|typeorm|prisma|drizzle|op-sqlite'

# i18n library
cat package.json | grep -E 'i18n|i18next|react-intl|lingui|localization'

# Estado global
cat package.json | grep -E 'redux|zustand|jotai|recoil|mobx'

# Navegación
cat package.json | grep -E 'navigation|router'

# Estructura de carpetas
find . -type d -not -path "*/node_modules/*" -not -path "*/.git/*" \
  -not -path "*/ios/*" -not -path "*/android/*" \
  | head -40
```

Guardar este contexto — afecta qué comandos de investigación usar.

---

## Paso 2 — Investigaciones por dominio

Ejecutar **todas** las investigaciones del archivo `references/investigations.md`.
Para cada una: ejecutar el comando, analizar el output, y documentar si hay hallazgo real.

No documentar falsos positivos — verificar antes de reportar.

---

## Paso 3 — Generar el BRIEFING.md

Crear o actualizar `plan/BRIEFING.md` con los hallazgos reales encontrados.

### Estructura del hallazgo auto-descubierto

```markdown
### [BRF-001] Título del issue

**Área:** i18n / Assets / DB / Dependencias / Navegación / etc.
**Fuente:** 🤖 Auto-descubierto — `rn-discover` YYYY-MM-DD
**Severidad:** 🔴 Alta / 🟡 Media / 🟢 Baja
**Impacto:** Descripción del impacto real

**Evidencia encontrada:**
```bash
# Comando que encontró el problema
grep -rn "hardcoded" src/
# Output resumido:
# src/screens/HomeScreen.tsx:42:  <Text>Bienvenido</Text>
# src/screens/ProfileScreen.tsx:18:  <Text>Mi perfil</Text>
# ... (N ocurrencias totales)
```

**Archivos afectados:** N archivos
**Muestra representativa:**
- `src/screens/HomeScreen.tsx:42` — `<Text>Bienvenido</Text>`
- `src/screens/ProfileScreen.tsx:18` — `<Text>Mi perfil</Text>`
- *(ver lista completa en `plan/discover/discover-00X/BRF-001-detail.md`)*

**Lo que hay que hacer:**
Descripción de alto nivel de la solución. No código exacto — eso lo hace rn-fix.
```

### Regla de severidad automática

| Condición | Severidad |
|---|---|
| Bloquea aprobación en stores | 🔴 Alta siempre |
| Pantallas que crashean o no cargan | 🔴 Alta |
| Datos corruptos o pérdida de datos | 🔴 Alta |
| Feature principal inaccesible | 🔴 Alta |
| Feature secundaria degradada | 🟡 Media |
| UX deficiente pero funcional | 🟡 Media |
| Texto sin traducir en app publicada | 🟡 Media |
| Deuda técnica sin impacto inmediato | 🟢 Baja |

---

## Paso 4 — Guardar el detalle

Para issues con muchos archivos afectados (>10), guardar la lista completa:

```bash
mkdir -p plan/discover/discover-00X
# Guardar output completo del comando de búsqueda
grep -rn "patrón" src/ > plan/discover/discover-00X/BRF-001-detail.txt
```

Referenciar desde el BRIEFING.md para no saturarlo.

---

## Paso 5 — Reporte de descubrimiento

Al final, imprimir un resumen:

```
🔍 rn-discover completado — YYYY-MM-DD

Issues auto-descubiertos:
  🔴 Alta:   N issues
  🟡 Media:  N issues  
  🟢 Baja:   N issues

Áreas investigadas:
  ✅ i18n / strings hardcodeados
  ✅ Assets y límites de bundle
  ✅ Dependencias huérfanas
  ✅ Migraciones de DB
  ✅ require() estático en imágenes
  ✅ Pantallas sin conectar
  ✅ Features incompletas
  ✅ [otras según el stack]

📄 BRIEFING generado: plan/BRIEFING.md
📁 Detalles: plan/discover/discover-00X/

Siguiente paso recomendado:
→ "audita el proyecto" — rn-audit leerá el BRIEFING automáticamente
→ "corre el pipeline completo" — audit + codereview + fix con este contexto
```

---

## Reglas

1. **Solo reportar lo confirmado** — ejecutar el comando, ver el output, verificar que es un problema real
2. **Cuantificar siempre** — "43 archivos afectados" es útil; "varios archivos" no lo es
3. **Muestra representativa** — mostrar 3-5 ejemplos concretos, guardar el resto en detail file
4. **No duplicar** — si ya existe un BRIEFING.md con ese issue, verificar si hay info nueva que agregar
5. **Actualizar, no reemplazar** — si el BRIEFING ya existe, agregar los nuevos hallazgos preservando los manuales

---

## Referencias

- `references/investigations.md` — Todos los comandos de investigación por dominio
