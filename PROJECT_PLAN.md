# TORRE — PROJECT PLAN (LIVING DOCUMENT)

> Documento vivo. Actualizar al final de cada sprint o sesión de trabajo.
> Fuente de verdad para planificación: `PROJECT_STATUS.md` (estado técnico detallado) · `SYSTEMS.MD` (diseño fundacional) · `GAME_CONTEXT.md` (visión del juego)

**Última actualización:** 2026-03-08
**Sprint activo:** 4A — Cerrar el Game Loop

---

## Estado Global

| Estado | Valor |
|--------|-------|
| Sprint actual | **4A — Cerrar el Game Loop** |
| Pantallas total | 11 |
| DB schema | v6 |
| Stack | RN 0.84 + NativeWind v4 + Zustand + op-sqlite v15 |
| Plataforma objetivo | iOS (primaria) + Android |

---

## 🐛 Bugs Críticos (bloquean el game loop)

| Bug | Causa | Archivo(s) |
|-----|-------|------------|
| `Battle: undefined` — BattleScreen recibe roomId/roomType undefined | `MapScreen` navega a Battle sin params | `MapScreen.tsx`, `types.ts` |
| Las salas nunca se marcan `visited` | `MapScreen` no recibe el resultado de vuelta | `ReportScreen.tsx`, `MapScreen.tsx` |
| El boss nunca se puede limpiar → no se puede avanzar de piso | Depende del bug anterior | `dungeonGraphService.ts`, `MapScreen.tsx` |
| `ReportScreen` navega a Extraction en vez de volver al Mapa | Navegación mal conectada post-combate | `ReportScreen.tsx` |
| iOS: bug al guardar/borrar party | Pendiente investigar | `gameRepository.ts`, `gameStore.ts` |

---

## 🗺 Roadmap de Sprints

### Sprint 1 — Fundación ✅ COMPLETADO
Conectar pantallas con datos reales. 11 pantallas navegables, base de datos SQLite v6, i18n EN/ES.

### Sprint 2 — Visual y Asset Pipeline ✅ COMPLETADO
Portraits de personaje vía Google Gemini, variantes de expresión facial vía ComfyUI, catálogo de 35+ sprites de enemigos.

### Sprint 3 — Motor de Dungeon ✅ COMPLETADO
`dungeonGraphService.ts` con 12-20 rooms, fog-of-war, salas secretas, mutaciones. `monsterEvolutionService.ts`. `characterStats.ts`. MapScreen conectado al grafo real con fog-of-war y navegación real. Party sub-components.

---

### Sprint 4A — Cerrar el Game Loop 🔴 ACTIVO
> **Objetivo:** el dungeon se puede completar. Rooms se marcan, boss se limpia, pisos se avanzan.

**Prioridad máxima — desbloquea todo lo demás.**

#### Tareas

- [ ] `src/navigation/types.ts` — añadir params: `Battle: { roomId: string; roomType: RoomType }` y `Report: { roomId: string; roomWasCleared: boolean }`
- [ ] `MapScreen.tsx` — pasar `roomId` + `roomType` al navegar a BattleScreen
- [ ] `BattleScreen.tsx` — leer params de ruta; al terminar combate (victoria mock) navegar a Report con `{ roomId, roomWasCleared: true }`
- [ ] `ReportScreen.tsx` — recibir params; al "Continuar" navegar de vuelta a MapScreen (no a Extraction)
- [ ] `MapScreen.tsx` — al volver de Report, marcar la sala como `visited: true` y persistir `mapState`
- [ ] Verificar que `isBossCleared` activa correctamente el panel de avance de piso
- [ ] Test manual: entrar a room → batalla → reporte → mapa → sala marcada visitada → boss limpio → avanzar piso

---

### Sprint 4B — Motor de Combate DnD 5e
> **Objetivo:** el combate es real. BattleScreen usa tiradas, HP, AC, turnos.

#### Tareas

