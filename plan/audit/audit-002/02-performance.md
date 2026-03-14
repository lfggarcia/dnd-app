# ⚡ Performance — Auditoría TORRE (dnd3) — audit-002

> **Severidad general:** 🟡 Media  
> **Archivos afectados:** 12+  
> **Esfuerzo estimado:** 1-2 días  
> **Fecha:** 2026-03-14

---

## Resumen ejecutivo

La app usa correctamente `useMemo`/`useCallback` (138 usos) y `React.memo` (63 usos), lo cual
es positivo. Sin embargo, hay dos problemas de performance sistémicos: (1) 205 inline styles que
crean objetos nuevos en cada render, y (2) 8 componentes que subscriben `s => s.activeGame`
entero en Zustand, causando re-renders innecesarios ante cualquier cambio de `activeGame`. El
lazy loading de pantallas pesadas en `AppNavigator` está bien implementado.

---

## Hallazgos

### [PERF-001] 8 componentes subscriben `activeGame` entero de Zustand

> **Fuente:** Análisis estático

**Archivo(s):** 8 screens  
**Severidad:** 🟡 Media  
**Impacto:** Subscribir `s => s.activeGame` hace que el componente se re-renderice cada vez
que **cualquier** campo de `activeGame` cambia, incluyendo campos que el componente no usa.
Esto viola el patrón de selectores granulares documentado en el memory `code_style`.

**Archivos afectados:**
- `src/screens/GuildScreen.tsx:189`
- `src/screens/CycleTransitionScreen.tsx:14`
- `src/screens/LevelUpScreen.tsx:13`
- `src/screens/CampScreen.tsx:25`
- `src/screens/CharacterDetailScreen.tsx:223`
- `src/screens/UnificationScreen.tsx:14`
- `src/screens/MainScreen.tsx:24`
- `src/screens/MapScreen.tsx:163`

**Código actual (problema):**
```ts
// src/screens/GuildScreen.tsx:189
const activeGame = useGameStore(s => s.activeGame);
```

**Por qué es un problema:**
Si `activeGame.gold` cambia, `GuildScreen` se re-renderiza aunque no muestre gold. En un
juego con updates frecuentes durante combate, esto puede causar frame drops.

**Solución paso a paso:**

1. Identificar qué campos usa cada screen:
```ts
// GuildScreen: usa partyData, cycle, phase, floor, seedHash
```

2. Reemplazar con selectores granulares:
```ts
// GuildScreen.tsx — ANTES
const activeGame = useGameStore(s => s.activeGame);
// ... usa activeGame.partyData, activeGame.cycle, etc.

// GuildScreen.tsx — DESPUÉS
const partyData  = useGameStore(s => s.activeGame?.partyData ?? []);
const cycle      = useGameStore(s => s.activeGame?.cycle ?? 1);
const phase      = useGameStore(s => s.activeGame?.phase ?? 'DAY');
const floor      = useGameStore(s => s.activeGame?.floor ?? 1);
const seedHash   = useGameStore(s => s.activeGame?.seedHash ?? '');
```

3. Eliminar la variable `activeGame` y usar los selectores directos.

**Tiempo estimado:** 2 horas (todos los archivos)  
**Prioridad:** P2 — Importante para performance durante combate

---

### [PERF-002] 205 inline styles crean objetos nuevos en cada render

> **Fuente:** Análisis estático

**Archivo(s):** Mayoría de screens (205 ocurrencias de `style={{` en TSX)  
**Severidad:** 🟡 Media  
**Impacto:** Cada `style={{ color: '#fff', fontSize: 12 }}` crea un nuevo objeto JS en cada
render. En pantallas complejas como `BattleScreen` con muchos re-renders, esto genera presión
en el garbage collector.

**Patrón problemático:**
```tsx
// Crea un objeto nuevo en CADA render
<Text style={{ fontFamily: 'RobotoMono-Bold', color: '#FFB000', fontSize: 12 }}>
  INICIAR NUEVA TEMPORADA
</Text>
```

