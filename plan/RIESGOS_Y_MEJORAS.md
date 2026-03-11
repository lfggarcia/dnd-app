# TORRE — RIESGOS Y MEJORAS (pre-desarrollo)
> Versión 2.0 · 2026-03-11 · Actualizado con sistema de esencias y conflictos de integridad resueltos

---

## Riesgos técnicos activos

### RT-01 🔴 worldSimulator cuello de botella
**Descripción:** Con 10 parties × 60 ciclos × lógica de memoria (Sprint 7), el simulador puede superar 200ms en dispositivos de gama baja.
**Impacto:** Freeze visible al avanzar ciclo. UX rota.
**Mitigación:**
- Mantener simulación por ciclo en < 5ms total (10 parties × < 0.5ms por party)
- En Sprint 7 (IA con memoria): benchmark obligatorio antes de merge
- Si se supera el límite: mover `simulateWorld()` a un Web Worker / hilo separado
- `advanceCycleBatch()` (doc 12) ya simula en lotes de 6 — es el mecanismo de control

### RT-02 🔴 Colisiones PRNG entre servicios
**Descripción:** Con la PRNG compartida (doc 08), dos servicios que usen la misma semilla + contexto producirán valores iguales, creando correlaciones no deseadas.
**Impacto:** El loot siempre cae junto con las emboscadas, o los drops de esencia coinciden siempre con el moral bajo.
**Mitigación:**
- Cada servicio añade un prefijo único al seed: `${seedHash}_essence_drop_...`, `${seedHash}_moral_...`
- Nunca compartir el mismo string de semilla entre servicios distintos
- Test: verificar que `makePRNG('A').float() !== makePRNG('B').float()` para prefijos distintos

### RT-03 🟠 Corrupción de migrations
**Descripción:** Con 13 versiones de migration, un error en v8 que se ejecuta en un dispositivo con v7 puede dejar la DB en estado inconsistente.
**Impacto:** Crash en arranque, pérdida de save.
**Mitigación:**
- Cada migration dentro de `BEGIN TRANSACTION / COMMIT / ROLLBACK`
- Migration test: ejecutar desde v1 a v13 en DB limpia y verificar schema final
- Mantener `ALTER TABLE` en lugar de `DROP TABLE` para campos nuevos

### RT-04 🟠 Desync de combate PvP vs worldSimulator
**Descripción:** Si el jugador elimina una party IA en combate pero el worldSimulator la tiene activa en su lista de `AIPartyState`, el siguiente `simulateWorld()` la procesará como si existiera.
**Impacto:** Fantasmas de parties eliminadas que aparecen en el WorldLog.
**Mitigación:**
- `simulateWorld()` carga la lista de rivals desde DB al inicio (no desde el estado anterior)
- La DB es la fuente de verdad, no el estado en memoria
- Al eliminar una party en PvP: marcar `status = 'defeated'` en DB inmediatamente, antes del próximo ciclo

### RT-05 🟠 Dependencias circulares entre servicios
**Descripción:** `encounterService` importa `bountyService`, `bountyService` importa `eventRepository`, `eventRepository` importa tipos de `worldSimulator`. Si el árbol no está bien dirigido puede crear un ciclo.
**Impacto:** Error en runtime al importar módulos.
**Mitigación:**
- Dirección de dependencias: `utils/prng` ← `services/*` ← `database/*` ← `screens/*`
- Nunca: `database/*` importa de `services/*`
- Si hay que compartir tipos entre capas: definirlos en `types/` o en `gameRepository.ts`

### RT-06 🟠 Race condition en loot de boss
**Descripción:** Si el jugador elimina el boss y la app cierra antes de que `isBossLootClaimed()` persista, puede obtener el loot único dos veces en el siguiente run.
**Impacto:** Duplicación de items únicos — rompe el balance.
**Mitigación:**
- Guardar `claimed = 1` en la MISMA transacción que guarda el item
- Verificar `isBossLootClaimed()` al inicio del combate de boss, no solo al final

