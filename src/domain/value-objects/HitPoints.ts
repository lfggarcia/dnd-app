import { ValidationError } from '../errors/DomainError';

/**
 * HitPoints — value object for character HP. Immutable.
 * current is always in [0, max].
 */
export class HitPoints {
  constructor(
    private readonly _current: number,
    private readonly _max: number,
  ) {
    if (_max <= 0) {
      throw new ValidationError(`HitPoints max must be > 0, got ${_max}`);
    }
    if (_current < 0 || _current > _max) {
      throw new ValidationError(
        `HitPoints current must be in [0, ${_max}], got ${_current}`,
      );
    }
  }

  get current(): number { return this._current; }
  get max(): number { return this._max; }
  get isAlive(): boolean { return this._current > 0; }
  get isLow(): boolean { return this._current / this._max < 0.25; }
  get isCritical(): boolean { return this._current / this._max < 0.1; }
  get percentage(): number { return this._current / this._max; }

  takeDamage(amount: number): HitPoints {
    const next = Math.max(0, this._current - amount);
    return new HitPoints(next, this._max);
  }

  heal(amount: number): HitPoints {
    const next = Math.min(this._max, this._current + amount);
    return new HitPoints(next, this._max);
  }

  withMax(newMax: number): HitPoints {
    const clamped = Math.min(this._current, newMax);
    return new HitPoints(clamped, newMax);
  }

  fullHeal(): HitPoints {
    return new HitPoints(this._max, this._max);
  }

  equals(other: HitPoints): boolean {
    return this._current === other._current && this._max === other._max;
  }
}
