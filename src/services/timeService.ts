/**
 * timeService.ts — Sprint 5B
 *
 * Defines the cycle cost of each player action.
 * All time advancement must go through here — never mutate cycle directly.
 *
 * PRNG is imported from src/utils/prng.ts (NI-03).
 *
 * Ref: doc 01 — Sprint 5, Paso 1
 */

export type TimeAction =
  | 'REST_SHORT'        // Short rest in dungeon          → 0.5 cycles
  | 'REST_LONG'         // Long rest at inn               → 1 cycle
  | 'EXPLORE_ROOM'      // Explore a room                 → 0 cycles (free)
  | 'ENTER_DUNGEON'     // Enter the Tower                → 0 cycles
  | 'FLOOR_ADVANCE'     // Descend one floor              → 0 cycles
  | 'RETURN_VILLAGE'    // Return to village              → 1 cycle
  | 'PURCHASE'          // Buy from shop                  → 0 cycles
  | 'NEGOTIATE'         // Negotiate with another party   → 0.5 cycles
  | 'PHASE_CHANGE'      // Explicit day/night flip        → 1 cycle
  | 'SAFE_ZONE_WAIT'    // Wait at safe zone until season end → remaining cycles
  | 'BATCH_SIMULATE';   // Internal batch simulation      → variable

export const CYCLE_COST: Record<TimeAction, number> = {
  REST_SHORT:       0.5,
  REST_LONG:        1,
  EXPLORE_ROOM:     0,
  ENTER_DUNGEON:    0,
  FLOOR_ADVANCE:    0,
  RETURN_VILLAGE:   1,
  PURCHASE:         0,
  NEGOTIATE:        0.5,
  PHASE_CHANGE:     1,
  SAFE_ZONE_WAIT:   0,   // actual cost calculated in safeZoneService (remaining cycles)
  BATCH_SIMULATE:   0,   // controlled externally — do not use CYCLE_COST for this
};

export const SEASON_LENGTH = 60;

/**
 * Determines the phase for a given cycle number.
 * Even cycles are DAY, odd cycles are NIGHT.
 */
export function getPhaseForCycle(cycle: number): 'DAY' | 'NIGHT' {
  return cycle % 2 === 0 ? 'DAY' : 'NIGHT';
}

/**
 * Calculates the new cycle and phase after an action.
 * Handles fractional cycles (0.5) internally using cycle_raw.
 * For SAFE_ZONE_WAIT use advanceToEndOfSeason() instead.
 */
export function advanceTime(
  currentCycleRaw: number,
  action: TimeAction,
): { newCycleRaw: number; newCycle: number; newPhase: 'DAY' | 'NIGHT'; phaseChanged: boolean } {
  const cost = CYCLE_COST[action];
  const newRaw = currentCycleRaw + cost;
  const newCycle = Math.floor(newRaw);
  const prevCycle = Math.floor(currentCycleRaw);
  const newPhase = getPhaseForCycle(newCycle);
  const phaseChanged = newPhase !== getPhaseForCycle(prevCycle);
  return { newCycleRaw: newRaw, newCycle, newPhase, phaseChanged };
}

/**
 * Advances directly to cycle 60 (end of season) from a safe zone.
 * Used by SAFE_ZONE_WAIT. See doc 11 (safeZoneService).
 */
export function advanceToEndOfSeason(
  currentCycle: number,
): { newCycle: 60; cyclesSimulated: number } {
  const cyclesSimulated = Math.max(0, SEASON_LENGTH - currentCycle);
  return { newCycle: 60, cyclesSimulated };
}

/**
 * Returns true if the Tower is closed (cycle >= 60).
 */
export function isTowerClosed(cycle: number): boolean {
  return cycle >= SEASON_LENGTH;
}

/**
 * Returns how many cycles remain before the Tower closes.
 */
export function cyclesRemaining(cycle: number): number {
  return Math.max(0, SEASON_LENGTH - cycle);
}