**Solución:**
```tsx
// Estático: usar StyleSheet.create() o className de NativeWind cuando sea posible
const S = StyleSheet.create({
  newSeasonText: {
    fontFamily: 'RobotoMono-Bold',
    color: '#FFB000',
    fontSize: 12,
  },
});
// ...
<Text style={S.newSeasonText}>INICIAR NUEVA TEMPORADA</Text>

// O con NativeWind si el color está en el tema:
<Text className="font-robotomono-bold text-amber-400 text-xs">
  INICIAR NUEVA TEMPORADA
</Text>
```

**Nota:** Los inline styles con **valores dinámicos** son aceptables:
```tsx
// ✅ Correcto — el valor cambia
<View style={{ width: `${progress * 100}%` }} />
// ❌ Problemático — es siempre estático
<Text style={{ fontSize: 12, color: '#FFB000' }}>TEXTO</Text>
```

**Tiempo estimado:** 3-4 horas  
**Prioridad:** P3 — Mejora incremental (hacer en pantallas con muchos re-renders primero)

---

### [PERF-003] 20 `useEffect` con deps desactivados por eslint-disable

> **Fuente:** Análisis estático

**Archivo(s):** MapScreen (7), BattleScreen (6), CharacterDetailScreen, PartyScreen,
ReportScreen, GuildScreen, SimulationLoadingScreen, CycleTransitionScreen, CRTOverlay,
NarrativeMomentPanel, LogoIA  
**Severidad:** 🟡 Media  
**Impacto:** Los `eslint-disable react-hooks/exhaustive-deps` suelen indicar que el efecto
tiene una dependencia real que fue omitida intencionalmente. Esto puede causar stale closures
(referencias a valores viejos) que producen comportamiento incorrecto o inexplicable.

**Evidencia (muestra):**
```ts
// src/screens/BattleScreen.tsx:386
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Solución general:**
Para cada caso, evaluar si:
1. La omisión es intencional (efecto "mount-only") → documentar con comentario explicativo
2. La dependencia faltante puede causar stale closure → agregar + usar `useRef` o `useCallback`
3. El efecto puede refactorizarse para no necesitar dependencias → extraer a `useRef`

**Ejemplo de fix para mount-only:**
```ts
// ANTES (suprimir lint sin explicación):
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// DESPUÉS (documentado):
// Mount-only: este efecto solo debe ejecutarse una vez al montar el componente.
// La dependencia X es estable (store action) y no necesita estar en el array.
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Tiempo estimado:** 2-4 horas (revisar cada caso manualmente)  
**Prioridad:** P2 — Algunos pueden ser bugs latentes

---

### [PERF-004] ScrollView con listas grandes en MarketScreen, GuildScreen, BlacksmithScreen  

> **Fuente:** Análisis estático

**Archivo(s):**  
- `src/screens/MarketScreen.tsx:138` — lista de items del mercado  
- `src/screens/GuildScreen.tsx:328` — lista de misiones/rivales  
- `src/screens/BlacksmithScreen.tsx:97` — lista de equipos  
- `src/screens/CampScreen.tsx:164` — lista de party  
- `src/screens/PartyScreen.tsx:483` — lista de personajes (923 líneas de screen)  

**Severidad:** 🟢 Baja  
**Impacto:** Para listas de items del juego (tipicamente < 20 items), `ScrollView` con `.map()` 
es aceptable. El riesgo exists si la lista crece (market tiene potencialmente muchos items).
Las pantallas de guild/bounties podrían crecer con el tiempo.

**Solución (si las listas crecen):**
Reemplazar el patrón ScrollView + map:
```tsx
// Antes
<ScrollView>
  {items.map(item => <ItemCard key={item.id} item={item} />)}
</ScrollView>

// Después (para listas > 20 items o items con imágenes)
<FlatList
  data={items}
  keyExtractor={item => item.id}
  renderItem={({ item }) => <ItemCard item={item} />}
  showsVerticalScrollIndicator={false}
/>
```

**Tiempo estimado:** 30 min por pantalla  
**Prioridad:** P3 — Deuda técnica futura

---

## Checklist de verificación

- [ ] PERF-001: Todos los selectores `s => s.activeGame` reemplazados por granulares
- [ ] PERF-002: Inline styles estáticos más frecuentes movidos a StyleSheet.create
- [ ] PERF-003: Cada `eslint-disable exhaustive-deps` revisado y documentado
- [ ] PERF-004: ScrollViews con listas grandes migradas a FlatList donde corresponda
