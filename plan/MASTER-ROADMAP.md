# 🗺️ MASTER ROADMAP — pipeline-001
**Fecha:** 2026-03-14 | **Proyecto:** TORRE (dnd3)  
**Fuentes:** audit-001 (41 issues) + codereview review-001 (51 issues) = **92 issues totales**  
**Deduplicados:** audit SEG-009 ≈ CR-015 | audit ARCH-003 ≈ CR-017

---

## Estado global

| Fase | Issues | Críticos | Medios | Bajos |
|---|---|---|---|---|
| 🔴 Fase 1 — Crashers | 12 | 12 | 0 | 0 |
| 🟡 Fase 2 — Correctness | 21 | 0 | 21 | 0 |
| 🟢 Fase 3 — Polish | 14 | 0 | 0 | 14 |
| 📦 Fase 4 — Deps/Cleanup | 8 | 0 | 3 | 5 |

---

## 🔴 FASE 1 — Crashers & Data Corruption (hacer YA)
> Estos bugs pueden crashear la app, corromper save data o causar comportamiento completamente incorrecto.  
> Tiempo estimado: ~5 horas

- [ ] **CR-018** `CampScreen`: `advanceToVillage()` invocado dos veces — doble simulación, doble escritura DB  
  📄 [02-screens-navigation.md](../codereview/review-001/02-screens-navigation.md)

- [ ] **CR-015** `gameRepository.ts`: `JSON.parse(party_data)` sin try-catch — crash en hydrate del store  
  📄 [01-services-stores-db.md](../codereview/review-001/01-services-stores-db.md)

- [ ] **CR-001** `progressionService.ts`: `awardXP` double-counts pending level-ups — personaje salta 2 niveles  
  📄 [01-services-stores-db.md](../codereview/review-001/01-services-stores-db.md)

- [ ] **CR-009** `worldSimulator.ts`: `aiStates` crece sin límite — memory leak O(ciclos × parties)  
  📄 [01-services-stores-db.md](../codereview/review-001/01-services-stores-db.md)

- [ ] **CR-010** `gameStore.ts/worldSimulator.ts`: `advanceToVillage` simula desde ciclo 0 (ignora fromCycle)  
  📄 [01-services-stores-db.md](../codereview/review-001/01-services-stores-db.md)

- [ ] **CR-017** `gameStore.ts`: `advanceCycle` race condition por doble-tap — simulación duplicada  
  📄 [01-services-stores-db.md](../codereview/review-001/01-services-stores-db.md)

- [ ] **CR-024** `VillageScreen.tsx`: `getItemsByGame` SQLite síncrona en useMemo — bloquea JS thread en render  
  📄 [02-screens-navigation.md](../codereview/review-001/02-screens-navigation.md)

- [ ] **CR-026** `MapScreen.tsx`: selector `activeGame` completo — re-renders en pantalla más compleja  
  📄 [02-screens-navigation.md](../codereview/review-001/02-screens-navigation.md)

- [ ] **CR-028** `CycleTransitionScreen.tsx`: `Animated.loop` sin ref — memory leak tras navegación  
  📄 [02-screens-navigation.md](../codereview/review-001/02-screens-navigation.md)

- [ ] **CR-030** `NegotiationScreen.tsx`: `seedHash`/`cycle` stale en `handleFlee` — dado de huida incorrecto  
  📄 [02-screens-navigation.md](../codereview/review-001/02-screens-navigation.md)

- [ ] **CR-060** `CRTOverlay.tsx`: Reanimated worklet sin `cancelAnimation` — worklets huérfanos acumulados  
  📄 [03-components-hooks-utils.md](../codereview/review-001/03-components-hooks-utils.md)

- [ ] **CR-066** `imageStorageService.ts`: race condition en nombres de temp — expresiones corruptas  
  📄 [03-components-hooks-utils.md](../codereview/review-001/03-components-hooks-utils.md)

---

## 🟡 FASE 2 — Correctness & DnD 5e Accuracy (próximo sprint)
> Bugs de comportamiento incorrecto, lógica de juego errónea, leaks menores, UX rota.  
> Tiempo estimado: ~8 horas

