# PROJECT STATUS — TORRE (CYBER_DND)

**Rama:** `main`
**Fecha:** 2026-03-06
**Estado general:** 🟡 **PROTOTIPO FUNCIONAL — Creación de personaje real, resto mock**

> Ver `GAME_CONTEXT.md` para la visión completa y `SYSTEMS.MD` como documento fundacional.

---

## Estado Actual

### ✅ Completado

| Área | Detalle |
|------|---------|
| Infraestructura | RN 0.84 + NativeWind v4 + Reanimated v4 + Gesture Handler v2 + op-sqlite v15 + react-native-svg v15 |
| Fuentes | RobotoMono completa integrada en iOS y Android |
| Sistema de color | Paleta CRT cyberpunk completa via CSS variables + Tailwind tokens |
| Navegación | Stack de 10 pantallas con transición `fade`, tipado completo (`RootStackParamList`) |
| Base de datos | SQLite con op-sqlite: schema v1 (resources, translations, sync_meta), CRUD completo, batch upsert |
| Sincronización API | DnD 5e API (24 endpoints), sync on demand, tracking de progreso, DatabaseGate como wrapper |
| i18n | Sistema bilingüe ES/EN con Context + useI18n() hook, dot-notation keys, ~100+ claves |
| Sistema de traducciones | Puente de traducción con fallback chain (DB → API raw data) |
| Seed de datos | Traducciones ES, subclases custom (26), backgrounds custom se siembran en init |
| Reglas DnD 5e | Constantes nivel 1 completas: 13 clases, 26 subclases, 9 razas, features con traducciones |
| UI: Menú principal | TorreLogo SVG con neón roto + boot sequence TypewriterText + toggle idioma |
| UI: SeedScreen | Input de seed + efecto Matrix + transición ámbar animada |
| UI: PartyScreen | Creación de personaje **REAL**: nombre, raza, clase, subclase, trasfondo, alineamiento con datos DnD 5e de API/DB |
| UI: PartyScreen Tutorial | Tutorial step-by-step integrado con TutorialOverlay (next/prev/skip) |
| UI: PartyScreen Glosario | GlossaryModal con búsqueda por categorías (stats, razas, clases, monstruos, mecánicas) |
| UI: VillageScreen | Mapa de blueprint interactivo, leaderboard, SliderButton para lanzar incursión |
| UI: MapScreen | Nodos de misión, radar rotativo Reanimated |
| UI: BattleScreen | Vista táctica con área de enemigos, jugadores y log de combate |
| UI: ReportScreen | Reporte con TypewriterText secuencial, gráfico de barras, alerta |
| UI: ExtractionScreen | Contador animado de oro, lista de materiales, retorno al menú |
| UI: WorldLogScreen | Feed de eventos con filtros (ALL/COMBAT/LORE/SYSTEM), multilingüe |
| UI: CycleTransitionScreen | Transición de ciclo animada (Floor N → N+1) |
| Componentes | `CRTOverlay`, `TypewriterText`, `SliderButton`, `DatabaseGate`, `GlossaryModal`, `TorreLogo`, `TutorialOverlay` — 7 reutilizables y tipados |
| Hooks | `useDatabase`, `useGlossary`, `useResources`, `useTutorial` — 4 hooks custom |
| Servicios | `api5e`, `syncService`, `translationBridge`, `rulesConfig`, `subclassSeed`, `backgroundSeed`, `translationSeed` — 7 servicios modulares |
| Calidad | Imports limpios, navigation tipado, barrel exports en database/services/i18n |

### 🚧 En Progreso / Pendiente

| Área | Detalle | Prioridad |
|------|---------|-----------|
| Estado global | Sin gestión de estado entre pantallas — seed, personaje, progreso se pierden en cada navegación | Alta |
| Motor de simulación | No existe — corazón del juego, responsable de simular parties IA por ciclos | Alta |
| Lógica de combate | Todo el gameplay es mock — log estático, sin tiradas reales, sin HP, sin turnos | Alta |
| Persistencia de partida | DB existe pero solo para datos de referencia DnD 5e — no hay save/load de partidas | Alta |
| Sistema temporal | Sin ciclos, sin temporadas, sin presión de "el ciclo 60 cierra la Torre" | Alta |
| Generador por seed | Seed se ingresa pero se descarta — no genera nada | Media |
| Parties IA | No existen — el leaderboard es hardcodeado, no hay simulación real | Media |
| Sistema de política | Sin alianzas, sin bounty, sin moral, sin World Log real | Media |
| Performance CRT | 100 Views por pantalla para scanlines | Media |
| Testing | Solo 1 test de render básico — cobertura ~0% | Media |
| Nodos muertos | LOOT, BOSS y START en MapScreen tienen `onPress` deshabilitado | Baja |
| Funciones stub | `LOAD_STATE` y `SYSTEM_CONFIG` sin implementar | Baja |

---

## Roadmap — Futuro del Proyecto

### Fase 1 — Fundación (MVP técnico)

> Objetivo: conectar las 10 pantallas con datos reales. El juego se puede "jugar" en modo básico.

- [x] **Base de datos SQLite (op-sqlite)** — schema v1 con resources, translations, sync_meta
- [x] **Sincronización DnD 5e API** — 24 endpoints, DatabaseGate como wrapper de inicialización
- [x] **i18n bilingüe** — ES/EN con Context + hook, traducciones seeded + dinámicas
- [x] **Creación de personaje real** — stats DnD 5e, 13 clases, 26 subclases, 9 razas, trasfondos, alineamientos
- [x] **Glosario interactivo** — GlossaryModal con búsqueda por categorías
- [x] **Tutorial de creación** — TutorialOverlay step-by-step en PartyScreen
- [x] **Capa de constantes/datos** — `dnd5eLevel1.ts`, `rulesConfig.ts`, seeds de datos
- [ ] **Estado global (Zustand)** — persistir seed, party activa, progreso de ciclo y piso entre pantallas
- [ ] **Modelo de datos de partida** — extender schema con Seeds, Parties, Characters
- [ ] **Generador determinístico por seed** — mapa de nodos, tabla de enemigos, loot, dificultad via PRNG seeded
- [ ] **Motor de combate DnD 5e** — tiradas reales (d20 + modificadores), HP, AC, turnos por iniciativa, log dinámico

