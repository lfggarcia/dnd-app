# MASTER ROADMAP — TORRE (dnd3)
> Generado: 2026-03-14  
> Fuentes: audit-001/ROADMAP.md + codereview/review-002  
> Pipeline: rn-discover → rn-audit → rn-codereview → **MASTER MERGE** → rn-fix

---

## Resumen ejecutivo

| Fuente | Issues encontrados |
|---|---|
| rn-audit-001 | 41 hallazgos (7 seg + 11 perf + 7 arch + 4 test + 9 dep + 3 a11y) |
| rn-codereview-002 (services+stores) | 19 hallazgos |
| rn-codereview-002 (screens+hooks) | 19 hallazgos |
| **Total consolidado** | **~55 únicos** (desduplicados) |

---

## P0 — CRÍTICO (bloquea correctness o estabilidad)

> Aplicar ANTES de cualquier release o demo

| # | ID | Archivo | Descripción | Esfuerzo |
|---|---|---|---|---|
| 1 | ~~ARCH-001~~ | ~~AppNavigator.tsx~~ | ~~Sin ErrorBoundary global — crash sin recovery~~ | ~~30 min~~ ✅ |
| 2 | ~~SEG-009~~ | ~~múltiples~~ | ~~JSON.parse sin try/catch — crash con DB corrupta~~ | ~~30 min~~ ✅ |
| 3 | ~~CR-HR-01~~ | ~~useResources.ts~~ | ~~JSON.parse sin try/catch en hook~~ | ~~15 min~~ ✅ |
| 4 | ~~TEST-001~~ | ~~__tests__/~~ | ~~2 test suites fallan (op-sqlite mock)~~ | ~~30 min~~ ✅ |
| 5 | ~~CR-SS-01~~ | ~~syncService.ts~~ | ~~Sin timeout en fetch API — puede colgar~~ | ~~20 min~~ ✅ |
| 6 | ~~CR-BS-01~~ | ~~BattleScreen.tsx~~ | ~~Math.random() en defeatIllus rompe determinismo seed~~ | ~~10 min~~ ✅ |
| 7 | ~~CR-CE-01~~ | ~~combatEngine.ts~~ | ~~Personaje alive con hp=0 puede entrar en combate~~ | ~~10 min~~ ✅ |

---

## P1 — ALTO (debe estar en el próximo sprint)

| # | ID | Archivo | Descripción | Esfuerzo |
|---|---|---|---|---|
| 8 | ~~PERF-003~~ | ~~ReportScreen.tsx~~ | ~~Bloquea JS thread en mount~~ | ~~30 min~~ ✅ |
| 9 | ~~PERF-010~~ | ~~ExtractionScreen.tsx~~ | ~~setInterval 30ms = 33 renders/seg~~ | ~~30 min~~ ✅ |
| 10 | ~~DEP-002~~ | ~~package.json~~ | ~~@shopify/react-native-skia sin usar (~5 MB)~~ | ~~5 min~~ ✅ |
| 11 | ~~DEP-007~~ | ~~package.json~~ | ~~react-native-dotenv sin usar + riesgo exposición~~ | ~~10 min~~ ✅ |
| 12 | ~~DEP-001~~ | ~~package.json~~ | ~~react-native-fast-image sin usar~~ | ~~5 min~~ ✅ |
| 13 | ~~CR-WS-01~~ | ~~worldSimulator.ts~~ | ~~100ms guard muy ajustado en dispositivos lentos~~ | ~~15 min~~ ✅ |
| 14 | ~~CR-GS-03~~ | ~~gameStore.ts~~ | ~~advanceToVillage sin guard de loading — doble-tap~~ | ~~10 min~~ ✅ |
| 15 | ~~SEG-005~~ | ~~múltiples~~ | ~~console.warn sin __DEV__ guard filtra datos~~ | ~~10 min~~ ✅ |
| 16 | ~~CR-BS-04~~ | ~~BattleScreen.tsx~~ | ~~Loop DB en essence drops post-combat — latencia~~ | ~~30 min~~ ✅ |
| 17 | ~~CR-DBG-01~~ | ~~DatabaseGate.tsx~~ | ~~Sin botón de recuperación en error de DB init~~ | ~~20 min~~ ✅ |
| 18 | CR-BS-02 | BattleScreen.tsx | eslint-disable de exhaustive-deps — stale closures | 30 min (accepted) |

---

## P2 — MEDIO (backlog activo, próximas 2 semanas)

