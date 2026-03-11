# TORRE — RIESGOS POST-DESARROLLO
> Versión 2.0 · 2026-03-11 · Perspectiva: todos los sistemas están implementados y funcionando
> Actualizado con riesgos del sistema de esencias y ascensión

---

## Riesgos críticos de gameplay (sistema completo)

### RI-01 🔴 Party unificada con equipo único se vuelve imbatible
**Contexto:** Doc 12 (unificación de seeds) permite que el jugador fusione parties de dos seeds distintas. La party resultante puede heredar items únicos de boss de ambas seeds más las esencias de mayor rank de ambas partes.
**Escenario:** Jugador con seed A (piso 35, Esencia Dragón Rojo rank 3) unifica con seed B (piso 28, Item único de boss + Esencia Fénix rank 1). La party resultante tiene 4 slots de esencia ocupados con las mejores esencias del juego antes del nivel 20.
**Impacto:** El dungeon pierde toda tensión. El worldSimulator no puede generar parties IA que representen un reto real.
**Mitigaciones propuestas:**
- Cap de esencias heredadas en unificación: máximo 1 esencia de rank ≤ 3 por unificación
- La parte que "se pierde" en la unificación lleva su mejor esencia al inventario del jugador, pero ocupa sus slots en la nueva party
- Items únicos de boss: solo uno puede estar activo por temporada (el más reciente)

### RI-02 🔴 worldSimulator monopolio IA
**Contexto:** Una party AGGRESSIVE con VENDETTA activa (doc 12) y esencias estimadas altas puede eliminar sistemáticamente a todas las demás parties en 15–20 ciclos.
**Impacto:** La Torre queda vacía de parties IA. El WorldLog no tiene contenido. El jugador no encontrará rivales.
**Mitigaciones propuestas (ya documentadas en docs 04 y 12, verificar implementación):**
- Post-extermination relaxation: 5 ciclos DEFENSIVE obligatorios tras eliminar una party
- Si parties activas < 3: spawn automático de SYSTEM party en ciclo siguiente
- `huntParty` weight se pone a 0 durante el período de relaxation

### RI-03 🟠 Lag de reemplazo de party IA en bancarrota
**Contexto:** Una party IA en bancarrota (HP = 0, gold = 0) se reemplaza por una SYSTEM party con nivel heredado (floor × 0.7 o 0.5 según doc 12). Puede haber 2–3 ciclos sin party en ese rango de pisos.
**Impacto:** El jugador en ese piso no encuentra parties IA. El WorldLog tiene un gap.
**Mitigación:** El reemplazo se hace al inicio del ciclo SIGUIENTE, no al final del ciclo en que murió. Esto crea un ciclo de lag aceptable.

### RI-04 🟠 Moral + herencia crea incentivo perverso
**Contexto:** Si un personaje con alignment lawful/good tiene moral < 20, puede abandonar. El reemplazo hereda su nivel base. Un jugador malicioso puede forzar el abandono para "reiniciar" un personaje con mal RNG de stats.
**Impacto:** El sistema de herencia queda trivializado.
**Mitigación:** El reemplazo comienza con baseStats neutros (10 en todo) y nivel = floor(nivel_abandonado × 0.7). El jugador pierde más de lo que gana.

### RI-05 🟠 Acumulación de alianzas trivializa PvP
**Contexto:** Doc 07 permite alianzas mientras el jugador tenga gold suficiente para la fee. Si el jugador se alía con todas las parties en pisos altos, no puede ser atacado nunca.
**Impacto:** El sistema de bounty pierde sentido. El jugador nunca tiene riesgo de PvP.
**Mitigación:** Cap de alianzas simultáneas = 2. Las parties IA evalúan el bounty level antes de aliarse — si el jugador tiene bounty level ≥ 3 (PELIGROSO), la mayoría de parties rechaza aliarse.

### RI-06 🟠 Ascensión ARCHMAGE trivializa el late game mágico
**Contexto:** El camino ARCHMAGE (doc 13) otorga un slot de hechizo nivel 9 adicional y recuperar un slot en descanso corto. Para wizard/sorcerer en piso 40+, esto representa un poder desproporcionado.
**Impacto:** El combate se resuelve en 1 turno con el wizard post-ascensión.
**Mitigación:** El slot de nivel 9 extra solo se puede usar una vez por combate (no por turno). La recuperación de slot en descanso corto se limita a nivel ≤ 5.

### RI-07 🟡 Esencia Fénix + Esencia del Tiempo = combo roto
**Contexto:** Esencia Fénix rank 1 (revivir al morir) + Esencia del Tiempo rank 1 (reacción extra) en el mismo personaje. Si el personaje muere y revive (Fénix), en ese turno usa la reacción extra (Tiempo) para atacar. Efectivamente: inmortal con acción extra.
**Impacto:** El personaje no puede ser eliminado de forma permanente.
**Mitigación:** Establecer regla: la activación de Fénix cuenta como "acción y reacción del turno" — no puede usarse ninguna otra habilidad activa ese turno. Implementar flag `justRevived: boolean` en el estado de combate.

