# TORRE — ÍNDICE DE DOCUMENTACIÓN TÉCNICA
> Última actualización: 2026-03-11 · v2.0 — incluye docs 11–13 y resolución de conflictos de integridad

---

## Documentos disponibles

| # | Sistema | Archivo | Estado actual | Sprint |
|---|---------|---------|---------------|--------|
| 01 | Sistema Temporal y Núcleo | `01_SISTEMA_TEMPORAL.md` | ~20% | **5** |
| 02 | Economía y Sistema de Loot | `02_ECONOMIA_Y_LOOT.md` | ~12% | 6 |
| 03 | Combate Expandido (huir/negociar/PvP) | `03_COMBATE_EXPANDIDO.md` | ~28% | 6 |
| 04 | Motor de Simulación (worldSimulator.ts) | `04_WORLD_SIMULATOR.md` | 0% | **5** |
| 05 | IA, Moral y Bounty | `05_MORAL_Y_BOUNTY.md` | ~4% | 6 |
| 06 | Parties, Herencia y Progresión | `06_PARTIES_Y_HERENCIA.md` | ~40% | 6 |
| 07 | Política, Alianzas y Gremio | `07_POLITICA_Y_ALIANZAS.md` | ~5% | 6 |
| 08 | Arquitectura de Datos (DB schema) | `08_ARQUITECTURA_DATOS.md` | ~22% | 5-6 |
| 09 | IA Avanzada (memoria + evolución cultural) | `09_IA_AVANZADA.md` | 0% | 7 |
| 10 | Sistema Narrativo Emocional | `10_SISTEMA_NARRATIVO_EMOCIONAL.md` | ~8% | **4C** |
| 11 | Zonas Seguras y Sistema de Campamento | `11_ZONAS_SEGURAS.md` | 0% | 6 |
| 12 | Seeds, Parties y Ciclo de Vida | `12_SEED_Y_PARTIES.md` | 0% | 6 |
| 13 | Sistema de Esencias y Ascensión | `13_SISTEMA_ESENCIAS.md` | 0% | 7 |

---

## Orden de implementación recomendado

```
Sprint 4C (inmediato — no bloquea nada más):
  └─ 10_SISTEMA_NARRATIVO    ← portrait dinámico + panel narrativo

Sprint 5:
  └─ 04_WORLD_SIMULATOR      ← worldSimulator.ts base
  └─ 01_SISTEMA_TEMPORAL     ← ciclos reales + CycleTransitionScreen
  └─ 08_ARQUITECTURA_DATOS   ← migrations v7 + prng.ts utilitario

Sprint 6:
  └─ 08_ARQUITECTURA_DATOS   ← migrations v8–v12
  └─ 02_ECONOMIA_Y_LOOT      ← revivir con costo, items reales
  └─ 06_PARTIES_Y_HERENCIA   ← XP/nivel, herencia, muerte permanente
  └─ 12_SEED_Y_PARTIES       ← lifecycle de parties, unificación de seeds
  └─ 05_MORAL_Y_BOUNTY       ← moral, bounty activo
  └─ 03_COMBATE_EXPANDIDO    ← huida, negociación, PvP, drops de esencia base
  └─ 07_POLITICA_Y_ALIANZAS  ← alianzas, GuildScreen hub
  └─ 11_ZONAS_SEGURAS        ← CampScreen, level-up, subclase

Sprint 7:
  └─ 09_IA_AVANZADA          ← memoria histórica, evolución cultural
  └─ 13_SISTEMA_ESENCIAS     ← drops, slots, evolución, ascensión
  └─ 08_ARQUITECTURA_DATOS   ← migration v13
```

---

## Árbol de dependencias

