import { Character } from '../entities/Character';
import { Party } from '../entities/Party';
import { Level } from '../value-objects/Level';

/** XP rewards by event source (SYSTEMS.MD) */
export const XP_REWARDS = {
  NORMAL_ROOM:   50,
  ELITE_ROOM:    150,
  BOSS_ROOM:     500,
  SECRET_ROOM:   200,
  TREASURE_ROOM: 25,
  FLOOR_ADVANCE: 100,
  SURVIVAL:      20,
} as const;

export type XPRewardSource = keyof typeof XP_REWARDS;

export interface LevelUpResult {
  character: Character;
  levelsGained: number;
  newLevel: number;
  hpGained: number;
}

/**
 * ProgressionDomainService
 * Encapsulates XP distribution and level-up logic for characters and parties.
 * Pure functions — no side effects, no infrastructure dependencies.
 */
export class ProgressionDomainService {
  /**
   * Award XP to a character from a specific source.
   * Returns updated Character (with pendingLevelUps incremented if threshold crossed).
   */
  awardXP(character: Character, source: XPRewardSource): Character {
    const amount = XP_REWARDS[source];
    return character.gainXP(amount);
  }

  /**
   * Confirm all pending level-ups for a character (done at CampScreen).
   * Each level increases maxHP by CON modifier + class hit die average.
   */
  confirmLevelUps(character: Character): LevelUpResult {
    if (character.pendingLevelUps === 0) {
      return { character, levelsGained: 0, newLevel: character.level.value, hpGained: 0 };
    }
    let current = character;
    let hpGained = 0;
    const levelsToApply = character.pendingLevelUps;
    for (let i = 0; i < levelsToApply; i++) {
      const conMod = current.getModifier('CON');
      const hitDieAvg = 5; // default d8 average; could be parameterized per class
      const hpPerLevel = Math.max(1, hitDieAvg + conMod);
      hpGained += hpPerLevel;
      current = current.levelUp();
    }
    return {
      character: current,
      levelsGained: levelsToApply,
      newLevel: current.level.value,
      hpGained,
    };
  }

  /**
   * Distribute XP equally among alive party members after combat.
   */
  distributePartyXP(party: Party, totalXP: number): Party {
    return party.distributeXP(totalXP);
  }

  /**
   * Determine the starting level for a new game inherited from a previous party.
   * SYSTEMS.MD: inherited level = floor(avg previous party level / 2), min 1.
   */
  getInheritedLevel(previousParty: Character[]): number {
    if (previousParty.length === 0) return 1;
    const avg = previousParty.reduce((sum, c) => sum + c.level.value, 0) / previousParty.length;
    return Math.max(1, Math.floor(avg / 2));
  }

  formatXPProgress(character: Character): string {
    const lvl = character.level;
    if (lvl.isMax) return 'MAX';
    const toNext = lvl.xpToNextLevel(character.xp);
    return `${character.xp} / ${lvl.xpThreshold + toNext} XP`;
  }
}