### RI-08 🟡 Narrativa emocional se vuelve fondo de pantalla
**Contexto:** En combates largos (piso 30+, múltiples rondas), los eventos CRIT_DEALT y LOW_HEALTH se disparan frecuentemente. El `NarrativeMomentPanel` aparece en cada round.
**Impacto:** El jugador ignora el panel. La narrativa pierde impacto.
**Mitigación:** Cooldown de 2 rondas entre paneles del mismo tipo. Máximo 3 paneles por combate. Los de BOSS_DEFEATED y ALLY_DOWN siempre se muestran independientemente del cooldown.

### RI-09 🟡 WorldLog repetitivo en seeds largas
**Contexto:** Con IA avanzada (doc 09) que evoluciona culturalmente, las parties eventualmente convergen en la misma estrategia. Los eventos del WorldLog se vuelven: "Party X avanzó piso", "Party Y avanzó piso", repetido.
**Impacto:** El WorldLog pierde interés. El jugador deja de leerlo.
**Mitigación:** El sistema de counter-meta (doc 09) crea oscilaciones cada 15–20 ciclos. Además, los eventos de BOUNTY_ISSUED, ALLIANCE_FORMED y AI_ELIMINATED tienen prioridad visual en el log y se destacan con color.

---

## Riesgos de integridad de datos

### RID-01 🟠 Manipulación de save local
**Contexto:** La DB SQLite en el dispositivo es accesible con root o herramientas de extracción. El jugador puede modificar directamente `gold`, `level`, o `essences`.
**Impacto:** Experiencia rota para el jugador (rompe el reto intencionado). No afecta a otros.
**Posición del proyecto:** Fuera de scope para MVP. Para post-launch: checksum del save o migración a backend.

### RID-02 🟡 Exploit REST_SHORT time freeze
**Contexto:** `CYCLE_COST['REST_SHORT'] = 0.5` y `cycle_raw` se almacena como REAL. Si el jugador usa REST_SHORT repetidamente en una zona segura, `cycle_raw` avanza en 0.5 pero `cycle` entero no cambia → `simulateWorld` no se ejecuta.
**Impacto:** El jugador puede "congelar" el tiempo del mundo IA haciendo descansos cortos indefinidamente mientras recupera HP.
**Mitigación:** `advanceCycle('REST_SHORT')` también dispara `simulateWorld` si `cycle_raw` cruzó un entero (ej: 3.5 → 4.0). Verificar que la condición es `newCycleInt !== prevCycleInt`, no solo `newCycle !== currentCycle`.

---

## Oportunidades emergentes (post-lanzamiento)

### OE-01 — Sagas IA como contenido generado
Las parties IA con memoria (doc 09) y el sistema de VENDETTA (doc 12) crean naturalmente "sagas" — party A elimina a party B, el heredero de B busca venganza, elimina a A, el heredero de A busca a B2. Esto es contenido narrativo gratuito.
**Potencial:** Mostrar en WorldLog como "saga activa" con nombre generado por seed. Trophy al completar una saga.

### OE-02 — Modo fantasma del jugador anterior
Cuando un jugador abandona una seed (sin completarla), su party puede convertirse en `IA_INHERITED` permanente para otras partidas que usen la misma seed. En la práctica: el jugador anterior "existe" en el mundo de otros jugadores.
**Potencial:** Feature opt-in. "Deja tu legado en esta seed."

### OE-03 — Meta-ecosistema de esencias
Con 100 esencias y builds emergentes documentados en el Sistema Híbrido RPG.MD, pueden emerger builds dominantes que los jugadores descubren y comparten.
**Potencial:** Sistema de "builds destacadas" alimentado por los drops más raros de la semana.

### OE-04 — Ascensión como contenido de alta recompensa
Los 3 caminos de ascensión (TITAN, ARCHMAGE, AVATAR DE GUERRA) son contenido de endgame que actualmente es permanente e irreversible. Potencial expansión: 2 caminos adicionales (SHADOW, NATURE) que requieren builds específicas de esencias bestiales/naturales.

---

## Segunda generación de mejoras (post-v1.0)

### SG-01 — WorldSimulator con memoria persistida
En v1.0, la memoria de las parties IA se recalcula desde cero cada vez que se llama `simulateWorld`. En v2.0: persistir `AIMemoryState` en DB para que la IA recuerde entre sesiones del jugador.
**Costo:** +2 tablas en DB. Complejidad: media.

### SG-02 — Combate en tiempo real opcional
El sistema de combate actual es por turnos (DnD 5e). Una segunda modalidad de combate "abstracto" (resolución probabilística en 1 tick) para los combates de parties IA secundarias podría acelerar la simulación sin afectar los combates del jugador.

### SG-03 — Evolución de esencias más granular
El sistema actual tiene 3 niveles de evolución. En v2.0: esencias con 5 niveles, donde los niveles 4 y 5 requieren absorber esencias del mismo tipo (fusión).

### SG-04 — Ascensión reversible con costo
En v1.0 la ascensión es irreversible. En v2.0: posibilidad de "descender" al precio de perder el personaje permanentemente (muere en el proceso de inversión de la ascensión). Mecánica de alto riesgo para jugadores que quieren cambiar de camino.
