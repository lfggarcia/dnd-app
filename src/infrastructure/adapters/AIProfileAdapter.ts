/**
 * AIProfileAdapter — implements IAIProfilePort.
 * Wraps src/services/aiProfileEngine.ts.
 *
 * Note: the port uses uppercase action names (EXPLORE, COMBAT, etc.)
 * while the underlying engine uses camelCase (explore, fightMonster, etc.)
 * This adapter maps between the two conventions.
 */

import { deriveBaseProfile, getActionWeights } from '../../services/aiProfileEngine';
import type { AIProfile, AIAction as EngineAction } from '../../services/aiProfileEngine';
import { createMemory } from '../../services/aiMemoryService';
import type { IAIProfilePort, AIProfileType, AIAction, AIPartyDecision } from '../../application/ports/IAIProfilePort';

/** Map engine AIProfile → port AIProfileType */
function mapProfile(p: AIProfile): AIProfileType {
  const mapping: Record<AIProfile, AIProfileType> = {
    AGGRESSIVE: 'AGGRESSIVE',
    DEFENSIVE: 'DEFENSIVE',
    OPPORTUNISTIC: 'OPPORTUNISTIC',
    EXPANSIONIST: 'OPPORTUNISTIC', // closest port equivalent
    SURVIVALIST: 'COWARD',
  };
  return mapping[p] ?? 'BALANCED';
}

/** Map engine camelCase action → port uppercase action */
function mapAction(a: EngineAction): AIAction {
  const mapping: Record<EngineAction, AIAction> = {
    explore: 'EXPLORE',
    fightMonster: 'COMBAT',
    huntParty: 'BOUNTY_CHASE',
    avoidCombat: 'RETREAT',
    rest: 'REST',
    advanceFloor: 'EXPLORE',
  };
  return mapping[a] ?? 'EXPLORE';
}

export class AIProfileAdapter implements IAIProfilePort {
  deriveProfile(partyName: string, seedHash: string): AIProfileType {
    const profile = deriveBaseProfile(partyName, seedHash);
    return mapProfile(profile);
  }

  decideAction(
    partyName: string,
    seedHash: string,
    _cycle: number,
    _floor: number,
    nearbyRivalNames: string[],
  ): AIPartyDecision {
    const profile = deriveBaseProfile(partyName, seedHash);
    const memory = createMemory(partyName);
    const weights = getActionWeights(profile, memory);

    // Pick the highest-weight action
    const best = (Object.entries(weights) as [EngineAction, number][])
      .reduce((prev, curr) => (curr[1] > prev[1] ? curr : prev));

    const action = mapAction(best[0]);
    const targetPartyName = action === 'BOUNTY_CHASE' && nearbyRivalNames.length > 0
      ? nearbyRivalNames[0]
      : undefined;

    return {
      action,
      targetPartyName,
      reasoning: `Profile ${profile} → ${best[0]} (weight ${best[1].toFixed(2)})`,
    };
  }
}
