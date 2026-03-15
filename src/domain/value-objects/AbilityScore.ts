import { ValidationError } from '../errors/DomainError';

/**
 * AbilityScore — value object representing one of the 6 D&D 5e ability scores.
 * Immutable. All mutation returns a new instance.
 */
export class AbilityScore {
  private static readonly MIN = 1;
  private static readonly MAX = 30;

  constructor(private readonly _value: number) {
    if (_value < AbilityScore.MIN || _value > AbilityScore.MAX) {
      throw new ValidationError(
        `AbilityScore must be between ${AbilityScore.MIN} and ${AbilityScore.MAX}, got ${_value}`,
      );
    }
  }

  get value(): number {
    return this._value;
  }

  /** D&D 5e modifier: floor((score - 10) / 2) */
  get modifier(): number {
    return Math.floor((this._value - 10) / 2);
  }

  withValue(newValue: number): AbilityScore {
    return new AbilityScore(newValue);
  }

  equals(other: AbilityScore): boolean {
    return this._value === other._value;
  }
}

export type AbilityScoreName = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export type AbilityScores = Record<AbilityScoreName, AbilityScore>;

/** Convenience factory from a plain stats record */
export function abilityScoresFromRaw(raw: Record<AbilityScoreName, number>): AbilityScores {
  return {
    STR: new AbilityScore(raw.STR),
    DEX: new AbilityScore(raw.DEX),
    CON: new AbilityScore(raw.CON),
    INT: new AbilityScore(raw.INT),
    WIS: new AbilityScore(raw.WIS),
    CHA: new AbilityScore(raw.CHA),
  };
}

/** Convenience serializer back to plain record */
export function abilityScoresToRaw(scores: AbilityScores): Record<AbilityScoreName, number> {
  return {
    STR: scores.STR.value,
    DEX: scores.DEX.value,
    CON: scores.CON.value,
    INT: scores.INT.value,
    WIS: scores.WIS.value,
    CHA: scores.CHA.value,
  };
}