| # | ID | Archivo | Descripción | Esfuerzo |
|---|---|---|---|---|
| 19 | ~~PERF-006~~ | ~~CRTOverlay, otros~~ | ~~React.memo faltante en componentes costosos~~ | ~~30 min~~ ✅ |
| 20 | ~~PERF-007~~ | ~~CatalogPortraitPicker~~ | ~~FlatList sin keyExtractor/getItemLayout~~ | ~~20 min~~ ✅ |
| 21 | PERF-011 | VillageScreen.tsx | SQLite sync síncrona en VillageScreen mount | 15 min |
| 22 | PERF-012 | GuildScreen.tsx | Portrait assignment loop en GuildScreen | 20 min |
| 23 | ARCH-002 | múltiples | Empty catch blocks — documentar o logging | 1 h |
| 24 | ARCH-007 | repository*.ts | Transacciones faltantes en repos secundarios | 1 h |
| 25 | SEG-002 | servicios ComfyUI | IPs LAN hardcodeadas | 30 min |
| 26 | ~~CR-CE-02~~ | ~~combatEngine.ts~~ | ~~goldEarned acoplado a XP — 0.15 hardcoded~~ | ~~15 min~~ ✅ |
| 27 | ~~CR-CE-03~~ | ~~combatEngine.ts~~ | ~~MAX_ROUNDS sin verificación defensiva~~ | ~~10 min~~ ✅ |
| 28 | ~~CR-RG-01~~ | ~~rivalGenerator.ts~~ | ~~Límite de 5 rivals hardcoded — hacerlo constante~~ | ~~10 min~~ ✅ |
| 29 | ~~CR-BS-03~~ | ~~BattleScreen.tsx~~ | ~~HELP action siempre elige primer aliado~~ | ~~15 min~~ ✅ |
| 30 | ~~CR-MS-01~~ | ~~MapScreen.tsx~~ | ~~parseExplorationState duplicado en screen~~ | ~~20 min~~ ✅ |
| 31 | CR-AN-01 | AppNavigator.tsx | Lazy screens sin ErrorBoundary visible | 20 min |
| 32 | CR-PY-02 | PartyScreen.tsx | Screen >800 líneas — extraer hooks custom | 2 h |
| 33 | CR-VS-01 | VillageScreen.tsx | deterministicPick debería ser utility shared | 10 min |
| 34 | CR-SS-02 | syncService.ts | Sin retry logic en syncAll | 30 min |
| 35 | CR-DG-01 | dungeonGraphService.ts | Connections Array vs Set — documentar límite | 10 min |
| 36 | BRF-002 | múltiples pantallas | Strings hardcodeados sin i18n en 12+ screens | 4 h |
| 37 | TEST-004 | .github/ | Configurar CI (GitHub Actions) | 30 min |

---

## P3 — BAJO (mejoras de calidad, deuda técnica)

| # | ID | Archivo | Descripción | Esfuerzo |
|---|---|---|---|---|
| 38 | PERF-001 | 4 componentes | Migrar Animated → Reanimated | 2 h |
| 39 | ARCH-003 | múltiples | Archivos masivos — extraer sub-componentes | 4 h |
| 40 | ARCH-005 | navigation | Casts `as React.ComponentType<object>` | 2 h |
| 41 | A11Y-001 | toda la app | Zero accessibility props — añadir mínimo ARIA | 3 h |
| 42 | TEST-002 | combatEngine.test.ts | Aumentar cobertura de combatEngine | 4 h |
| 43 | BRF-001 | assets/ | 1.3 GB de assets — comprimir o CDN | 3-5 d |
| 44 | ~~CR-PS-02~~ | ~~progressionService.ts~~ | ~~MAX_LEVEL_MVP no en config central~~ | ~~5 min~~ ✅ |
| 45 | ~~CR-CE-04~~ | ~~combatEngine.ts~~ | ~~Sin tie-breaking DEX en initiative~~ | ~~15 min~~ ✅ |
| 46 | CR-EC-02 | economyService.ts | Costos de descanso no escalan con floor | 20 min |
| 47 | ~~CR-LS-01~~ | ~~lootService.ts~~ | ~~Loot ID puede colisionar — usar separador `::`~~ | ~~5 min~~ ✅ |
| 48 | ~~CR-GS-02~~ | ~~gameStore.ts~~ | ~~Import inline de tipos en GameState~~ | ~~10 min~~ ✅ |
| 49 | ~~CR-WS-04~~ | ~~worldSimulator.ts~~ | ~~decideAction/executeAction no exportadas~~ | ~~5 min~~ ✅ |
| 50 | CR-AL-01 | allianceService.ts | counterOffer puede ser undefined implícito | 10 min |
| 51 | CR-RG-02 | rivalGenerator.ts | PRNG seed de rivals no incluye cycle | 15 min |
| 52 | CR-AN-02 | AppNavigator.tsx | Inconsistencia lazy vs eager en algunos screens | 30 min |
| 53 | ~~DEP-003~~ | ~~package.json~~ | ~~react-native-worklets — verificar si se usa~~ | ~~10 min~~ ✅ |
| 54 | ~~DEP-005~~ | ~~package.json~~ | ~~@react-native/new-app-screen — remover~~ | ~~2 min~~ ✅ |
| 55 | ~~DEP-006~~ | ~~package.json~~ | ~~uuid — remover (se usa PRNG propio)~~ | ~~2 min~~ ✅ |

---

## Progreso del roadmap

| Prioridad | Total | Completados | Pendientes |
|---|---|---|---|
| P0 Crítico | 7 | 7 | 0 |
| P1 Alto | 11 | 10 | 1 |
| P2 Medio | 19 | 7 | 12 |
| P3 Bajo | 18 | 8 | 10 |
| **TOTAL** | **55** | **32** | **23** |

---

## Orden de implementación (rn-fix)

El agente `rn-fix` debe aplicar los fixes siguiendo el orden P0 → P1 → P2 → P3,
marcando cada item `- [x]` cuando esté completado.

**Restricciones:**
- No modificar `ios/`, `android/`, `node_modules/`, `vendor/`
- Verificar que el issue aún existe antes de aplicar el fix
- Priorizar fixes que no requieran cambios de diseño UI
- Para P3 con esfuerzo >1h, documentar el approach antes de escribir código
