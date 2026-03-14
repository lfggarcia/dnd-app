# Code Review: `src/screens/GuildScreen.tsx`

**Revisado:** 2026-03-14  
**Líneas de código:** 762  
**Severidad general:** 🟡 Media  
**Comentarios:** 3 hallazgos

---

## Resumen

GuildScreen es el hub de mecánicas sociales del juego (rankings, alianzas, misiones, log
mundial). El archivo es grande (762 líneas) y suscribe `s => s.activeGame` en lugar de
selectores granulares. Los tabs de navegación interna tienen sus labels hardcodeados.

---

## Issues del briefing verificados en este archivo

**BRF-004 (Strings hardcodeados):** Confirmado:
- Línea 387: `'RNK'`  
- Línea 412: `'ALI'`
- Línea 448: `'MIS'`
- Línea 470: `'LOG'`

**BRF-007 (Zustand selector):** Confirmado — línea 189: `useGameStore(s => s.activeGame)`

---

## [CR-024] `useGameStore(s => s.activeGame)` — re-renders en cualquier cambio de game

> **Línea(s):** 189  
> **Tipo:** Performance  
> **Severidad:** 🟡 Media

**Código actual:**
```ts
const activeGame = useGameStore(s => s.activeGame);
```

GuildScreen usa: `floor`, `seedHash`, `partyData`, `cycle`, `phase`.

**Solución:**
```ts
const floor      = useGameStore(s => s.activeGame?.floor ?? 1);
const seedHash   = useGameStore(s => s.activeGame?.seedHash ?? '');
const partyData  = useGameStore(s => s.activeGame?.partyData ?? []);
const cycle      = useGameStore(s => s.activeGame?.cycle ?? 1);
const phase      = useGameStore(s => s.activeGame?.phase ?? 'DAY');
```

**Tiempo estimado:** 20 min  
**Referencia:** PERF-001 en audit-002

---

## [CR-025] Tab labels `'RNK'`, `'ALI'`, `'MIS'`, `'LOG'` hardcodeados

> **Línea(s):** 387, 412, 448, 470  
> **Tipo:** i18n  
> **Severidad:** 🟡 Media

**Decisión de diseño requerida:**
¿Son abreviaciones intencionales (parte del diseño CRT/retro) o deben traducirse?

Si son intencionales (mismo en EN y ES), añadir como constantes con comentario:
```ts
// Abreviaciones de tab — diseño CRT/retro, mismas en ES y EN
const TAB_LABELS = {
  ranking:  'RNK',
  alliance: 'ALI',
  missions: 'MIS',
  log:      'LOG',
} as const;
```

Si deben traducirse:
```ts
const { t } = useI18n();
// t('guild.tabRanking'), t('guild.tabAlliances'), etc.
```

**Tiempo estimado:** 10 min  
**Referencia:** I18N-001 en audit-002

---

## [CR-026] `eslint-disable exhaustive-deps` en línea 268

> **Línea(s):** 268  
> **Tipo:** Bug potencial  
> **Severidad:** 🟡 Media

**Código:**
```ts
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [isFocused]);
```

**Observación:** Si el efecto que carga datos de la guild usa `activeGame` como dependencia
implícita pero no está en el array, los datos pueden no actualizarse cuando el juego activo
cambia mientras la pantalla está mounted (por ejemplo, después de que un rival hace algo).

**Verificación:** Leer el cuerpo del efecto y confirmar si usa `activeGame` o `seedHash`
directamente. Agregar las dependencias faltantes si corresponde.

**Tiempo estimado:** 20 min
