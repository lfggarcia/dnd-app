# PROJECT STATUS — TORRE (CYBER_DND)

**Rama:** `main`
**Fecha:** 2026-03-09
**Estado general:** 🟡 **PROTOTIPO AVANZADO — Game loop cerrado (Map→Battle→Report→Map); motor de combate DnD 5e real (iniciativa, tiradas, HP dinámico, log animado); Sprint 5 siguiente**

> Ver `GAME_CONTEXT.md` para la visión completa y `SYSTEMS.MD` como documento fundacional.

---

## Estado Actual

### ✅ Completado

| Área | Detalle |
|------|---------|
| Infraestructura | RN 0.84 + NativeWind v4 + Reanimated v4 + Gesture Handler v2 + op-sqlite v15 + react-native-svg v15 |
| Fuentes | RobotoMono completa integrada en iOS y Android |
| Sistema de color | Paleta CRT cyberpunk completa via CSS variables + Tailwind tokens |
| Navegación | Stack de 11 pantallas con transición `fade`, tipado completo (`RootStackParamList`) |
| Base de datos | SQLite con op-sqlite: schema v6 (resources, translations, sync_meta, saved_games con portraits + expressions), CRUD completo, batch upsert |
| Sincronización API | DnD 5e API (24 endpoints), sync on demand, tracking de progreso, DatabaseGate como wrapper |
| i18n | Sistema bilingüe ES/EN con Context + useI18n() hook, dot-notation keys, ~120+ claves |
| Sistema de traducciones | Puente de traducción con fallback chain (DB → API raw data) |
| Seed de datos | Traducciones ES, subclases custom (26), backgrounds custom se siembran en init |
| Reglas DnD 5e | Constantes nivel 1 completas: 13 clases, 26 subclases, 9 razas, features con traducciones |
| UI: Menú principal | TorreLogo SVG con neón roto + boot sequence TypewriterText + toggle idioma |
| UI: SeedScreen | Input de seed + efecto Matrix + transición ámbar animada |
| UI: PartyScreen | Creación de personaje REAL: nombre, raza, clase, subclase, trasfondo, alineamiento con datos DnD 5e; CharacterActionsPanel integrado; portrait generation + sección colapsable; generador de nombres por raza |
| UI: PartyScreen Tutorial | Tutorial step-by-step integrado con TutorialOverlay (next/prev/skip) |
| UI: PartyScreen Glosario | GlossaryModal con búsqueda por categorías (stats, razas, clases, monstruos, mecánicas) |
| UI: VillageScreen | Conectada a useGameStore real (gold, cycle, floor, phase); rivals, market items y amenazas determinísticos por seed; disclaimer antes de entrar a la Torre; BackHandler con confirmación de salida; iconos SVG de edificios |
| UI: MapScreen | 8 nodos generados por seed + floor (mapGenerator.ts); tipos y labels determinísticos por PRNG; radar rotativo Reanimated; botón X → ConfirmModal → guarda estado; restaura estados de nodos al reanudar; header muestra piso y ciclo reales; BackHandler bloqueado en torre; SAFE_ZONE interactiva con panel "Volver a la villa" |
| UI: GuildScreen | Roster completo con HP bar, stats grid, badges de estado (ACTIVO/HERIDO/MUERTO), portrait de personaje, navegación al WorldLog |
| UI: BattleScreen | Banner de portrait de grupo, portraits individuales por personaje, HUD piso/ciclo (datos mock) |
| UI: ReportScreen | Reporte con TypewriterText secuencial, gráfico de barras (mock) |
| UI: ExtractionScreen | Botón "Volver a la villa" conectado a useGameStore; habilitado al ciclo 60 |
| UI: CycleTransitionScreen | Transición de ciclo animada (Floor N → N+1) |
| Estado global | `useGameStore` (Zustand) — persiste activeGame, savedGames en SQLite; `startNewGame`, `loadGame`, `updateProgress`, `endGame`, `hydrate`, `clearActive` |
| Persistencia de partida | Schema `saved_games` (migración v2→v6); `gameRepository.ts` con `SavedGame`, `CharacterSave`; campos: seed, party, floor, cycle, phase, gold, status, location, mapState, partyPortrait, portraitsJson, expressionsJson |
| Routing por estado | MainScreen enruta "Continuar" a MapScreen o VillageScreen según `location` guardado |
| Componentes | `CRTOverlay`, `TypewriterText`, `SliderButton`, `DatabaseGate`, `GlossaryModal`, `TorreLogo`, `TutorialOverlay`, `ConfirmModal`, `CharacterActionsPanel`, `Icons` — 10 reutilizables y tipados |
| **Sistema de Retratos IA** | `geminiImageService.ts`: prompts visuales por raza/clase/trasfondo/alineamiento; `generateCharacterPortrait()` vía Google Gemini; persistencia en DB (portraits_json); auto-generación al iniciar expedición |
| **Expresiones faciales** | `expressionsJson` por personaje (neutral/happy/angry/sad/surprised/wounded) via ComfyUI img2img; workflow `02-expression-inpaint.json` con FaceDetailer |
| **Motor de Dungeon** | `dungeonGraphService.ts`: grafos de piso con 12–20 habitaciones, 7 tipos de sala, fog-of-war, salas secretas, mutaciones por ciclo |
| **Evolución de Monstruos** | `monsterEvolutionService.ts`: tiers por ciclo/piso, stats de 35+ enemigos, XP decay, sistema de jefes secretos |
| **Stats de Personaje** | `characterStats.ts`: `assignStandardArray`, `generateValidRolledStats`, `getRacialBonuses`, `computeFinalStats`, `pickRaceName`, tabla `CLASS_STAT_PRIORITY` para 12 clases |
| **Motor de Combate DnD 5e** | `combatEngine.ts`: PRNG seeded por roomId, `generateEnemiesForRoom`, `resolveCombat` con iniciativa/hit/daño/crit/HP; `damageDone` tracked; `log[]` animable; XP decay + gold; `CombatResult` type |
| **UI: MapScreen (dungeon graph)** | Conectado a `dungeonGraphService`: 12–20 habitaciones por piso; fog-of-war visual; navegación entre habitaciones con backtracking; estado de exploración persistido en `map_state`; avance de piso al limpiar BOSS; transición habitación → BattleScreen para NORMAL/ELITE/BOSS |
| **UI: BattleScreen** | Combat engine real: enemigos generados por `generateEnemiesForRoom`; combate resuelto por `resolveCombat`; log animado 70ms/línea con auto-scroll; HP bars actualizan post-combat; persiste HP via `updateProgress`; navega a Report con resultado |
| **UI: ReportScreen** | Lee `lastCombatResult` del store: enemigos derrotados reales, party status HP antes/después, XP y gold reales, gráfico barras daño por personaje; navega de vuelta a Map |
| **Game Loop cerrado** | `navigation/types.ts` con params tipados; Map → Battle (roomId/roomType) → Report (roomId/roomWasCleared) → Map; `lastCombatResult` in-memory en gameStore |
| **UI: MapScreen UX overhaul** | Node select + bottom action panel (`▶ ENTRAR`); overlay de descenso de piso (`isDescending`); corner brackets; SVG grid bg (`MapBackground`); glow rings en accesibles/seleccionado; enhanced current-room indicator (doble anillo pulsante); top color strips por tipo; fog nodes eliminados; `getRoomActionDesc()` |
| **Fix: Node overlap** | `dungeonGraphService.ts`: main rooms `y ∈ [0.05, 0.82]`, secret rooms `y ≥ 0.93` — elimina solapamiento visual |
| **Fix: Premature room reveal** | `useFocusEffect` en MapScreen revela adyacentes al volver de combate, no en tap |
| **UI: LogoIA** | `LogoIA.tsx`: componente de logo generado por IA (reemplaza TorreLogo en MainScreen); TorreLogo.tsx sigue disponible |
| **Party sub-components** | `src/components/party/`: `LaunchProgressModal.tsx`, `PortraitSection.tsx`, `PortraitDetailModal.tsx`, `RosterTabs.tsx` — refactor de PartyScreen.tsx en 4 sub-componentes reutilizables |
| **Hook usePartyRoster** | `hooks/usePartyRoster.ts`: lógica de roster de party extraída de PartyScreen |
| **Script de expresiones** | `scripts/generate-expressions.js`: generación batch de 7 expresiones faciales (neutral/angry/sad/surprised/wounded/scared/determined) via ComfyUI img2img con workflow `02-expression-inpaint.json` |
| **Catálogo de Sprites** | `enemySpriteService.ts`: 35+ tipos de enemigo, 5 animaciones por tipo; `spriteDbService.ts`: acceso a sprites bundleados; scripts de generación via ComfyUI |
| **Generador de mapas** | `mapGenerator.ts`: 8 nodos DAG por seed+floor; `dungeonGraphService.ts`: 12-20 rooms con fog of war |
| Calidad | Imports limpios, navigation tipado, barrel exports en database/services/i18n |

