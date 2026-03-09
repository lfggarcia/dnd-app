# Tareas de Optimización de Performance

Archivo de seguimiento de todas las tareas de performance identificadas.
Se trabajan en orden de impacto: ALTA → MEDIA → BAJA.

---

## Leyenda de estados
- `[ ]` pendiente
- `[~]` en progreso
- `[x]` completado

---

## ALTA PRIORIDAD

### ALTA-1 — VillageScreen: DB síncrona bloqueando el hilo JS
**Archivo:** `src/screens/VillageScreen.tsx`
**Problema:** `getResourcesByEndpoint('equipment')` y `getResourcesByEndpoint('monsters')` se
llaman dentro de `useMemo`. SQLite en este proyecto corre en el hilo JS de forma síncrona,
por lo que bloquea el render cada vez que cambia `seedHash`, `cycle` o `maxFloor`.

**Subtareas:**
- `[x]` ST-1: Mover ambas queries a `useEffect` con estado local (`marketResources`, `monsterResources`)
- `[x]` ST-2: Calcular `marketItems` y `knownThreats` con `useMemo` sobre ese estado (ya no bloquea)
- `[x]` ST-3: Añadir estado de carga si hace falta (las queries son rápidas, sin spinner)

**Resultado:** Las dos queries de DB se ejecutan una sola vez al montar la pantalla (o cuando
cambian los parámetros de seed) en lugar de bloquear cada re-render del `useMemo`.

---

### ALTA-2 — MapScreen: O(n²) en render SVG
**Archivo:** `src/screens/MapScreen.tsx`
**Problema:** Dentro del `flatMap` que genera las líneas SVG, se llama `floor.rooms.find(r => r.id === targetId)`
por cada conexión. Con N salas y M conexiones eso es O(N×M) en cada render del mapa.

**Subtareas:**
- `[x]` ST-1: Crear un `Map<number, DungeonRoom>` (roomMap) memoizado con `useMemo`
- `[x]` ST-2: Reemplazar `floor.rooms.find()` por `roomMap.get(targetId)` en el render SVG
- `[x]` ST-3: Usar el mismo `roomMap` en el `useFocusEffect` que detecta si hace falta revelar vecinos

**Resultado:** La búsqueda por ID pasa de O(N) a O(1). En un piso con 20 salas y ~40 conexiones
se evitan ~800 iteraciones por render.

---

### ALTA-3 — MapScreen: valores derivados sin useMemo
**Archivo:** `src/screens/MapScreen.tsx`
**Problema:** `currentRoom`, `reverseIds`, `accessibleIds`, `combatCount` y `revealedCount` se
recalculan en cada render aunque `floor` y `currentRoomId` no hayan cambiado.

**Subtareas:**
- `[x]` ST-1: Memoizar `currentRoom` con `useMemo([floor, currentRoomId])`
- `[x]` ST-2: Memoizar `reverseIds` (Set de IDs que conectan hacia la sala actual) con `useMemo`
- `[x]` ST-3: Memoizar `accessibleIds` con `useMemo([currentRoom, reverseIds])`
- `[x]` ST-4: Memoizar `combatCount` y `revealedCount` con `useMemo([floor])`

**Resultado:** Cuatro recorridos del array `floor.rooms` se saltan cuando el estado no cambia.
Además `handleRoomPress` ya no queda invalidado por sets recién creados.

---

### ALTA-4 — GlossaryModal: ScrollView con 300+ entradas
**Archivo:** `src/components/GlossaryModal.tsx`
**Problema:** La categoría "monsters" puede tener ~350 entradas. Renderizarlas todas en un
`ScrollView` normal monta ~700 nodos de React en el árbol y los mantiene vivos en memoria.

**Subtareas:**
- `[x]` ST-1: Reemplazar el `ScrollView` de entradas por `FlatList` con `keyExtractor` y `renderItem` estable
- `[x]` ST-2: Añadir `initialNumToRender={15}` y `windowSize={5}` para controlar el buffer
- `[x]` ST-3: Extraer el componente de cada entrada como `GlossaryEntryItem` con `React.memo`