### RT-07 🟡 Desync de fase día/noche
**Descripción:** `cycle_raw` puede estar en 3.5 mientras `cycle` entero está en 3. Si el jugador hace un `REST_SHORT` (0.5) y el app crashea, al recuperar el estado el ciclo entero puede estar equivocado.
**Impacto:** Fase incorrecta. Menor pero visible.
**Mitigación:**
- Guardar `cycle_raw` en DB en el mismo `updateProgress` que incrementa el ciclo
- Al cargar el save: `cycle = Math.floor(cycle_raw)`, no leer el campo `cycle` directamente

### RT-08 🟡 Validación de seeds malformadas
**Descripción:** Seeds muy cortas (1 carácter) o con caracteres Unicode pueden producir hashes con baja entropía en djb2, creando colisiones de dungeon.
**Impacto:** Dos seeds distintas generan el mismo dungeon.
**Mitigación:**
- Validar seeds: mínimo 4 caracteres, solo ASCII imprimible
- Si el usuario ingresa una seed inválida: mostrar error antes de crear la partida

### RT-09 🟡 Esencias duplicadas en la DB
**Descripción:** Si `resolveEssenceDrop()` y `saveEssenceDrop()` se llaman dos veces para el mismo monstruo (doble tap, retry de red), puede guardarse la esencia dos veces.
**Impacto:** Inventario de esencias inflado.
**Mitigación:**
- El ID de esencia incluye: `${seedHash}_essence_${definitionId}_${cycle}_${floor}` — idempotente por seed
- `INSERT OR IGNORE` en essenceRepository para evitar duplicados exactos

---

## Riesgos de diseño y balance

### RD-01 🔴 Economía de revivir demasiado punitiva
**Descripción:** `REVIVE_BASE_COST × nivel × (1 + deathCount × 0.15)` en nivel 8 + 3 muertes = 2.760G. Si el gold acumulado a ese punto es menor, la muerte permanente llega demasiado pronto.
**Mitigación:** Primeras sesiones de playtest: registrar gold acumulado vs costo de revivir por piso. Ajustar `REVIVE_BASE_COST` o el multiplicador de muertes.

### RD-02 🟠 IA monopolio del worldSimulator
**Descripción:** Una party AGGRESSIVE con VENDETTA (doc 12) puede eliminar todas las demás en 20 ciclos si las condiciones iniciales la favorecen, dejando la Torre vacía.
**Mitigación:**
- Post-extermination relaxation (ya documentado en doc 12): la party agresiva fuerza DEFENSIVE por 5 ciclos
- Si quedan menos de 3 parties activas: `simulateWorld` genera una SYSTEM nueva automáticamente

### RD-03 🟠 Moral + herencia perversa
**Descripción:** El jugador puede dejar morir a los personajes de bajo nivel intencionalmente para que los reemplazantes hereden nivel más alto.
**Mitigación:** El reemplazo tras abandono (doc 05) comienza con stats base neutros (10 en todo) y nivel = floor(nivel_abandonado × 0.7) — no hay ventaja en dejar morir.

### RD-04 🟡 Esencias de boss demasiado fuertes en IA
**Descripción:** Doc 13 añade `estimateEssenceBonusForFloor()` al power score de la IA. Si el multiplier es demasiado alto en pisos 40+, la IA se vuelve imbatible.
**Mitigación:** El bonus de esencias IA es una ESTIMACIÓN, no real (la IA no tiene esencias en DB). Cap: `essenceBonus` no puede superar el 30% del power score base.

### RD-05 🟡 Narrativa emocional como ruido de fondo
**Descripción:** Si `NarrativeMomentPanel` aparece demasiado frecuentemente, el jugador lo ignora o lo considera un obstáculo.
**Mitigación:** Solo para `isSignificantEvent()` (4 tipos: ALLY_DOWN, BOSS_DEFEATED, VERY_LOW_HEALTH, CRIT_DEALT). Auto-dismiss en 3.5 segundos. No bloquea ninguna acción.

