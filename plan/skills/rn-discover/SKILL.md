# RN Discover — Investigación Profunda Automática

## Propósito

Encontrar lo que el análisis de patrones no ve: strings sin traducir, assets que rompen límites de stores, require() estático con lógica dinámica, dependencias huérfanas, migraciones faltantes, pantallas desconectadas, features a medio implementar.

**No requiere input humano. Todo viene del código.**

---

## Paso 1 — Reconocimiento del stack

> ▶ Leyendo package.json para identificar el stack tecnológico

Serena MCP: `read_file("package.json")`

Identificar y anotar:
- ORM/DB: op-sqlite / WatermelonDB / Realm / Expo SQLite
- i18n: i18next / react-intl / lingui / custom
- Estado: Zustand / Redux / Jotai / MobX
- Navegación: React Navigation / Expo Router

> ▶ Mapeando estructura de carpetas del proyecto

Serena MCP: `find_files("src/**", exclude=["node_modules", "ios", "android", "vendor"])`

---

## Paso 2 — Investigaciones por dominio

Ejecutar **todas** las investigaciones de `references/investigations.md`.
Para cada una: ejecutar, analizar output, documentar solo hallazgos reales.
No reportar falsos positivos — verificar antes de documentar.

---

## Paso 3 — Generar BRIEFING.md

> ▶ Creando plan/BRIEFING.md con hallazgos del discovery

Crear o actualizar `plan/BRIEFING.md`. Formato por hallazgo:

```markdown
### [BRF-NNN] Título del issue

**Área:** i18n / Assets / DB / Dependencias / Navegación / etc.
**Fuente:** 🔍 Auto-descubierto · `rn-discover` YYYY-MM-DD
**Severidad:** 🔴 Alta / 🟡 Media / 🟢 Baja

**Impacto:** Descripción del impacto real en el usuario o el deploy.

**Evidencia encontrada:**
```
[output resumido de la búsqueda que lo encontró]
```

**Archivos afectados:** N archivos
**Muestra representativa:**
- `src/screens/HomeScreen.tsx:42` → `<Text>Bienvenido</Text>`
- *(ver lista completa en `plan/discover/discover-NNN/BRF-NNN-detail.txt`)*

**Lo que hay que hacer:**
Descripción de alto nivel. El código exacto lo genera rn-fix.
```

### Criterio de severidad automática

| Condición | Severidad |
|---|---|
| Bloquea aprobación en stores | 🔴 Alta siempre |
| Crash o pérdida de datos | 🔴 Alta |
| Feature principal inaccesible | 🔴 Alta |
| Feature secundaria degradada | 🟡 Media |
| UX deficiente pero funcional | 🟡 Media |
| Texto sin traducir en app publicada | 🟡 Media |
| Deuda técnica sin impacto inmediato | 🟢 Baja |

---

## Paso 4 — Guardar detalle de issues grandes

Para issues con más de 10 archivos afectados:

> ▶ Guardando lista completa de BRF-NNN en plan/discover/discover-NNN/

```bash
mkdir -p plan/discover/discover-NNN
```

Usar Serena MCP para exportar la lista completa y escribirla en `BRF-NNN-detail.txt`.
Referenciar desde el BRIEFING.md para no saturarlo.

---

## Paso 5 — Resumen de descubrimiento

Al terminar, imprimir:

```
🔍 rn-discover completado
────────────────────────
Hallazgos: N issues (X altos, Y medios, Z bajos)
Archivos afectados: N
BRIEFING.md: plan/BRIEFING.md
────────────────────────
Siguiente: ejecutar rn-audit
```
