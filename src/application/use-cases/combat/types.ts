import type { CharacterProps } from '../../../domain/entities/Character';

/**
 * Shared types for combat use cases.
 */
export type CombatResult = {
  outcome: 'VICTORY' | 'DEFEAT';
  roundsElapsed: number;
  partyAfter: CharacterProps[];
  totalXp: number;
  goldEarned: number;
  log: string[];
  damageDone: Record<string, number>;
};