### 🚧 En Progreso / Pendiente

| Área | Detalle | Prioridad |
|------|---------|-----------|
| Simulación de mundo | `simulateWorld(cycle)` no existe — parties IA no avanzan realmente | 🔴 Alta |
| Sistema temporal | Ciclos y fases presentes en el modelo pero sin mecánica de avance real | 🔴 Alta |
| ~~Conexión Dungeon Graph → MapScreen~~ | ✅ Completado — MapScreen usa `dungeonGraphService` con 12–20 rooms, fog-of-war, mutaciones y avance de piso | ~~🟡 Media~~ |
| ~~Node overlap~~ | ✅ Corregido — `dungeonGraphService.ts` restringe bandas y | ~~🟡 Media~~ |
| ~~Premature room reveal~~ | ✅ Corregido — `useFocusEffect` revela adyacentes al volver de combate | ~~🟡 Media~~ |
| Portraits: modal de carga detallada | Flujo de inicio de expedición solo muestra texto estático; pendiente modal de progreso paso a paso | 🟡 Media |
| Parties IA | Rivals generados determinísticamente pero sin simulación real de progreso | 🟡 Media |
| Sistema de política | Sin alianzas, sin bounty, sin moral, sin World Log datos reales | 🟡 Media |
| Combate abstracto IA vs IA | `combatEngine.ts` base lista; falta el motor probabilístico abstracto (PowerScore) para IA vs IA | 🟡 Media |
| Testing | Solo 1 test de render básico — cobertura ~0% | 🟡 Media |
| Performance CRT | 100 Views por pantalla para scanlines | 🟡 Media |