```
10_NARRATIVO (Sprint 4C)
    └── sin dependencias

04_WORLD_SIMULATOR (Sprint 5)
    └── sin dependencias de otros docs

01_SISTEMA_TEMPORAL (Sprint 5)
    └── depende de 04_WORLD_SIMULATOR

08_ARQUITECTURA (Sprint 5-6)
    └── base para todos

02_ECONOMIA (Sprint 6)
    └── depende de 08 (migration v8)

06_PARTIES (Sprint 6)
    └── depende de 02_ECONOMIA (revivir), 08 (CharacterSave)

12_SEED_Y_PARTIES (Sprint 6)
    └── depende de 06_PARTIES, 04_WORLD_SIMULATOR

05_MORAL_Y_BOUNTY (Sprint 6)
    └── depende de 06_PARTIES (CharacterSave), 08 (migration v9)

03_COMBATE (Sprint 6)
    └── depende de 02_ECONOMIA (loot), 05_MORAL (bounty PvP)

11_ZONAS_SEGURAS (Sprint 6)
    └── depende de 06_PARTIES (level-up), 03_COMBATE (CampScreen)

07_ALIANZAS (Sprint 6)
    └── depende de 05_MORAL (bounty board), 08 (migration v10)

09_IA_AVANZADA (Sprint 7)
    └── depende de 04_WORLD_SIMULATOR (worldSimulator completo)

13_ESENCIAS (Sprint 7)
    └── depende de 03_COMBATE (monsterKey), 11_ZONAS_SEGURAS (CampScreen), 06_PARTIES (level)
```

---

## Notas de integridad del sistema

> **Estas notas documentan decisiones de diseño que afectan a múltiples documentos. Consultar antes de implementar cualquier sistema.**

### NI-01 — Level cap MVP vs sistema completo
El `progressionService.ts` (doc 06) usa `MAX_LEVEL = 10` como cap de MVP para la Torre básica. El sistema de esencias (doc 13) define slots hasta nivel 20 y ascensión post-20. **Resolución**: implementar con `MAX_LEVEL_MVP = 10` en Sprint 6 y subir a 20 en Sprint 7 cuando el sistema de esencias esté activo. Los slots de esencia en niveles 11–20 quedan dormidos hasta entonces.

### NI-02 — CharacterSave tipo canónico
El tipo `CharacterSave` se define en múltiples documentos (05, 06, 13). La fuente de verdad canónica es `src/database/gameRepository.ts`. El tipo completo con todos los campos está documentado en el doc 08. Cualquier adición de campo DEBE pasar por doc 08 primero.

### NI-03 — PRNG compartido
`makePRNG()` no debe duplicarse en cada servicio. La fuente de verdad es `src/utils/prng.ts` (documentada en doc 08). Todos los servicios importan desde ahí.

### NI-04 — AIProfile: 5 perfiles canónicos
El tipo `AIProfile` tiene 5 valores: `AGGRESSIVE | DEFENSIVE | OPPORTUNISTIC | EXPANSIONIST | SURVIVALIST`. Doc 04 (worldSimulator base) tenía 4 — `EXPANSIONIST` se añade en doc 04 v2. Doc 09 (IA avanzada) es la referencia completa.

### NI-05 — TimeAction SAFE_ZONE_WAIT
Definida en doc 11 (zonas seguras), debe añadirse al `CYCLE_COST` de doc 01 (timeService). Costo: equivalente a los ciclos restantes simulados en lote.

### NI-06 — CombatResult.essenceDrops
Doc 03 (combate) define `CombatResult`. Doc 13 (esencias) añade el campo `essenceDrops: CharacterEssence[]`. Ambos deben estar sincronizados.

---

## Servicios nuevos a crear (resumen completo)