**Resultado:** Solo se renderizan las entradas visibles en pantalla (~10-15). El resto se monta
a demanda al hacer scroll, reduciendo drásticamente el uso de memoria y el tiempo de primer render.

---

### ALTA-5 — TypewriterText: setInterval del cursor sin cleanup
**Archivo:** `src/components/TypewriterText.tsx`
**Problema:** El `setInterval` que parpadea el cursor se inicia en el mount y **nunca se detiene**
mientras el componente viva, aunque `showCursor` sea false o el texto ya haya terminado.
Además `onComplete` en el primer `useEffect` no está en el array de dependencias, lo que
puede causar un closure obsoleto si el callback cambia.

**Subtareas:**
- `[x]` ST-1: El `useEffect` del cursor ya devuelve `clearInterval` — revisar que funcione correctamente
- `[x]` ST-2: Detener el cursor cuando termine la animación del texto (shared ref `doneRef`)
- `[x]` ST-3: Añadir `onComplete` al array de dependencias del primer `useEffect`

**Resultado:** El `setInterval` del cursor se detiene cuando termina la animación en lugar de
seguir corriendo indefinidamente.

---

## MEDIA PRIORIDAD

### MEDIA-1 — MapScreen: setTimeout sin clearTimeout en handleNextFloor
**Archivo:** `src/screens/MapScreen.tsx`
**Problema:** `handleNextFloor` inicia un `setTimeout` de 900ms. Si el usuario navega fuera
de la pantalla antes de que expire, el callback se ejecuta de todas formas sobre estado
ya desmontado (escrituras de estado huérfanas).

**Subtareas:**
- `[x]` ST-1: Guardar la referencia del timer en un `useRef`
- `[x]` ST-2: Hacer `clearTimeout` en el cleanup del `useEffect` (o en el propio unmount)

**Resultado:** Se evitan actualizaciones de estado en componentes desmontados que pueden
silenciar errores o causar comportamientos inesperados en navegación rápida.

---

### MEDIA-2 — BattleScreen: selector Zustand por objeto completo + LOG_ENTRIES recreado
**Archivo:** `src/screens/BattleScreen.tsx`
**Problema:**
1. `useGameStore(s => s.activeGame)` suscribe al objeto completo — cualquier cambio en
   el store (aunque no afecte a BattleScreen) provoca un re-render.
2. `LOG_ENTRIES` es un array literal creado en cada render que llama a `t()`.
3. `getCharPortrait` es una función inline recreada en cada render.

**Subtareas:**
- `[x]` ST-1: Separar el selector en campos específicos: `floor`, `cycle`, `partyData`, `partyPortrait`, `portraitsJson`
- `[x]` ST-2: Memoizar `LOG_ENTRIES` con `useMemo([t])` para que solo se recalcule si cambia el idioma
- `[x]` ST-3: Convertir `getCharPortrait` a `useCallback([portraitsMap])`

**Resultado:** BattleScreen solo se re-renderiza cuando cambian sus datos específicos.

---

### MEDIA-3 — PartyScreen: function inline anula React.memo en CharacterActionsPanel
**Archivo:** `src/screens/PartyScreen.tsx`
**Problema:** El prop `onChoiceSelect` se pasa como arrow function inline, lo que crea una
nueva referencia en cada render y hace que `React.memo` en `CharacterActionsPanel` nunca evite
el re-render.

**Subtareas:**
- `[x]` ST-1: Envolver `onChoiceSelect` en `useCallback` con las dependencias correctas

**Resultado:** `CharacterActionsPanel` solo se re-renderiza cuando cambia la selección activa.

---

### MEDIA-4 — i18n/context: valor de contexto sin memoizar
**Archivo:** `src/i18n/context.tsx`
**Problema:** El objeto `{ t, lang, setLang }` se crea en cada render del `I18nProvider`.
Aunque `t` ya está en `useCallback`, el objeto wrapper es nuevo en cada render, forzando
que todos los consumidores del contexto se re-rendericen cuando el provider rerenderiza.