---

## Roadmap — Sprints

### Sprint 1 — Fundación (MVP técnico) ✅ COMPLETADO

> Objetivo: conectar las pantallas con datos reales. El juego se puede "jugar" en modo básico.

- [x] Base de datos SQLite (op-sqlite): schema v1 + migrations v2/v3
- [x] Sincronización DnD 5e API (24 endpoints) con DatabaseGate
- [x] i18n bilingüe ES/EN con seed de traducciones
- [x] Creación de personaje real (stats, 13 clases, 26 subclases, 9 razas, trasfondos, alineamientos)
- [x] Glosario interactivo + Tutorial de creación
- [x] Estado global Zustand + persistencia SQLite (`useGameStore`)
- [x] Generador determinístico por seed (rivals, market, amenazas, nodos de mapa)
- [x] Mapa interactivo (8 nodos DAG por piso); SAFE_ZONE con "Volver a la villa"
- [x] VillageScreen + GuildScreen conectadas a useGameStore
- [x] Routing por estado (village / map) en MainScreen

### Sprint 2 — Visual y Asset Pipeline ✅ COMPLETADO

> Objetivo: personajes y enemigos tienen representación visual generada por IA.

- [x] Retratos de personaje vía Google Gemini API (`geminiImageService.ts`)
- [x] Persistencia de portraits en DB (migrations v4/v5)
- [x] Variantes de expresión facial vía ComfyUI img2img (migration v6)
- [x] Catálogo de sprites de enemigos (`enemySpriteService.ts`): 35+ tipos, 5 animaciones
- [x] Sprites pre-generados bundleados con Metro (`spriteDbService.ts`)
- [x] Scripts de generación batch (characters, sprites, test-sprite-gen)
- [x] ComfyUI workflows (base-sprite, expression-inpaint)
- [x] CharacterActionsPanel: panel de acciones DnD 5e con choices
- [x] Icons.tsx: librería SVG completa
- [x] GuildScreen con portraits; BattleScreen con banner de portrait + individuales
- [x] Modal "Retratos pendientes" temático (reemplazó Alert nativo)

