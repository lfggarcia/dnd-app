# PROJECT STATUS — TORRE (CYBER_DND)

**Versión actual:** `v1.0.4-BETA` (según `MainScreen`)
**Rama:** `main`
**Fecha:** 2026-03-05
**Estado general:** 🟡 **PROTOTIPO VISUAL — Cáscara funcional, sin mecánicas**

> Ver `GAME_CONTEXT.md` para la visión completa y `SYSTEMS.MD` como documento fundacional.

---

## Estado Actual

### ✅ Completado

| Área | Detalle |
|------|---------|
| Infraestructura | RN 0.84 + NativeWind v4 + Reanimated v4 + Gesture Handler v2 configurados |
| Fuentes | RobotoMono completa integrada en iOS y Android |
| Sistema de color | Paleta CRT cyberpunk completa via CSS variables + Tailwind tokens |
| Navegación | Stack de 8 pantallas con transición `fade`, tipado completo (`RootStackParamList`) |
| UI: Menú principal | ASCII art + logs de sistema + botón NEW_REPLICATION funcional |
| UI: SeedScreen | Input de seed + efecto Matrix + transición ámbar animada |
| UI: PartyScreen | Selección de raza, stats display, módulos psicológicos seleccionables |
| UI: VillageScreen | Mapa de blueprint interactivo, leaderboard, SliderButton para lanzar incursión |
| UI: MapScreen | Nodos de misión, radar rotativo Reanimated, nodo ENEMY navega a batalla |
| UI: BattleScreen | Vista táctica con área de enemigos, jugadores y log de combate estático |
| UI: ReportScreen | Reporte con TypewriterText secuencial, gráfico de barras, alerta |
| UI: ExtractionScreen | Contador animado de oro, lista de materiales, retorno al menú |
| Componentes | `CRTOverlay`, `TypewriterText`, `SliderButton` reutilizables y tipados |
| Calidad | Imports limpios, navigation tipado con `RootStackParamList` |

### 🚧 En Progreso / Pendiente

| Área | Detalle | Prioridad |
|------|---------|-----------|
| Estado global | Sin gestión de estado entre pantallas — seed, personaje, progreso se pierden en cada navegación | Alta |
| Motor de simulación | No existe — corazón del juego, responsable de simular parties IA por ciclos | Alta |
| Lógica de combate | Todo el gameplay es mock — log estático, sin tiradas reales, sin HP, sin turnos | Alta |
| Stats del personaje | Prototipo usa STR/DEX/INT/VIT/SPD (5) — migrar a DnD 5e estándar: STR/DEX/CON/INT/WIS/CHA (6) cuando se implemente gameplay | Alta |
| Persistencia local | Sin SQLite/Realm — LOAD_STATE no funciona, no hay save/load | Alta |
| Sistema temporal | Sin ciclos, sin temporadas, sin presión de "el ciclo 60 cierra la Torre" | Alta |
| Parties IA | No existen — el leaderboard es hardcodeado, no hay simulación real | Media |
| Sistema de política | Sin alianzas, sin bounty, sin moral, sin World Log | Media |
| Generador por seed | Seed se ingresa pero se descarta — no genera nada | Media |
| Performance CRT | 100 Views por pantalla para scanlines | Media |
| Performance Matrix | 15 intervalos simultáneos en SeedScreen | Media |
| Testing | Solo 1 test de render básico — cobertura ~0% | Media |
| Nodos muertos | LOOT, BOSS y START en MapScreen tienen `onPress` muerto | Baja |
| Funciones stub | `LOAD_STATE` y `SYSTEM_CONFIG` sin implementar | Baja |
| Typo en UI | "ENAMBLAJE_ALFA" en PartyScreen — revisar ortografía | Baja |

---

## Roadmap — Futuro del Proyecto

### Fase 1 — Fundación (MVP técnico)

> Objetivo: conectar las 8 pantallas con datos reales. El juego se puede "jugar" en modo básico.

- [ ] **Estado global (Zustand)** — persistir seed, party activa, progreso de ciclo y piso entre pantallas
- [ ] **Creación de personaje real** — stats DnD 5e (STR/DEX/CON/INT/WIS/CHA), clase, raza, alineamiento, módulo psíquico
- [ ] **Generador determinístico por seed** — mapa de nodos, tabla de enemigos, loot, dificultad via PRNG seeded
- [ ] **Motor de combate DnD 5e** — tiradas reales (d20 + modificadores), HP, AC, turnos por iniciativa, log dinámico
- [ ] **Persistencia local (SQLite/Realm)** — modelo de datos completo: Seed, Party, Character, Item, Event
- [ ] **Capa de constantes/datos** — migrar toda la data hardcodeada a `src/constants/` y `src/data/`

### Fase 2 — Motor de Simulación (TORRE toma forma)

> Objetivo: el mundo de la Torre existe con lógica propia. Las parties IA son actores reales.

- [ ] **Sistema temporal** — ciclos (1-60), día/noche, presión de Torre cerrada al ciclo 60
- [ ] **Parties IA generadas** — nombres, niveles, personalidades derivadas del seed
- [ ] **`simulateWorld(cycle)`** — cuando el jugador avanza ciclo, el motor simula todas las IAs hasta ese punto
- [ ] **Combate abstracto IA vs IA** — fórmula de poder: `Σ(nivel × stat_mult × equip_factor)`, probabilístico
- [ ] **World Log** — eventos registrados: jefes caídos, parties eliminadas, alianzas, bounties
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
| Performance por 100 Views de CRTOverlay × 8+ pantallas | 🔴 Alto | Migrar a Skia canvas o reducir scanlines a 40 |
| 15 intervalos en SeedScreen cada ~150ms | 🔴 Alto | Un único intervalo consolidado |
| DnD 5e completo es un sistema con muchas reglas de borde — bugs de combate son probables | 🟡 Medio | Implementar por capas (base primero, spell slots después), tests exhaustivos |
| Sistema de política + moral + bounty: alto acoplamiento entre sistemas | 🟡 Medio | Definir interfaces claras entre módulos antes de implementar |
| Sin ErrorBoundary — crash en runtime crashea toda la app | 🟡 Medio | Añadir en App.tsx desde Fase 1 |
| Datos hardcodeados en pantallas — imposible escalar contenido | 🟡 Medio | Migrar a `src/constants/` y `src/data/` en Fase 1 |

---

## Métricas del Proyecto

| Métrica | Valor |
|---------|-------|
| Pantallas actuales | 8 |
| Pantallas proyectadas | 12-15 (World Log, combate detallado, gestión de alianzas, config) |
| Componentes actuales | 3 |
| Sistemas de juego pendientes | 7 (simulación, combate, economía, social, temporal, datos, política) |
| Líneas de código (aprox.) | ~950 |
| Cobertura de tests | ~0% |
| Commits | 4 + cambios sin commitear |
| Dependencias de producción | 12 |
| Deuda técnica estimada | ~8-12 sprints para Fase 1+2+3 (MVP jugable con capa social) |
