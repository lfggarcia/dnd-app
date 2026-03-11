# TORRE — ROADMAP Y TIMELINE
> Versión 2.0 · 2026-03-11 · Incluye docs 11–13, resolución de conflictos de integridad y bloque PRNG utilitario

---

## Resumen de sprints

| Sprint | Foco | Docs | Estado |
|--------|------|------|--------|
| 4B | Combate DnD 5e real | — | ✅ completado |
| 4C | Sistema narrativo emocional | 10 | 🔵 siguiente |
| 5 | Tiempo + simulación IA + PRNG base | 01, 04, 08 | ⬜ pendiente |
| 6 | Economía, parties, dungeon completo | 02, 03, 05, 06, 07, 08, 11, 12 | ⬜ pendiente |
| 7 | IA avanzada + Esencias + Ascensión | 09, 13, 08 | ⬜ pendiente |
| 8 | Polish, balance, launch prep | — | ⬜ pendiente |

---

## Sprint 4C — Sistema Narrativo Emocional
> Prerequisito: Sprint 4B (combate DnD 5e) ✅

| ID | Tarea | Referencia | Estado |
|----|-------|-----------|--------|
| 4C-01 | Añadir `CombatEventType`, `CombatEvent`, `events?` a `CombatResult` | doc 10 → Paso 1 | 🔴 |
| 4C-02 | Completar `buildCombatResultFromLive()` para derivar eventos | doc 10 → Paso 1 | 🔴 |
| 4C-03 | Crear `src/services/emotionalNarrativeService.ts` | doc 10 → Paso 2 | 🔴 |
| 4C-04 | Crear `src/components/NarrativeMomentPanel.tsx` | doc 10 → Paso 3 | 🔴 |
| 4C-05 | Reemplazar `getPartyPortrait()` hardcodeado en `BattleScreen` | doc 10 → Paso 4 | 🔴 |
| 4C-06 | Añadir `partyEmotions`, `activeMoment`, `processEmotionEvents` a `BattleScreen` | doc 10 → Paso 4 | 🔴 |
| 4C-07 | Renderizar `NarrativeMomentPanel` cuando `activeMoment !== null` | doc 10 → Paso 4 | 🔴 |

---

## Sprint 5 — Tiempo + Simulación IA + Base de Datos

### Bloque 5-A · PRNG utilitario (prerrequisito de todo) ⚠️ PRIMERO

| ID | Tarea | Referencia | Estado |
|----|-------|-----------|--------|
| 5A-01 | Crear `src/utils/prng.ts` con `makePRNG()` compartido | doc 08 → "Utilitario PRNG" | 🔴 |
| 5A-02 | Reemplazar `makePRNG` inline en `combatEngine.ts` | doc 08 NI-03 | 🔴 |
| 5A-03 | Reemplazar `makePRNG` inline en `dungeonGraphService.ts` | doc 08 NI-03 | 🔴 |

### Bloque 5-B · Sistema Temporal

| ID | Tarea | Referencia | Estado |
|----|-------|-----------|--------|
| 5B-01 | Crear `src/services/timeService.ts` con todas las `TimeAction` | doc 01 → Paso 1 | 🔴 |
| 5B-02 | Migration v7: `cycle_raw`, `last_action_at`, `last_sim_events` | doc 08 → Migration v7 | 🔴 |
| 5B-03 | Añadir `advanceCycle` + `advanceToVillage` al `gameStore.ts` | doc 01 → Paso 3 | 🔴 |
| 5B-04 | Conectar `CycleTransitionScreen` al store real | doc 01 → Paso 2 | 🔴 |
| 5B-05 | Trigger `advanceCycle('REST_LONG')` en VillageScreen | doc 01 → Paso 4 | 🔴 |
| 5B-06 | Trigger `advanceCycle('RETURN_VILLAGE')` al salir del dungeon | doc 01 checklist | 🔴 |
| 5B-07 | Modal de cierre al ciclo 60 | doc 01 checklist | 🔴 |

### Bloque 5-C · World Simulator

| ID | Tarea | Referencia | Estado |
|----|-------|-----------|--------|
| 5C-01 | Crear `src/services/worldSimulator.ts` — tipos y PRNG | doc 04 → Paso 1-2 | 🔴 |
| 5C-02 | Implementar `decideAction()` con perfiles base (4 iniciales) | doc 04 → Paso 3-4 | 🔴 |
| 5C-03 | Implementar `executeAction()` con las 5 acciones | doc 04 → Paso 5 | 🔴 |
| 5C-04 | Implementar `simulateWorld()` — entry point | doc 04 → Paso 6 | 🔴 |
| 5C-05 | Conectar `WorldLogScreen` a `lastSimulationEvents` | doc 04 → Paso 7 | 🔴 |
| 5C-06 | Benchmark: 10 parties × 60 ciclos < 100ms | doc 04 checklist | 🔴 |

---

## Sprint 6 — Economía, Parties, Dungeon Completo

### Bloque 6-A · Migrations y Arquitectura