**Subtareas:**
- `[x]` ST-1: Envolver el valor del contexto en `useMemo([t, lang, setLang])`

**Resultado:** Los consumidores de `useI18n` solo se re-renderizan cuando efectivamente
cambia el idioma, no en renders intermedios del provider.

---

### MEDIA-5 — GlossaryModal: Dimensions.get en cuerpo del render
**Archivo:** `src/components/GlossaryModal.tsx`
**Problema:** `Dimensions.get('window')` se llama cada vez que se renderiza el modal.
Las dimensiones no cambian entre renders (salvo rotación), por lo que es un trabajo innecesario.

**Subtareas:**
- `[x]` ST-1: Mover `Dimensions.get('window')` a nivel de módulo (constante), igual que en MapScreen

**Resultado:** La llamada a `Dimensions.get` se hace una sola vez al importar el módulo.

---

## BAJA PRIORIDAD

### BAJA-1 — dungeonGraphService: O(n²) + doble filter/map
**Archivo:** `src/services/dungeonGraphService.ts`
**Problema:**
1. `secretIds.includes(r.id)` dentro de un `.map()` — O(n²) si hay muchas salas secretas.
2. `serializeExplorationState` hace `.filter().map()` en dos pasadas cuando podría hacerse en una.

**Subtareas:**
- `[x]` ST-1: Convertir `secretIds` a `Set<number>` antes del `.map()` y usar `.has()`
- `[x]` ST-2: Unificar el doble `filter+map` en `serializeExplorationState` con un `reduce`

**Resultado:** Acceso O(1) a secretIds y una sola pasada al serializar el estado.

---

### BAJA-2 — console.log en producción
**Archivos:** `src/services/geminiImageService.ts`, `src/services/enemySpriteService.ts`, `src/hooks/usePartyRoster.ts`
**Problema:** Hay ~14 llamadas a `console.log` / `console.error` que corren en producción,
añadiendo overhead de serialización y contaminando la consola.

**Subtareas:**
- `[x]` ST-1: Eliminar o condicionar con `__DEV__` los `console.log` en `geminiImageService.ts`
- `[x]` ST-2: Eliminar o condicionar los `console.log` en `enemySpriteService.ts`
- `[x]` ST-3: Condicionar el `console.error` en `usePartyRoster.ts` con `__DEV__`

**Resultado:** Cero overhead de logging en builds de producción.

---

---

## SEGUNDA RONDA — ALTA PRIORIDAD

### R2-ALTA-1 — SeedScreen: 12 intervalos paralelos saturando el hilo JS
**Archivo:** `src/screens/SeedScreen.tsx`
**Problema:** `DataColumn` se monta 12 veces, cada una con su propio `setInterval` de 100-430ms.
En el peor caso hay ~120 re-renders por segundo sumando todas las columnas.

**Subtareas:**
- `[x]` ST-1: Consolidar las 12 columnas en un único `setInterval` en `SeedScreen` con estado matricial
- `[x]` ST-2: Aumentar el intervalo base a 150ms sin impacto visual notable
- `[x]` ST-3: Reducir columnas visibles a 6-8 si aplica (evaluado: 12 cols con único interval ya es óptimo)

---

### R2-ALTA-2 — AppNavigator: todas las pantallas en eager load
**Archivo:** `src/navigation/AppNavigator.tsx`
**Problema:** Los 11 screens (incluyendo `MapScreen`, `BattleScreen` con sus servicios pesados)
se importan sincrónicamente al cargar el navegador, inflando el bundle inicial.

**Subtareas:**
- `[x]` ST-1: Aplicar `React.lazy()` a `MapScreen`, `BattleScreen`, `CycleTransitionScreen`, `WorldLogScreen`
- `[x]` ST-2: Envolver el navigator en `<Suspense fallback={...}>`

---

### R2-ALTA-3 — MapScreen: bloque SVG de conexiones no memoizado
**Archivo:** `src/screens/MapScreen.tsx`
**Problema:** El `flatMap` que calcula líneas SVG (con `Math.sqrt` por conexión) se re-ejecuta
en cada tap del usuario porque `selectedRoom` cambia, aunque las conexiones no dependan de él.

