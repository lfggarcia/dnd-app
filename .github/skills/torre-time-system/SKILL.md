---
name: torre-time-system
description: TORRE temporal system — cycles, day/night, AI simulation timing, season endings. Use when working on cycle progression, time-based events, world simulation triggers, or any feature that consumes or depends on cycles. Keywords: ciclos, cycles, tempo, day, night, season, simulation, avanzar, tiempo.
argument-hint: [feature: "cycle advance" | "day/night toggle" | "season end" | "AI batch simulate"]
---

# TORRE — Sistema Temporal y Núcleo

---

## Reglas Fundamentales

- **100 pisos** máximos en la torre.
- **60 ciclos** por temporada.
- **Día / Noche** alternan — afectan encuentros y peligro.
- Cada party tiene su **propio contador de ciclos** independiente.
- La torre se **cierra** al ciclo 60 → ranking final calculado.

El tiempo es el recurso principal del juego.

---

## Cuándo Avanza el Tiempo

El ciclo avanza cuando el **jugador**:
1. Descansa.
2. Cambia de estado (día ↔ noche).

El tiempo **NO** avanza automáticamente ni en tiempo real.

---

## Flujo de Avance de Ciclo

```
jugador.avanzarCiclo()
  → simulateWorld(playerCycle)         // simula IA en batch hasta ese ciclo
  → resolveСобытия pendientes          // eventos generados por simulación
  → actualizarPosiciones()             // mover parties IA
  → generarWorldLog()                  // publicar eventos en gremio
  → guardarEstado()                    // persistir en SQLite
```

La simulación es **síncrona y local** — sin servidor.

---

## Simulación IA por Lotes

Las parties IA se simulan **todas a la vez** cuando el jugador avanza ciclo:

```typescript
function simulateAllAI(seed: string, targetCycle: number): void {
  for (const party of aiParties) {
    while (party.cycleProgress < targetCycle) {
      simulateParty(party, targetCycle);
    }
  }
}
```

- No se simula en tiempo real.
- El resultado es **determinístico** (mismo seed → mismo resultado).
- Se guardan **checkpoints** de simulación por ciclo.

---

## Restricciones Temporales (Diseño)

| Restricción | Efecto |
|---|---|
| Máx. 60 ciclos | Obliga decisiones eficientes |
| Sin victoria en ciclo 60 → pierde | Presión constante |
| Ranking final al cierre | Meta competitiva entre seeds |
| Descanso excesivo penaliza | No abusar de recuperación |

---

## Campos Relevantes en Modelo de Datos

### Seeds
```typescript
currentCycle: number     // ciclo actual de la seed
isLocked: boolean        // true cuando ciclo >= 60
```

### Party
```typescript
cycleProgress: number    // ciclo en que está esta party
```

---

## Archivos Relacionados

| Archivo | Propósito |
|---|---|
| `src/services/simulationEngine.ts` | Motor de simulación IA batch |
| `src/stores/gameStore.ts` | Estado global con currentCycle |
| `src/database/gameRepository.ts` | Persistencia de ciclo |
| `src/screens/MapScreen.tsx` | Trigger de avance de ciclo (descanso/día-noche) |

---

## Anti-Patrones a Evitar

- ❌ No usar `Date.now()` para lógica de ciclo.
- ❌ No simular IA en tiempo real (solo batch).
- ❌ No permitir avance de ciclo sin guardar estado.
- ❌ No calcular ciclo fuera del seed determinístico.
