import { ValidationError } from '../errors/DomainError';

/** XP thresholds per level (index = level, value = XP needed to reach that level) */
const XP_THRESHOLDS = [
  0,      // level 1
  300,    // level 2
  900,    // level 3
  2700,   // level 4
  6500,   // level 5
  14000,  // level 6
  23000,  // level 7
  34000,  // level 8
  48000,  // level 9
  64000,  // level 10
  85000,  // level 11
  100000, // level 12
  120000, // level 13
  140000, // level 14
  165000, // level 15
  195000, // level 16
  225000, // level 17
  265000, // level 18
  305000, // level 19
  355000, // level 20
];

/**
 * Level — value object for character level [1–20]. Immutable.
 */
export class Level {
  static readonly MIN = 1;
  static readonly MAX = 20;

  constructor(private readonly _value: number) {
    if (!Number.isInteger(_value) || _value < Level.MIN || _value > Level.MAX) {
      throw new ValidationError(`Level must be an integer in [1, 20], got ${_value}`);
    }
  }

  get value(): number { return this._value; }
  get isMax(): boolean { return this._value === Level.MAX; }

  /** D&D 5e proficiency bonus: ceil(level/4) + 1 */
  get proficiencyBonus(): number {
    return Math.ceil(this._value / 4) + 1;
  }

  /** XP required to be at this level */
  get xpThreshold(): number {
    return XP_THRESHOLDS[this._value - 1] ?? 0;
  }

  xpToNextLevel(currentXP: number): number {
    if (this.isMax) return 0;
    return XP_THRESHOLDS[this._value] - currentXP;
  }

  canLevelUp(currentXP: number): boolean {
    if (this.isMax) return false;
    return currentXP >= XP_THRESHOLDS[this._value];
  }

  increment(): Level {
    if (this.isMax) return this;
    return new Level(this._value + 1);
  }

  equals(other: Level): boolean { return this._value === other._value; }
}
