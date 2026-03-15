// ─── Base Domain Error ─────────────────────────────────────────────────────

export class DomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DomainError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CombatError extends DomainError {
  constructor(message: string) {
    super(message, 'COMBAT_ERROR');
    this.name = 'CombatError';
  }
}

export class GameStateError extends DomainError {
  constructor(message: string) {
    super(message, 'GAME_STATE_ERROR');
    this.name = 'GameStateError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}