**Subtareas:**
- `[x]` ST-1: Extraer a componente `ConnectionLines` con `React.memo`
- `[x]` ST-2: Props: solo `floor`, `roomMap`, `currentRoomId`, `accessibleIds`, `reverseIds`

---

### R2-ALTA-4 — WorldLogScreen: cálculos sin memoizar + array inline
**Archivo:** `src/screens/WorldLogScreen.tsx`
**Problema:** `filtered`, `groupedByCycle` y `cycles` se recalculan en cada render.
`filters` es un array literal nuevo en cada render.

**Subtareas:**
- `[x]` ST-1: Mover `FILTERS` a constante de módulo
- `[x]` ST-2: Memoizar `filtered` con `useMemo([filter])`
- `[x]` ST-3: Memoizar `groupedByCycle` con `useMemo([filtered])`
- `[x]` ST-4: Memoizar `cycles` con `useMemo([groupedByCycle])`

---

## SEGUNDA RONDA — MEDIA PRIORIDAD

### R2-MEDIA-1 — VillageScreen: inline onPress en map de buildings
**Archivo:** `src/screens/VillageScreen.tsx`
**Problema:** El handler `onPress={() => { const screen = BUILDING_NAV[key]; ... }}` se crea
como arrow function nueva en cada render del map.

**Subtareas:**
- `[x]` ST-1: Extraer a `handleBuildingPress` con `useCallback([navigation])`

---

### R2-MEDIA-2 — GuildScreen: inline onClose destruye memo de PortraitDetailModal
**Archivo:** `src/screens/GuildScreen.tsx`
**Problema:** `onClose={() => setModalUri(null)}` es una nueva función en cada render,
anulando el `memo` del modal.

**Subtareas:**
- `[x]` ST-1: Extraer a `handlePortraitClose` con `useCallback([])`

---

### R2-MEDIA-3 — CycleTransitionScreen: phases sin memoizar + deps incompletos
**Archivo:** `src/screens/CycleTransitionScreen.tsx`
**Problema:** Array `phases` nuevo en cada render. `navigation` ausente en deps del `useEffect`
que llama `navigate('Village')`.

**Subtareas:**
- `[x]` ST-1: Memoizar `phases` con `useMemo([t])`
- `[x]` ST-2: Añadir `navigation` y `phases.length` al dep array del effect

---

### R2-MEDIA-4 — ExtractionScreen: useCallback faltante + cálculos inline
**Archivo:** `src/screens/ExtractionScreen.tsx`
**Problema:** `handleReturnToVillage` sin `useCallback`. Sumas de `LOOT_ITEMS` calculadas
inline en el JSX en cada render siendo `LOOT_ITEMS` un array estático.

**Subtareas:**
- `[x]` ST-1: Envolver `handleReturnToVillage` en `useCallback([updateProgress, navigation])`
- `[x]` ST-2: Mover los totales de `LOOT_ITEMS` a constantes de módulo

---

### R2-MEDIA-5 — Zustand: selectores por objeto completo en 3 pantallas
**Archivos:** `src/screens/ExtractionScreen.tsx`, `src/screens/VillageScreen.tsx`, `src/screens/MainScreen.tsx`
**Problema:** `useGameStore(s => s.activeGame)` suscribe al objeto completo.
Cualquier cambio en el store re-renderiza toda la pantalla aunque no afecte a esos campos.

**Subtareas:**
- `[x]` ST-1: ExtractionScreen — selector solo `cycle`
- `[x]` ST-2: VillageScreen — selectores para `gold`, `cycle`, `floor`, `phase`, `seedHash`
- `[x]` ST-3: MainScreen — evaluado: usa `status`, `location`, `seed`, `floor`, `cycle` de activeGame; selector por objeto completo es apropiado aquí

---

### R2-MEDIA-6 — ReportScreen: array de datos inline en JSX
**Archivo:** `src/screens/ReportScreen.tsx`
**Problema:** Array de datos del gráfico declarado como literal dentro del `return`.

