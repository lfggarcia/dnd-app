import { ValidationError } from '../errors/DomainError';

/**
 * Seed — value object representing the deterministic game seed string. Immutable.
 * A seed must be a non-empty alphanumeric string (with dashes allowed).
 */
export class Seed {
  private static readonly VALID_PATTERN = /^[a-zA-Z0-9_-]+$/;

  constructor(private readonly _value: string) {
    if (!_value || !Seed.VALID_PATTERN.test(_value)) {
      throw new ValidationError(
        `Seed must be a non-empty alphanumeric string (dashes/underscores allowed), got "${_value}"`,
      );
    }
  }

  get value(): string { return this._value; }

  equals(other: Seed): boolean { return this._value === other._value; }

  toString(): string { return this._value; }
}
