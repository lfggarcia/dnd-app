/**
 * Seed Unification Service
 *
 * Implements R1–R12 of the party lifecycle spec (doc 12).
 * Handles the case where a player reuses an existing seed hash:
 * - The previous party transitions to IA_INHERITED status
 * - The new party inherits the average level of the previous survivors
 *
 * Ref: plan/sprints/12_SEED_Y_PARTIES.md · Sprint 6G
 */

import {
  getLatestGameBySeedHash,
  updateSavedGame,
  type SavedGame,
  type CharacterSave,
} from '../database/gameRepository';
import { getInheritedLevel } from './progressionService';

export type SeedStatus =
  | { type: 'NEW' }
  | {
      type: 'EXISTING';
      previousGame: SavedGame;
      inheritedLevel: number;
      previousPartyNames: string[];
    };

/** R1-R2: Check if the seed already has history and compute the inherited level */
export function checkSeedStatus(seedHash: string): SeedStatus {
  const previous = getLatestGameBySeedHash(seedHash);
  if (!previous) return { type: 'NEW' };
  const inheritedLevel = getInheritedLevel(previous.partyData);
  return {
    type: 'EXISTING',
    previousGame: previous,
    inheritedLevel,
    previousPartyNames: previous.partyData.map(c => c.name),
  };
}

/** R3-R4: Mark the previous party as IA_INHERITED so worldSimulator picks it up */
export function markAsIAInherited(previousGameId: string): void {
  updateSavedGame(previousGameId, {
    partyOrigin: 'IA_INHERITED',
  });
}

/** R5: Apply the inherited level to every character in the new party */
export function applyInheritedLevel(
  party: CharacterSave[],
  inheritedLevel: number,
): CharacterSave[] {
  return party.map(c => ({ ...c, level: Math.max(c.level, inheritedLevel) }));
}