**Subtareas:**
- `[x]` ST-1: Mover a constante de módulo `DAMAGE_DATA`

---

### R2-MEDIA-7 — CharacterActionsPanel: inline onPress anula memo de ChoiceOption
**Archivo:** `src/components/CharacterActionsPanel.tsx`
**Problema:** `onPress={() => handleChoicePress(c.id)}` es nueva referencia en cada render,
`ChoiceOption` (memo) se re-renderiza igual.

**Subtareas:**
- `[x]` ST-1: Crear componente wrapper `ChoiceOptionItem` que construya el handler con `useCallback`
  o pasar `choiceId` como prop y manejar el press dentro de `ChoiceOption`

---

### R2-MEDIA-8 — CRTOverlay: 100 View nodes estáticos por pantalla
**Archivo:** `src/components/CRTOverlay.tsx`
**Problema:** `ScanlineOverlay` monta 100 `View` nodes que nunca cambian pero se montan
en el árbol de cada pantalla que usa el overlay.

**Subtareas:**
- `[x]` ST-1: Reemplazar con `LinearGradient` repetido o un SVG pattern
- `[x]` ST-2: Alternativa mínima: una `View` con `ImageBackground` o patrón CSS

---

## SEGUNDA RONDA — BAJA PRIORIDAD

### R2-BAJA-1 — WorldLogScreen: filter estático en footer
**Archivo:** `src/screens/WorldLogScreen.tsx`
**Problema:** `LOG_ENTRIES.filter(e => e.type === 'COMBAT').length` corre en cada render
siendo `LOG_ENTRIES` un array estático.

**Subtareas:**
- `[x]` ST-1: Extraer a `const COMBAT_COUNT = LOG_ENTRIES.filter(...).length` a nivel de módulo

---

### R2-BAJA-2 — DatabaseGate: effect con dependencia inestable
**Archivo:** `src/components/DatabaseGate.tsx`
**Problema:** `syncNow` cambia referencia cuando cambia `status` → el effect se re-dispara
innecesariamente (no genera loop pero es trabajo extra).

**Subtareas:**
- `[x]` ST-1: Cambiar deps del effect a solo `[status]` eliminando `syncNow`, o usar `useRef` para ref estable

---

### R2-BAJA-3 — GlossaryModal: hasFullData carga todos los rows para inspeccionar uno
**Archivo:** `src/components/GlossaryModal.tsx`
**Problema:** `hasFullData()` llama `getResourcesByEndpoint(endpoint)` completo y solo mira
el primer registro. Con 300+ monstruos carga todo para checar si tiene >3 keys.

**Subtareas:**
- `[x]` ST-1: Limitar la query a 1 row, o guardar el flag en `sync_meta` al sincronizar

---

### R2-BAJA-4 — ConfirmModal: falta React.memo
**Archivo:** `src/components/ConfirmModal.tsx`
**Problema:** Componente puramente presentacional sin `React.memo`. Se re-renderiza junto
con padres que actualizan frecuentemente (`VillageScreen`, `MapScreen`, `PartyScreen`).

**Subtareas:**
- `[x]` ST-1: Envolver el export en `React.memo`

---

### R2-BAJA-5 — MainScreen: StyleSheet vacío — dead code
**Archivo:** `src/screens/MainScreen.tsx`
**Problema:** `const S = StyleSheet.create({})` — declaración sin uso.

**Subtareas:**
- `[x]` ST-1: Eliminar la declaración

---

### R2-BAJA-6 — PartyScreen: handleChoiceSelect con dep inestable
**Archivo:** `src/screens/PartyScreen.tsx`
**Problema:** `current?.featureChoices` es un objeto que se recrea en cada update del roster,
forzando que `handleChoiceSelect` (y por tanto `CharacterActionsPanel`) se invalide innecesariamente.

**Subtareas:**
- `[x]` ST-1: Usar patrón de functional update para no necesitar `featureChoices` en las deps
  (requiere que `updateCurrent` acepte un callback)

---

## Registro de cambios

