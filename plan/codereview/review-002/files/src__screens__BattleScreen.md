# Code Review: `src/screens/BattleScreen.tsx`

**Revisado:** 2026-03-14  
**Líneas de código:** 1571  
**Severidad general:** 🟡 Media  
**Comentarios:** 5 hallazgos

---

## Resumen

BattleScreen es el archivo más grande del proyecto (1571 líneas — 4x el límite recomendado).
El código en sí está bien escrito: componentes memoizados, callbacks con useCallback, 
maquina de estados con `UIPhase`. El principal problema es la falta de separación de concerns.
Los `eslint-disable exhaustive-deps` en 6 useEffects (líneas 386, 503, 669, 682, 792) son
el riesgo más inmediato — algunos pueden ocultar stale closures en la lógica de combate.

---

## Issues del briefing verificados en este archivo

**BRF-008 (Archivos grandes):** Confirmado — 1571 líneas mezcla UI, lógica de combate, 
animaciones y máquina de estados. Contribuye directamente al problema.

**BRF-004 (Strings hardcodeados):** Confirmado:
- Línea 239: `'DEFEATED'`
- Línea 316: `'KO'`
- Línea 902: `'⚠ DESERCIÓN'`
- Línea 975: `'ATACAR'`

---

## [CR-007] 6 useEffect con deps desactivados — riesgo de stale closures en lógica de combate

> **Línea(s):** 386, 503, 669, 682, 792  
> **Tipo:** Bug potencial  
> **Severidad:** 🟡 Media

**Problema:**
Stale closures en efectos de combate pueden causar que el sistema de turnos o la resolución
de acciones capture valores viejos del estado, produciendo combates con comportamiento
inconsistente (ataque que no se registra, turno que no avanza).

**Ejemplo — línea 386:**
```ts
useEffect(() => {
  // Inicia el combate — runInit usa liveState que podría ser stale
  runInit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Verificación necesaria para cada caso:**
1. ¿El efecto usa `liveState` o `turnOrder` directamente? → stale closure risk
2. ¿El efecto usa `dispatch` o `set`? → generalmente estable
3. ¿El efecto es genuinamente "mount-only"? → documentarlo explícitamente

**Solución general para mount-only genuinos:**
```ts
// Mount-only — roomId y roomType son estables durante la vida de este componente.
// No depende de estado mutable (liveState se inicializa en runInit).
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Tiempo estimado:** 1 hora (revisar los 6 efectos)  
**Prioridad:** P2

---

## [CR-008] 4 strings hardcodeados — no usan i18n

> **Línea(s):** 239, 316, 902, 975  
> **Tipo:** i18n  
> **Severidad:** 🟡 Media

**Código:**
```tsx
<Text style={S.defeatedText}>DEFEATED</Text>     // línea 239
<Text style={S.partyDeadText}>KO</Text>          // línea 316
// línea 902: '⚠ DESERCIÓN'
// línea 975: 'ATACAR'
```

**Solución:**
```tsx
const { t } = useI18n();
<Text style={S.defeatedText}>{t('battle.defeated')}</Text>
<Text style={S.partyDeadText}>{t('battle.ko')}</Text>
```

Agregar las keys a `es.ts` y `en.ts`.  
**Tiempo estimado:** 30 min  
**Referencia:** I18N-001 en audit-002

---

## [CR-009] Componentes internos bien extrados y memoizados ✅

> **Línea(s):** 87-234 (TurnToken, TurnTimeline, EnemyCard)  
> **Tipo:** Positivo  

Los componentes `TurnToken`, `TurnTimeline`, y `EnemyCard` están correctamente extraídos
y envueltos con `memo()`. Los callbacks dentro de EnemyCard usan `useCallback`. ✅

---

## [CR-010] Archivo excede límite recomendado 4x — extraer hook y subcomponentes

> **Línea(s):** Todo el archivo  
> **Tipo:** Arquitectura / Mantenibilidad  
> **Severidad:** 🟡 Media

**1571 líneas** mezcla:
- Máquina de estados de combate (~300 líneas de state + reducers implícitos)
- Componentes visuales (TurnToken, TurnTimeline, EnemyCard — ya extraídos parcialmente)
- El componente principal BattleScreen (~700 líneas de JSX + efectos)
- StyleSheet al final (~200 líneas)

**Plan de refactor:**
```
src/hooks/useBattleEngine.ts      ← toda la lógica de estado y turno
src/components/battle/
  TurnTimeline.tsx                ← ya existe inline, extraer
  EnemyCard.tsx                   ← ya existe inline, extraer
  BattleLog.tsx                   ← el ScrollView de log
  BattlePartyStrip.tsx            ← la fila de party
  BattleActionBar.tsx             ← los botones de acción
src/screens/BattleScreen.tsx      ← queda como orchestrador < 200 líneas
```

**Tiempo estimado:** 2 días  
**Prioridad:** P3 (no bloquea features actuales)  
**Referencia:** ARCH-001 en audit-002

---

## [CR-011] Animaciones con Animated.Value de React Native — considerar Reanimated

> **Línea(s):** ~700-800  
> **Tipo:** Performance  
> **Severidad:** 🟢 Baja

**Observación:**
Se usa `Animated.Value` de `react-native` para algunas animaciones de combate. El proyecto
ya tiene `react-native-reanimated 4` instalado. Las animaciones en el JS thread con
`Animated.Value` pueden dropear frames durante el procesamiento de combate (que también
corre en JS thread).

**Consideración:** Migrar las animaciones más frecuentes durante combate (flash de daño,
animación de muerte) a `useSharedValue` + `useAnimatedStyle` de Reanimated para que corran
en el UI thread.

**Tiempo estimado:** 2-3 horas por animación  
**Prioridad:** P4 (optimización avanzada)