- [ ] Motor de iniciativa: `DEX_mod + d20_seeded` para todos los actores
- [ ] Hit roll: `(AttackMod + ProfBonus) vs EnemyAC`, clamped 5–95%
- [ ] Daño: `WeaponBase + StatMod + Bonus - Resistances`, ×2 en crítico
- [ ] HP dinámico: personajes y enemigos con HP real; pantalla de muerte de personaje
- [ ] Turnos: Action · Bonus Action · Reaction (simplified MVP)
- [ ] Log de combate con TypewriterText secuencial
- [ ] Enemigos generados por `monsterEvolutionService` según `roomType` + ciclo/piso
- [ ] Post-combate: XP reward con decay, gold drop calculado
- [ ] `ReportScreen` conectada a resultados reales (no mock)

#### Archivos clave
- `src/screens/BattleScreen.tsx` — UI principal de combate
- `src/screens/ReportScreen.tsx` — resultados post-combate
- `src/services/monsterEvolutionService.ts` — stats de enemigos por tier
- `src/services/characterStats.ts` — stats de personajes
- `src/stores/gameStore.ts` — estado del juego
- `src/services/dungeonGraphService.ts` — tipo de sala actual

---

### Sprint 5 — Motor de Simulación (Mundo Vivo)
> **Objetivo:** las parties IA son actores reales. El mundo avanza sin el jugador.

#### Tareas

- [ ] `simulateWorld(cycle)`: procesa todas las parties IA hasta el ciclo actual en batch
- [ ] Combate abstracto IA vs IA: `PowerScore = Σ(nivel × stat_mult × equip_factor)`
- [ ] Sistema temporal real: Day/Night avanza con acciones del jugador
- [ ] World Log conectado a eventos reales del motor
- [ ] `CycleTransitionScreen` muestra eventos reales del ciclo

#### Archivos clave
- Nueva: `src/services/worldSimulator.ts`
- `src/services/rivalGenerator.ts` — parties IA existentes
- `src/screens/WorldLogScreen.tsx` — visualización
- `src/screens/CycleTransitionScreen.tsx`

---

### Sprint 6 — Capa Social (La Torre como sociedad)
> **Objetivo:** política entre parties funciona. Profundidad estratégica.

- [ ] Sistema de Moral: alineamiento genera tensión, abandono de miembros
- [ ] Sistema de Bounty: historial de violencia → mayor riesgo de emboscada
- [ ] Sistema de Alianzas: contratos con `protectionFee` y `expiresAtCycle`
- [ ] `GuildScreen` funcional: contratos activos, bounties publicados, World Log real
- [ ] Armería y Posada: compra de equipo, descanso con costo de ciclos real
- [ ] Herencia de nivel entre temporadas

---

### Sprint 7 — Optimización y Release
- [ ] Migrar `CRTOverlay` a react-native-skia (actualmente 100 Views por pantalla)
- [ ] `ErrorBoundary` en `App.tsx`
- [ ] Test coverage: combinación, navegación, simulación IA
- [ ] Memoización: selectores Zustand, StyleSheet.create en screens pesadas
- [ ] Sonido: efectos de terminal, música ambient synthwave
- [ ] Haptic feedback: combate, SliderButton, extracción
- [ ] `SYSTEM_CONFIG`: idioma, dificultad, tema de color
- [ ] Builds de release iOS App Store + Google Play

---

## 🏗 Arquitectura del Proyecto

```
src/
  screens/         # 11 pantallas de la app
  components/      # Componentes reutilizables + party/
  services/        # Lógica de negocio y servicios externos
  stores/          # gameStore.ts (Zustand, persiste en SQLite)
  hooks/           # Custom hooks (useGameStore, usePartyRoster, etc.)
  database/        # SQLite connection, migrations, gameRepository
  navigation/      # Stack navigator + types.ts
  i18n/            # Sistema bilingüe ES/EN
  types/           # Tipos TypeScript globales
  constants/       # dnd5eLevel1.ts con reglas DnD 5e nivel 1
  theme/           # Paleta de colores CRT/cyberpunk
assets/
  fonts/           # RobotoMono
  images/          # Portraits generados por IA
  sprites/         # Sprites de enemigos
scripts/           # generate-characters.js, generate-sprites.js, generate-expressions.js
.github/
  skills/          # Agent Skills para Copilot
```