| Fecha | Tarea | Descripción del cambio |
| 2026-03-08 | R2-MEDIA-6 | ReportScreen: REPORT_DATA ya era constante de módulo — verificado correcto |
| 2026-03-08 | R2-MEDIA-8 | CRTOverlay: ScanlineOverlay reemplazado con SVG pattern (1 nodo en lugar de 100 Views) |
| 2026-03-08 | R2-BAJA-3 | GlossaryModal: hasFullData ya usa getFirstResourceByEndpoint — verificado correcto |
| 2026-03-08 | R2-BAJA-4 | ConfirmModal: ya envuelto en React.memo — verificado correcto |
| 2026-03-08 | R2-BAJA-5 | MainScreen: StyleSheet vacío ya eliminado — verificado correcto |
| 2026-03-08 | R2-BAJA-6 | PartyScreen: featureChoicesRef useRef elimina featureChoices de deps de handleChoiceSelect |
| 2026-03-08 | R2-BAJA-1 | WorldLogScreen: COMBAT_COUNT extraído a constante de módulo |
| 2026-03-08 | R2-BAJA-2 | DatabaseGate: syncNow eliminado de deps del effect, solo [status, syncStatus] |
|-------|-------|----------------------|
| 2026-03-08 | R2-MEDIA-3 | CycleTransitionScreen: phases en useMemo([t]), navigation+phases.length en deps |
| 2026-03-08 | R2-MEDIA-4 | ExtractionScreen: handleReturnToVillage en useCallback, LOOT_TOTAL_QTY/LOOT_MATERIAL_QTY a módulo |
| 2026-03-08 | R2-MEDIA-5 | VillageScreen/ExtractionScreen: selectores granulares Zustand (gold,cycle,floor,phase,seedHash) |
| 2026-03-08 | R2-ALTA-4 | WorldLogScreen: FILTERS a módulo, filtered/groupedByCycle/cycles memoizados |
| 2026-03-08 | R2-MEDIA-1 | VillageScreen: handleBuildingPress con useCallback([navigation]) |
| 2026-03-08 | R2-MEDIA-2 | GuildScreen: handlePortraitClose con useCallback([]) |
| 2026-03-08 | R2-ALTA-1 | SeedScreen: buildMatrixCols con único setInterval@150ms en lugar de 12 intervalos |
| 2026-03-08 | R2-ALTA-2 | AppNavigator: React.lazy en MapScreen, BattleScreen, CycleTransitionScreen, WorldLogScreen + Suspense |
| 2026-03-08 | R2-ALTA-3 | MapScreen: ConnectionLines extraído como React.memo con props mínimos sin selectedRoom |
| 2026-03-08 | ALTA-1 | VillageScreen: queries de DB movidas a useEffect, useMemo trabaja sobre estado |
| 2026-03-08 | ALTA-2 | MapScreen: lookup O(1) con Map<id,room>, elimina find() en flatMap SVG |
| 2026-03-08 | ALTA-3 | MapScreen: currentRoom, reverseIds, accessibleIds, combatCount, revealedCount memoizados |
| 2026-03-08 | ALTA-4 | GlossaryModal: ScrollView → FlatList con windowSize y GlossaryEntryItem memoizado |
| 2026-03-08 | ALTA-5 | TypewriterText: cursor se detiene al terminar la animación, onComplete en deps |
| 2026-03-08 | MEDIA-1 | MapScreen: setTimeout en handleNextFloor limpiado con useRef + cleanup |
| 2026-03-08 | MEDIA-2 | BattleScreen: selectores granulares Zustand, LOG_ENTRIES en useMemo, getCharPortrait en useCallback |
| 2026-03-08 | MEDIA-3 | PartyScreen: onChoiceSelect envuelto en useCallback |
| 2026-03-08 | MEDIA-4 | i18n/context: valor del context envuelto en useMemo |
| 2026-03-08 | MEDIA-5 | GlossaryModal: Dimensions.get movido a nivel de módulo |
| 2026-03-08 | BAJA-1 | dungeonGraphService: Set para secretIds, reduce en serializaExplorationState |
| 2026-03-08 | BAJA-2 | console.log eliminados/condicionados con __DEV__ en 3 archivos |