| ID | Tarea | Referencia | Estado |
|----|-------|-----------|--------|
| 6A-01 | Migration v8: tabla `items` | doc 08 | 🔴 |
| 6A-02 | Migration v9: tablas `events` y `bounties` | doc 08 | 🔴 |
| 6A-03 | Migration v10: tabla `alliances` | doc 08 | 🔴 |
| 6A-04 | Migration v11: `in_safe_zone`, `safe_zone_room_id` | doc 08 | 🔴 |
| 6A-05 | Migration v12: `party_origin`, `predecessor_game_id`, `created_by_player` | doc 08 | 🔴 |
| 6A-06 | Crear `itemRepository.ts` | doc 08 | 🔴 |
| 6A-07 | Crear `eventRepository.ts` | doc 08 | 🔴 |
| 6A-08 | Actualizar `gameRepository.ts` con `CharacterSave` canónico | doc 08 → "CharacterSave Canónico" | 🔴 |

### Bloque 6-B · Economía y Loot

| ID | Tarea | Referencia | Estado |
|----|-------|-----------|--------|
| 6B-01 | Crear `economyService.ts` con `calculateReviveCost()` | doc 02 → Paso 2 | 🔴 |
| 6B-02 | Crear `lootService.ts` con `generateRoomLoot()` y `generateBossUniqueLoot()` | doc 02 → Paso 3 | 🔴 |
| 6B-03 | VillageScreen: revivir con costo real | doc 02 → Paso 4 | 🔴 |
| 6B-04 | BattleScreen: incrementar `deathCount` al morir | doc 02 → Paso 5 | 🔴 |
| 6B-05 | ReportScreen: guardar loot en DB post-combate | doc 02 → Paso 6 | 🔴 |

### Bloque 6-C · Progresión y Parties

| ID | Tarea | Referencia | Estado |
|----|-------|-----------|--------|
| 6C-01 | Crear `progressionService.ts` con XP/niveles (MAX_LEVEL_MVP = 10) | doc 06 → Paso 1 | 🔴 |
| 6C-02 | Aplicar XP post-combate en `BattleScreen` | doc 06 → Paso 2 | 🔴 |
| 6C-03 | Herencia de nivel al crear nueva party | doc 06 → Paso 3 | 🔴 |
| 6C-04 | Límite de parties por seed (máx 2 IA_INHERITED) | doc 06, doc 12 | 🔴 |
| 6C-05 | Crear `seedUnificationService.ts` | doc 12 → Paso 1-2 | 🔴 |
| 6C-06 | `UnificationScreen` — pantalla de impacto narrativo | doc 12 → Paso 3 | 🔴 |
| 6C-07 | Guardia en VillageScreen: `towerClosed` requerido | doc 12 → Paso 5 | 🔴 |

### Bloque 6-D · Moral y Bounty

| ID | Tarea | Referencia | Estado |
|----|-------|-----------|--------|
| 6D-01 | Crear `moralSystem.ts` con `applyMoralEvent()` y `checkForAbandonment()` | doc 05 → Paso 3 | 🔴 |
| 6D-02 | Crear `bountyService.ts` con `recordPartyKill()` | doc 05 → Paso 4 | 🔴 |
| 6D-03 | GuildScreen: mostrar bounty activo y moral | doc 05 → Paso 5 | 🔴 |
| 6D-04 | BattleScreen: aplicar moral y registrar bounty post-PvP | doc 05 → Paso 6 | 🔴 |

### Bloque 6-E · Combate Expandido

| ID | Tarea | Referencia | Estado |
|----|-------|-----------|--------|
| 6E-01 | `navigation/types.ts`: añadir `EncounterContext` | doc 03 → Paso 1 | 🔴 |
| 6E-02 | Crear `encounterService.ts` con `checkForEncounter()` | doc 03 → Paso 2 | 🔴 |
| 6E-03 | BattleScreen: pantalla pre-combate Atacar/Negociar/Huir | doc 03 → Paso 3 | 🔴 |
| 6E-04 | Emboscada: bonus de iniciativa | doc 03 → Paso 4 | 🔴 |
| 6E-05 | MapScreen: llamar `checkForEncounter` antes de navegar a Battle | doc 03 → Paso 5 | 🔴 |
| 6E-06 | Añadir `monsterKey` y `enemyType` a `MonsterStats` | doc 03 → v2 | 🔴 |
| 6E-07 | Añadir `essenceDrops` a `CombatResult` | doc 03 → v2 | 🔴 |

### Bloque 6-F · Zonas Seguras

| ID | Tarea | Referencia | Estado |
|----|-------|-----------|--------|
| 6F-01 | Añadir `SAFE_ZONE` a `RoomType` en `dungeonGraphService.ts` | doc 11 → Paso 1 | 🔴 |
| 6F-02 | Crear `safeZoneService.ts` con `isSafeZoneNode()` | doc 11 → Paso 1 | 🔴 |
| 6F-03 | `CampScreen` con 4 tabs: PARTY / INVENTORY / ESSENCES / REST | doc 11 → Paso 3, doc 13 → Paso 9 | 🔴 |
| 6F-04 | `LevelUpScreen` con elección de stat y habilidad | doc 11 → Paso 4 | 🔴 |
| 6F-05 | `SubclassSelectionPanel` en niveles 3/6/9 | doc 11 → Paso 5 | 🔴 |
| 6F-06 | Tab REST: descanso corto y espera de fin de temporada | doc 11 → Paso 6 | 🔴 |
| 6F-07 | `gameStore.advanceToVillage()` + `SimulationLoadingScreen` | doc 01, doc 12 | 🔴 |

