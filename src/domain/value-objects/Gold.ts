import { ValidationError } from '../errors/DomainError';

/**
 * Gold — value object for the in-game currency. Immutable. Non-negative.
 */
export class Gold {
  constructor(private readonly _amount: number) {
    if (_amount < 0) {
      throw new ValidationError(`Gold amount cannot be negative, got ${_amount}`);
    }
  }

  get amount(): number { return this._amount; }

  add(other: Gold): Gold { return new Gold(this._amount + other._amount); }

  subtract(other: Gold): Gold {
    if (other._amount > this._amount) {
      throw new ValidationError(`Insufficient gold: have ${this._amount}, need ${other._amount}`);
    }
    return new Gold(this._amount - other._amount);
  }

  canAfford(cost: Gold): boolean { return this._amount >= cost._amount; }

  equals(other: Gold): boolean { return this._amount === other._amount; }

  static zero(): Gold { return new Gold(0); }
  static of(amount: number): Gold { return new Gold(amount); }
}