| Archivo | Crea | Sprint | Para qué |
|---------|------|--------|---------|
| `src/utils/prng.ts` | Sprint 5 | Utilitario PRNG compartido (djb2 + LCG) |
| `src/services/timeService.ts` | Sprint 5 | Costo de ciclos por acción |
| `src/services/worldSimulator.ts` | Sprint 5 | Motor de simulación IA |
| `src/services/economyService.ts` | Sprint 6 | Costo de revivir, precios |
| `src/services/lootService.ts` | Sprint 6 | Generación de items |
| `src/services/encounterService.ts` | Sprint 6 | Detección y resolución de encuentros |
| `src/services/moralSystem.ts` | Sprint 6 | Moral de personajes y abandono |
| `src/services/bountyService.ts` | Sprint 6 | Bounties por violencia |
| `src/services/progressionService.ts` | Sprint 6 | XP, niveles, herencia |
| `src/services/allianceService.ts` | Sprint 6 | Contratos de alianza |
| `src/services/safeZoneService.ts` | Sprint 6 | Zonas seguras, campamento, consumibles |
| `src/services/seedUnificationService.ts` | Sprint 6 | Unificación de seeds, purge de parties |
| `src/services/aiMemoryService.ts` | Sprint 7 | Memoria histórica de IA |
| `src/services/aiProfileEngine.ts` | Sprint 7 | Perfiles estratégicos (5 perfiles) |
| `src/services/culturalEvolution.ts` | Sprint 7 | Copia y mutación de estrategias |
| `src/services/essenceService.ts` | Sprint 7 | Drops, slots, evolución, ascensión |

---

## Repositories nuevos a crear

| Archivo | Sprint | Para qué |
|---------|--------|---------|
| `src/database/itemRepository.ts` | 6 | CRUD de items |
| `src/database/eventRepository.ts` | 6 | Historial permanente de eventos |
| `src/database/essenceRepository.ts` | 7 | CRUD de esencias y monster_kills |

---

## Pantallas nuevas a crear

| Pantalla | Sprint | Doc de referencia |
|----------|--------|--------------------|
| `CycleTransitionScreen.tsx` | 5 | doc 01 |
| `VillageScreen.tsx` | 5-6 | doc 01, 02 |
| `WorldLogScreen.tsx` | 5 | doc 04 |
| `BattleScreen.tsx` (actualizar) | 4C, 6 | doc 10, 03 |
| `CampScreen.tsx` | 6 | doc 11 |
| `LevelUpScreen.tsx` | 6 | doc 11 |
| `GuildScreen.tsx` (actualizar) | 6 | doc 07, 05 |
| `AllianceScreen.tsx` | 6 | doc 07 |
| `NegotiationScreen.tsx` | 6 | doc 03 |
| `UnificationScreen.tsx` | 6 | doc 12 |
| `SimulationLoadingScreen.tsx` | 6 | doc 12 |
| `AscensionScreen.tsx` | 7 | doc 13 |

---

## Convención de código en todos los docs

- **PRNG:** siempre importar `makePRNG` desde `src/utils/prng.ts` — nunca definir inline
- **Funciones puras:** todos los servicios exportan funciones puras sin side effects cuando es posible
- **DB:** todas las escrituras usan `executeSync` dentro de transacción cuando hay múltiples operaciones
- **Typing:** todos los tipos públicos se exportan desde el archivo de servicio o `gameRepository.ts`
- **Barrel:** añadir cada nuevo servicio al `src/services/index.ts`
- **Nivel MVP:** `MAX_LEVEL_MVP = 10`, `MAX_LEVEL_FULL = 20` — usar el correcto según sprint

---

## Migrations planificadas

| Versión | Qué añade | Sprint | Doc |
|---------|-----------|--------|-----|
| v6 | `expressions_json` en `saved_games` | ✅ hecho | — |
| v7 | `cycle_raw`, `last_action_at`, `last_sim_events` | 5 | doc 08 |
| v8 | tabla `items` | 6 | doc 08 |
| v9 | tablas `events` y `bounties` | 6 | doc 08 |
| v10 | tabla `alliances` | 6 | doc 08 |
| v11 | `in_safe_zone`, `safe_zone_room_id` en `saved_games` | 6 | doc 11 |
| v12 | `party_origin`, `predecessor_game_id`, `created_by_player` en `saved_games` | 6 | doc 12 |
| v13 | tablas `essences` y `monster_kills` | 7 | doc 13 |
