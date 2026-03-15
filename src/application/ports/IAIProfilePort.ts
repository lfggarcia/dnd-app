/**
 * IAIProfilePort — port for AI party decision engine.
 * Infrastructure adapter wraps aiProfileEngine.ts + aiMemoryService.ts.
 */
export type AIAction =
  | 'EXPLORE' | 'COMBAT' | 'REST' | 'TRADE'
  | 'ALLIANCE_SEEK' | 'BOUNTY_CHASE' | 'RETREAT' | 'DEFENSIVE';

export type AIProfileType =
  | 'OPPORTUNISTIC' | 'DEFENSIVE' | 'AGGRESSIVE'
  | 'DIPLOMATIC' | 'COWARD' | 'BALANCED';

export interface AIPartyDecision {
  action: AIAction;
  targetPartyName?: string;
  reasoning: string;
}

export interface IAIProfilePort {
  deriveProfile(partyName: string, seedHash: string): AIProfileType;
  decideAction(
    partyName: string,
    seedHash: string,
    cycle: number,
    floor: number,
    nearbyRivalNames: string[],
  ): AIPartyDecision;
}