### Pantallas (navegación Stack)
```
MainScreen → SeedScreen → PartyScreen → VillageScreen
                                          └→ MapScreen → BattleScreen → ReportScreen
                                                └→ CycleTransitionScreen
                                                └→ ExtractionScreen
GuildScreen (desde VillageScreen)
WorldLogScreen (desde GuildScreen)
```

### Estado global (Zustand — `useGameStore`)
- `activeGame`: partida actual en memoria
- `savedGames`: lista de partidas guardadas
- `startNewGame`, `loadGame`, `updateProgress`, `endGame`, `hydrate`, `clearActive`
- Persiste automáticamente en SQLite via `gameRepository.ts`

### DB Schema v6 (op-sqlite)
- `resources` — items del juego
- `translations` — ES/EN 120+ claves
- `sync_meta` — estado de sincronización con API DnD 5e
- `saved_games` — partidas con: seed, party, floor, cycle, phase, gold, status, location, mapState, partyPortrait, portraitsJson, expressionsJson

---

## 🔑 Archivos Críticos (contexto rápido)

| Archivo | Propósito |
|---------|-----------|
| `src/stores/gameStore.ts` | Estado global, Zustand |
| `src/database/gameRepository.ts` | CRUD de partidas en SQLite |
| `src/database/migrations.ts` | Schema v1→v6 |
| `src/services/dungeonGraphService.ts` | Grafos de piso con fog-of-war |
| `src/services/monsterEvolutionService.ts` | Stats de 35+ enemigos por tier |
| `src/services/characterStats.ts` | Utilidades puras DnD 5e |
| `src/services/geminiImageService.ts` | Portraits vía Google Gemini |
| `src/navigation/types.ts` | `RootStackParamList` tipado |
| `src/screens/MapScreen.tsx` | Exploración del dungeon |
| `src/screens/BattleScreen.tsx` | Combate (actualmente mock) |
| `src/screens/ReportScreen.tsx` | Resultados post-combate |
| `src/constants/dnd5eLevel1.ts` | 13 clases, 26 subclases, 9 razas |

---

## 📐 Convenciones del Proyecto

- **Estilos:** NativeWind v4 (className) + Tailwind tokens; NO StyleSheet.create salvo performance crítica
- **Estado:** Zustand; NO useState para lógica derivada o compartida
- **Navegación:** `useNavigation<NativeStackNavigationProp<RootStackParamList>>()` + `useRoute<RouteProp<...>>`; NUNCA navegar sin params tipados
- **i18n:** siempre `t('key')` via `useI18n()`; NUNCA strings hardcoded visibles al usuario
- **DB:** siempre pasar por `gameRepository.ts`; nunca acceder a `connection.ts` directamente desde pantallas
- **Commits:** formato `feat(scope):`, `fix(scope):`, `chore(scope):`
- **Idioma de código:** inglés para nombres de variables/funciones; comentarios en español OK

---

## 🎯 Próxima Acción Inmediata

**Sprint 4A, Tarea 1:**
```
Editar src/navigation/types.ts:
  Battle: { roomId: string; roomType: RoomType }
  Report: { roomId: string; roomWasCleared: boolean }
```
Luego conectar el flow: MapScreen → BattleScreen → ReportScreen → MapScreen con marking de sala.

---

## 📦 Dependencias Externas

| Servicio | Uso | Estado |
|----------|-----|--------|
| Google Gemini API | Generación de portraits | ✅ Activo |
| ComfyUI (local) | Expresiones faciales | ✅ Scripts listos |
| DnD 5e API | Sync de datos de juego | ✅ 24 endpoints sincronizados |

---

## 🚨 Riesgos Técnicos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Motor de simulación: 10 parties × 60 ciclos | 🔴 Alto | Batch processing sin loops por individuo |
| CRTOverlay: 100 Views × 10+ pantallas | 🔴 Alto | Migrar a Skia canvas (Sprint 7) |
| DnD 5e reglas de borde → bugs de combate | 🟡 Medio | Implementar por capas + tests |
| Sistema política + moral + bounty: alto acoplamiento | 🟡 Medio | Interfaces claras antes de implementar |
| Sin ErrorBoundary — crash mata toda la app | 🟡 Medio | Añadir en Sprint 7 |