### Fase 2 — Motor de Simulación (TORRE toma forma)

> Objetivo: el mundo de la Torre existe con lógica propia. Las parties IA son actores reales.

- [ ] **Sistema temporal** — ciclos (1-60), día/noche, presión de Torre cerrada al ciclo 60
- [ ] **Parties IA generadas** — nombres, niveles, personalidades derivadas del seed
- [ ] **`simulateWorld(cycle)`** — cuando el jugador avanza ciclo, el motor simula todas las IAs hasta ese punto
- [ ] **Combate abstracto IA vs IA** — fórmula de poder: `Σ(nivel × stat_mult × equip_factor)`, probabilístico
- [x] **World Log** — pantalla creada (`WorldLogScreen`) con filtros ALL/COMBAT/LORE/SYSTEM (falta conectar datos reales)
- [x] **Cycle Transition** — pantalla creada (`CycleTransitionScreen`) con animación de transición (falta conectar datos reales)
- [ ] **100 pisos con escalado** — `MonsterStats = BaseStats × (1 + piso × 0.05)`
- [ ] **Jefes únicos por seed** — loot único que solo se obtiene la primera vez

### Fase 3 — Capa Social (la Torre como sociedad viva)

> Objetivo: la política entre parties funciona. El juego tiene profundidad estratégica.

- [ ] **Sistema de Moral** — alineamiento por personaje, tensión si el jugador ataca parties, abandono de miembros
- [ ] **Sistema de Bounty** — violencia acumulada → bounty permanente → mayor riesgo de emboscada
- [ ] `BountyRiskMultiplier = 1 + (bountyLevel × 0.2)`
- [ ] **Sistema de Alianzas** — contratos con protectionFee y expiresAtCycle, sin traición arbitraria
- [ ] **Extorsión estratégica** — parties poderosas pueden exigir pago
- [ ] **El Gremio funcional** — UI para consultar World Log, contratos activos, bounties publicados
- [ ] **Armería** — compra/equipamiento de items en VillageScreen
- [ ] **Posada** — descanso con costo de ciclos, recuperación de HP
- [ ] **Herencia de nivel** — nueva party inicia con nivel ≤ promedio de la party anterior

### Fase 4 — Optimización y Estabilidad

> Objetivo: el código aguanta producción.

- [ ] **Optimizar `CRTOverlay`** — migrar a react-native-skia o reducir scanlines a 30-40
- [ ] **Optimizar `DataColumn`** — un único intervalo consolidado en SeedScreen
- [ ] **Error Boundary** en `App.tsx`
- [ ] **Testing** — tests de componentes, combate engine, simulación IA, navegación
- [ ] **Hooks personalizados** — extraer lógica repetida a `src/hooks/`
- [ ] **Memoización** — `StyleSheet.create` en MapScreen/PartyScreen, selectores de Zustand optimizados

### Fase 5 — Pulido y Release

- [ ] **Sonido** — efectos de terminal, música ambient synthwave
- [ ] **Haptic feedback** — combate, SliderButton, extracción
- [ ] **Splash screen** — animación de boot del sistema operativo ficticio
- [ ] **SYSTEM_CONFIG** — idioma (español/inglés), dificultad, tema de color
- [ ] **Distribución** — builds de release para iOS App Store y Google Play

---

## Riesgos Técnicos Actuales

| Riesgo | Nivel | Mitigación propuesta |
|--------|-------|----------------------|
| Motor de simulación: 10 parties × 60 ciclos cada vez que el jugador avanza — necesita ser ultra-eficiente | 🔴 Alto | Batch processing, cálculos vectorizados, sin loops por individuo |
| Sin estado global — cualquier navegación hacia atrás pierde datos | 🔴 Alto | Zustand con persistencia local desde Fase 1 |
| Performance por 100 Views de CRTOverlay × 10+ pantallas | 🔴 Alto | Migrar a Skia canvas o reducir scanlines a 40 |
| DnD 5e completo es un sistema con muchas reglas de borde — bugs de combate son probables | 🟡 Medio | Implementar por capas (base primero, spell slots después), tests exhaustivos |
| Sistema de política + moral + bounty: alto acoplamiento entre sistemas | 🟡 Medio | Definir interfaces claras entre módulos antes de implementar |
| Sin ErrorBoundary — crash en runtime crashea toda la app | 🟡 Medio | Añadir en App.tsx desde Fase 1 |

---

## Métricas del Proyecto

| Métrica | Valor |
|---------|-------|
| Pantallas actuales | 10 |
| Pantallas proyectadas | 12-15 (gestión de alianzas, detalle de personaje, config) |
| Componentes reutilizables | 7 |
| Hooks custom | 4 |
| Servicios | 7 |
| Sistemas de juego pendientes | 5 (simulación, combate, economía, social, temporal) |
| Tablas en DB | 4 (resources, translations, sync_meta + indexes) |
| Endpoints API sincronizados | 24 |
| Idiomas soportados | 2 (ES, EN) |
| Claves de traducción | ~100+ |
| Cobertura de tests | ~0% |
| Dependencias de producción | ~15 |