### Bloque 6-G · Alianzas y Gremio

| ID | Tarea | Referencia | Estado |
|----|-------|-----------|--------|
| 6G-01 | Crear `allianceService.ts` | doc 07 → Paso 2 | 🔴 |
| 6G-02 | GuildScreen: hub social (alianzas, bounties, WorldLog) | doc 07 → Paso 3 | 🔴 |
| 6G-03 | `AllianceScreen`: propuesta y términos | doc 07 → Paso 4 | 🔴 |

---

## Sprint 7 — IA Avanzada + Sistema de Esencias

### Bloque 7-A · IA Avanzada

| ID | Tarea | Referencia | Estado |
|----|-------|-----------|--------|
| 7A-01 | Crear `aiMemoryService.ts` | doc 09 → Paso 1 | 🔴 |
| 7A-02 | Crear `aiProfileEngine.ts` con 5 perfiles + `inferProfileFromPlayerHistory()` | doc 09 → Paso 2 | 🔴 |
| 7A-03 | Crear `culturalEvolution.ts` | doc 09 → Paso 3 | 🔴 |
| 7A-04 | Integrar los 3 servicios en `worldSimulator.ts` | doc 09 → Paso 4 | 🔴 |
| 7A-05 | Actualizar `AIProfile` en `worldSimulator.ts` para incluir `EXPANSIONIST` | doc 04 v2, doc 09 | 🔴 |
| 7A-06 | Test de regresión: seed fija → mismos eventos siempre | doc 09 checklist | 🔴 |

### Bloque 7-B · Sistema de Esencias

| ID | Tarea | Referencia | Estado |
|----|-------|-----------|--------|
| 7B-01 | Migration v13: tablas `essences` y `monster_kills` | doc 08 → Migration v13 | 🔴 |
| 7B-02 | Crear `essenceService.ts`: tipos, catálogo, drop, evolución | doc 13 → Pasos 1–4 | 🔴 |
| 7B-03 | Crear `essenceRepository.ts`: CRUD completo | doc 13 → Paso 6 | 🔴 |
| 7B-04 | `combatEngine.ts`: `processEnemyDeath()` con drop y kill tracking | doc 13 → Paso 7 | 🔴 |
| 7B-05 | `buildCombatModifiers()`: aplicar efectos activos de esencias | doc 13 → Paso 8 | 🔴 |
| 7B-06 | `CampScreen`: tab ESSENCES funcional | doc 13 → Paso 9 | 🔴 |
| 7B-07 | `AscensionScreen`: 3 caminos | doc 13 → Pasos 10-11 | 🔴 |
| 7B-08 | `calculatePartyPower()`: añadir `essenceBonus` | doc 13 → Paso 12 | 🔴 |
| 7B-09 | `ReportScreen`: mostrar drops + trigger narrativo emocional | doc 13 → Paso 13 | 🔴 |
| 7B-10 | Expandir catálogo a las 100 esencias del Sistema Híbrido RPG.MD | doc 13 catálogo | 🔴 |
| 7B-11 | Subir `MAX_LEVEL` de 10 a 20 en `progressionService.ts` | doc 06 v2, doc 13 | 🔴 |
| 7B-12 | Nuevos `CombatEventType` para esencias en `combatEngine.ts` | doc 10 v2 | 🔴 |

---

## Sprint 8 — Polish y Launch Prep

| ID | Tarea |
|----|-------|
| 8-01 | Balance de economía: ajustar `REVIVE_BASE_COST` con datos reales |
| 8-02 | Balance de esencias: ajustar drop rates por tipo de enemigo |
| 8-03 | Test de stress: seed con 60 ciclos + 10 parties IA con memoria |
| 8-04 | Onboarding: tutorial de zonas seguras y esencias |
| 8-05 | Localización completa (ES/EN) para textos narrativos y esencias |
| 8-06 | Checklist pre-launch: ver RIESGOS_Y_MEJORAS.md |

---

## Árbol de dependencias completo

```
5A (PRNG utilitario) ← PRIMERO — todo lo demás lo importa
    └─▶ 5B (Tiempo)
    └─▶ 5C (WorldSimulator)
        └─▶ 7A (IA Avanzada)

6A (Migrations + arquitectura) ← PRIMER BLOQUE de Sprint 6
    └─▶ 6B (Economía)
    └─▶ 6C (Progresión)
        └─▶ 6D (Moral — necesita CharacterSave.morale)
    └─▶ 6E (Combate — necesita essenceDrops en CombatResult)
        └─▶ 7B (Esencias — necesita monsterKey, enemyType)
    └─▶ 6F (Zonas Seguras — necesita level-up de 6C)
        └─▶ 7B (Esencias — CampScreen ESSENCES tab)
    └─▶ 6G (Alianzas — necesita bountyService de 6D)
```