### Sprint 3 — Motor de Dungeon ✅ COMPLETADO

> Objetivo: la exploración del dungeon tiene mecánica real con grafos y persistencia.

- [x] `dungeonGraphService.ts`: grafos de piso 12-20 rooms, fog-of-war, salas secretas, mutaciones
- [x] `monsterEvolutionService.ts`: tiers por ciclo, stats completos, XP decay, secret bosses
- [x] `characterStats.ts`: utilidades puras de stats DnD 5e; `assignStandardArray`, `generateValidRolledStats`, stat priorities por clase, racial bonuses
- [x] Conectar `dungeonGraphService` a `MapScreen` (reemplaza `mapGenerator.ts`)
- [x] `FloorExplorationState` persistido en `saved_games.map_state` (sin migración adicional — reutiliza v3)
- [x] Navegación entre habitaciones con backtracking (reversed connections)
- [x] Revelar habitaciones al explorar (fog-of-war visual con nodos `?`)
- [x] Transición habitación → BattleScreen para rooms NORMAL / ELITE / BOSS
- [x] Avance de piso (`handleNextFloor`) al limpiar sala BOSS

### Sprint 4A — Cerrar el Game Loop (pre-requisito de combate) ✅ COMPLETADO

> Objetivo: el dungeon puede completarse. Rooms se marcan, boss se limpia, pisos se avanzan.

- [x] `RootStackParamList`: añadir params a `Battle: { roomId: string; roomType: RoomType }` y `Report: { roomId: string; roomWasCleared: boolean }`
- [x] `MapScreen`: pasar `roomId` + `roomType` al navegar a BattleScreen
- [x] `BattleScreen`: leer params; al terminar combate (victoria/mock) navegar a Report con `roomWasCleared: true`
- [x] `ReportScreen`: recibir params; al "Continuar" llamar a callback/navegar de vuelta a MapScreen con resultado
- [x] `MapScreen`: al volver de Report, marcar la sala como `visited: true` en `floor` state, persistir `mapState`
- [x] Confirmar que `isBossCleared` activa el panel de avance de piso correctamente

### Sprint 4B — Motor de Combate DnD 5e ✅ COMPLETADO

> Objetivo: el combate es real. BattleScreen usa tiradas, HP, AC, turnos.

- [x] Motor de iniciativa (DEX + d20 seeded)
- [x] Hit roll: `(AttackMod + ProfBonus) vs EnemyAC`, nat-1 fumble, nat-20 crit
- [x] Daño: `WeaponBase + StatMod`, ×2 dados en crítico; `damageDone` tracked por actor
- [x] HP dinámico: HP real persiste post-combate via `updateProgress({ partyData })`
- [x] Turnos: auto-resolve por orden de iniciativa (simplified MVP)
- [x] Log de combate dinámico línea por línea (70ms/línea) con auto-scroll
- [x] Enemigos generados por `generateEnemiesForRoom(roomType, roomId, cycle, floor)` — determinístico
- [x] XP decay via `calculateXP`, gold = `round(totalXp × 0.15) + rng(5, 25)`
- [x] ReportScreen conectada a `lastCombatResult` del store (no mock)

### Sprint 5 — Motor de Simulación (Mundo Vivo)

> Objetivo: las parties IA son actores reales. El mundo avanza aunque el jugador no esté.

- [ ] `simulateWorld(cycle)`: procesa todas las parties IA hasta el ciclo actual
- [ ] Combate abstracto IA vs IA: `PowerScore = Σ(nivel × stat_mult × equip_factor)`
- [ ] Sistema temporal real: Day/Night avanza con acciones del jugador
- [ ] World Log conectado a eventos reales del motor
- [ ] CycleTransitionScreen muestra eventos reales del ciclo