- [ ] **CR-003** `combatEngine.ts`: Monk `LLUVIA_GOLPES` ≠ log `LLUVIA_DE_GOLPES` — eventos ability_used perdidos
- [ ] **CR-004** `combatEngine.ts`: `PROF_BONUS=2` hardcodeado — no escala con nivel (DnD 5e)
- [ ] **CR-007** `dungeonGraphService.ts`: off-by-one — ELITE room siempre queda como NORMAL
- [ ] **CR-011** `worldSimulator.ts`: división por cero si action weights todos = 0 — AI corrupida silenciosamente
- [ ] **CR-012** `encounterService.ts`: flee seed determinista — retry siempre falla/acierta igual
- [ ] **CR-013** `moralSystem.ts`: replacement hereda maxHp incompatible con sus stats base
- [ ] **CR-014** `moralSystem.ts`: abandonment logic invertida — LG desartan, CE son leales (antiDnD)
- [ ] **CR-019** `CampScreen.tsx`: selector `activeGame` completo viola code_style
- [ ] **CR-020** `CampScreen.tsx`: navegación post-await sin isMounted guard
- [ ] **CR-021** `BattleScreen.tsx`: `Math.random()` en useMemo — no determinista en Strict Mode
- [ ] **CR-022** `BattleScreen.tsx`: stale closure `cs` en useEffect de INITIATIVE
- [ ] **CR-023** `ReportScreen.tsx`: gold stale en efecto de loot con deps `[]`
- [ ] **CR-025** `VillageScreen.tsx`: `.then(navigation)` sin guardia de unmount en Inn
- [ ] **CR-027** `MapScreen.tsx`: handleReturnToVillage sin guardia de unmount
- [ ] **CR-029** `SimulationLoadingScreen.tsx`: progress bar siempre estática en 0%
- [ ] **CR-031** `NegotiationScreen.tsx`: handleProposeAlliance pierde rivalName al navegar a Alliance
- [ ] **CR-032** `LevelUpScreen.tsx`: setTimeout sin clearTimeout ref — navega sobre stack modificado
- [ ] **CR-033** `GuildScreen.tsx`: useGameStore.getState() directo en useEffect
- [ ] **CR-034** `AllianceScreen.tsx`: generateRivals() sin useMemo — recalcula en cada re-render
- [ ] **CR-061** `TypewriterText.tsx`: cursor blink se detiene al reutilizar el componente
- [ ] **CR-062** `DatabaseGate.tsx`: syncNow ausente en deps del useEffect
- [ ] **CR-063** `TutorialOverlay.tsx`: cancelAnimation faltante al desmontar abruptamente
- [ ] **CR-064** `GlossaryModal.tsx`: efecto carga DB ignora visibility — trabajo innecesario con modal cerrado
- [ ] **CR-065** `CatalogPortraitPicker.tsx`: FlatList sin getItemLayout ni windowing — 30-100 items sin optimizar
- [ ] **CR-067** `i18n/context.tsx`: tipo `any` en t() — type-safety eliminada en todo el sistema de i18n
- [ ] **CR-068** `useResources.ts`: mountedRef compartido es frágil ante requests concurrentes

---

## 🟢 FASE 3 — Polish & DX (cuando haya tiempo)
> Code style, ergonomía, tipos flojos, optimizaciones menores.

- [ ] **CR-002** `combatEngine.ts`: enemy target lookup por name — vulnerable a duplicados
- [ ] **CR-005** `combatEngine.ts`: LOOT_TABLE duplicada inline en buildCombatResultFromLive
- [ ] **CR-008** `dungeonGraphService.ts`: applyExplorationState O(n²) sin Set
- [ ] **CR-016** `gameRepository.ts`: `null as unknown as string` — TypeScript type hack
- [ ] **CR-035** `CharacterDetailScreen.tsx`: generatingPortrait en deps de useCallback
- [ ] **CR-036** `MarketScreen/BlacksmithScreen`: RARITY_COLOR inline en render
- [ ] **CR-037** `AppNavigator.tsx`: GuildScreen/CharacterDetailScreen/PartyScreen no lazy-loaded  
- [ ] **CR-038** `types.ts`: eventType: string demasiado amplio
- [ ] **CR-039** `types.ts`: Extraction union innecesaria con | undefined
- [ ] **CR-040** `SeedScreen.tsx`: hash calculado dos veces sin useMemo
- [ ] **CR-069** `usePartyRoster.ts`: handleGeneratePortrait sin guard de desmontaje
- [ ] **CR-070** `aiProfileEngine.ts`: log semánticamente incorrecto

---

## 📦 FASE 4 — Deps & Cleanup (audit carryover)

- [ ] **DEP-002** `@shopify/react-native-skia` sin usar — eliminar (~5 MB binary)
- [ ] **DEP-007** `react-native-dotenv` sin usar — eliminar + riesgo de exposición de env vars
- [ ] **DEP-001** `react-native-fast-image` sin usar — eliminar
- [ ] **DEP-004** Actualizar React Native 0.84.0 → 0.76+ (New Architecture)
- [ ] **ARCH-001** Añadir ErrorBoundary global — sin crash recovery actualmente
- [ ] **ARCH-005** Normalizar naming conventions (PascalCase en varios archivos)
- [ ] **TEST-001** Corregir 2 test suites que fallan (op-sqlite mock)
- [ ] **SEG-002** IPs LAN hardcodeadas en servicios ComfyUI (dev-only pero visibles)

---

## Progreso general

🔴 Fase 1: 0/12 completados  
🟡 Fase 2: 0/26 completados  
🟢 Fase 3: 0/12 completados  
📦 Fase 4: 0/8 completados  
**Total: 0/58 completados**
