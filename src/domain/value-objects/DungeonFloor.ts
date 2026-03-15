import { ValidationError } from '../errors/DomainError';

/**
 * DungeonFloor — value object for the current floor index (1-based). Immutable.
 */
export class DungeonFloor {
  static readonly MIN = 1;
  static readonly MAX = 100;

  constructor(private readonly _index: number) {
    if (!Number.isInteger(_index) || _index < DungeonFloor.MIN || _index > DungeonFloor.MAX) {
      throw new ValidationError(
        `DungeonFloor must be in [${DungeonFloor.MIN}, ${DungeonFloor.MAX}], got ${_index}`,
      );
    }
  }

  get index(): number { return this._index; }

  /** Evolution tier used for monster scaling. Capped by floor tier. */
  evolutionTier(cycle: number): number {
    const fromCycle = Math.floor(cycle / 5);
    const fromFloor = Math.floor(this._index / 10);
    return Math.min(fromCycle, fromFloor);
  }

  next(): DungeonFloor {
    if (this._index >= DungeonFloor.MAX) return this;
    return new DungeonFloor(this._index + 1);
  }

  equals(other: DungeonFloor): boolean { return this._index === other._index; }
}