### Sprint 6 — Capa Social (La Torre como sociedad)

> Objetivo: política entre parties funciona. Profundidad estratégica.

- [ ] Sistema de Moral: alineamiento cause tensión, abandono de miembros
- [ ] Sistema de Bounty: historial de violencia → mayor riesgo de emboscada
- [ ] Sistema de Alianzas: contratos con `protectionFee` y `expiresAtCycle`
- [ ] GuildScreen funcional: contratos activos, bounties publicados, World Log real
- [ ] Armería y Posada: compra de equipo, descanso con costo de ciclos
- [ ] Herencia de nivel entre temporadas

### Sprint 7 — Optimización y Release

- [ ] Migrar `CRTOverlay` a react-native-skia o reducir scanlines a 30-40
- [ ] Error Boundary en `App.tsx`
- [ ] Tests: componentes, combate engine, simulación IA, navegación
- [ ] Memoización de selectores Zustand; `StyleSheet.create` en MapScreen/PartyScreen
- [ ] Sonido: efectos de terminal, música ambient synthwave
- [ ] Haptic feedback: combate, SliderButton, extracción
- [ ] `SYSTEM_CONFIG`: idioma, dificultad, tema de color
- [ ] Builds de release para iOS App Store y Google Play

---

## Riesgos Técnicos Actuales

| Riesgo | Nivel | Mitigación propuesta |
|--------|-------|----------------------|
| Motor de simulación: 10 parties × 60 ciclos — debe ser ultra-eficiente | 🔴 Alto | Batch processing, cálculos vectorizados, sin loops por individuo |
| Performance por 100 Views de CRTOverlay × 10+ pantallas | 🔴 Alto | Migrar a Skia canvas o reducir scanlines a 40 |
| DnD 5e completo tiene muchas reglas de borde — bugs de combate probables | 🟡 Medio | Implementar por capas (base primero, spell slots después), tests |
| Sistema de política + moral + bounty: alto acoplamiento | 🟡 Medio | Interfaces claras entre módulos antes de implementar |
| Gemini API: latencia y cost por portrait generado | 🟡 Medio | Caché en DB; generación lazy (solo al abrir); portrait grupal opcional |
| Sin ErrorBoundary — crash crashea toda la app | 🟡 Medio | Añadir en App.tsx en Sprint 7 |
| ~~`dungeonGraphService.ts` no conectado~~ | ✅ Resuelto en Sprint 3 | — |

---

## Métricas del Proyecto

| Métrica | Valor |
|---------|-------|
| Pantallas actuales | 11 (Main, Seed, Party, Village, Guild, Map, Battle, Report, Extraction, WorldLog, CycleTransition) |
| Pantallas proyectadas | 13-15 (gestión de alianzas, detalle de habitación, config, dungeon detail) |
| Componentes reutilizables | 15 (CRTOverlay, TypewriterText, SliderButton, DatabaseGate, GlossaryModal, TorreLogo, LogoIA, TutorialOverlay, ConfirmModal, CharacterActionsPanel, Icons + party/: LaunchProgressModal, PortraitSection, PortraitDetailModal, RosterTabs) |
| Hooks custom | 5 (useDatabase, useGlossary, useResources, useTutorial, usePartyRoster) |
| Servicios | 15 (api5e, syncService, translationBridge, rulesConfig, subclassSeed, backgroundSeed, translationSeed, rivalGenerator, mapGenerator, dungeonGraphService, enemySpriteService, monsterEvolutionService, spriteDbService, characterStats, **combatEngine**) |
| Stores | 1 (useGameStore con SQLite) |
| Tablas en DB | 5 (resources, translations, sync_meta, saved_games + indexes) |
| Migraciones DB | 6 (v1 schema, v2 saved_games, v3 location+mapState, v4 party_portrait, v5 portraits_json, v6 expressions_json) |
| Endpoints API sincronizados | 24 |
| Tipos de enemigo catalogados | 35+ |
| Idiomas soportados | 2 (ES, EN) |
| Claves de traducción | ~120+ |
| Cobertura de tests | ~0% |
| Dependencias de producción | ~15 |