---

## Deudas técnicas existentes

| # | Deuda | Prioridad | Sprint para resolver |
|---|-------|-----------|---------------------|
| DT-01 | `makePRNG` inline en 8+ servicios → centralizar en `src/utils/prng.ts` | 🔴 Alta | 5A (PRIMERO) |
| DT-02 | `CharacterSave` parcial en docs 05, 06, 13 → tipo canónico en doc 08 | 🔴 Alta | 6A |
| DT-03 | `AIProfile` con 4 valores en doc 04, 5 en doc 09 → sincronizar | 🟠 Media | 7A-05 |
| DT-04 | `MAX_LEVEL = 10` hardcodeado en doc 06 → constante exportable | 🟠 Media | 6C-01 |
| DT-05 | `nextCycle = 4` hardcodeado en `CycleTransitionScreen` | 🟠 Media | 5B-04 |
| DT-06 | Revivir gratis en `VillageScreen` | 🟠 Media | 6B-03 |
| DT-07 | Loot de combate como string random → items reales en DB | 🟠 Media | 6B-02 |
| DT-08 | `encounterService` no existe — parties IA no se cruzan con el jugador | 🟠 Media | 6E-02 |
| DT-09 | `CampScreen` tab ESSENCES no tiene lógica de equipar/evolucionar | 🟡 Baja | 7B-06 |
| DT-10 | Textos narrativos en `NARRATIVE_POOLS` solo tienen 2–3 líneas por evento | 🟡 Baja | Sprint 8 |

---

## Mejoras de arquitectura propuestas

### MA-01 — Barrel exports limpios
```
src/services/index.ts   → exporta todos los servicios
src/database/index.ts   → exporta todos los repositories
src/utils/index.ts      → exporta prng y otros utilitarios
```
Beneficio: imports limpios en pantallas (`import { economyService } from '../services'`).

### MA-02 — Tipos compartidos en `src/types/`
Los tipos que cruzan capas (CharacterSave, SimulationEvent, etc.) deberían vivir en `src/types/` en lugar de en `gameRepository.ts`. Esto evita que los servicios importen desde la capa de datos.

### MA-03 — Separar `resolveCombat` en fases
El `combatEngine.ts` actual resuelve todo el combate en un solo paso. Para el sistema de emociones (doc 10) y las habilidades de esencia (doc 13), es más limpio separar en: `initCombat()`, `resolveTurn()`, `buildCombatResult()`. Refactor para Sprint 7.

---

## Reglas de performance

| Regla | Límite |
|-------|--------|
| `simulateWorld(60 ciclos, 10 parties)` | < 100ms |
| `simulateWorld` con memoria IA (Sprint 7) | < 200ms |
| Migration total (v1 → v13) | < 500ms en primer arranque |
| Render de `CampScreen` (4 tabs cargados) | < 16ms (60fps) |
| Drop de esencia + save a DB | < 20ms |

---

## Checklist pre-launch

- [ ] Todas las migrations v7–v13 ejecutan sin error desde DB limpia
- [ ] `makePRNG` centralizado, 0 definiciones inline
- [ ] `CharacterSave` canónico — un solo tipo en todo el proyecto
- [ ] `simulateWorld(60)` < 100ms en iPhone 12 / Android mid-range
- [ ] Seed "AAAA" y seed "BBBB" generan dungeons distintos (test de colisión)
- [ ] Boss loot no se duplica en 100 runs de la misma seed
- [ ] Revivir descuenta gold correctamente y rechaza si insuficiente
- [ ] `NarrativeMomentPanel` no aparece más de 3 veces por combate
- [ ] Esencia legendaria tiene drop rate real ≤ 2% en boss mayor
- [ ] `worldSimulator` no procesa parties con `status = 'defeated'`
