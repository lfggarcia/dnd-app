import { Character } from './Character';
import { Monster } from './Monster';
import { CombatError } from '../errors/DomainError';

export type CombatSide = 'PARTY' | 'ENEMIES';

export type CombatOutcome = 'VICTORY' | 'DEFEAT' | 'ONGOING';

export interface CombatantSnapshot {
  id: string;
  name: string;
  side: CombatSide;
  currentHP: number;
  maxHP: number;
  isAlive: boolean;
}

export interface CombatRoundResult {
  round: number;
  events: string[];
  outcome: CombatOutcome;
  partySnapshots: CombatantSnapshot[];
  enemySnapshots: CombatantSnapshot[];
}

export interface CombatSessionProps {
  roomId: string;
  partyMembers: Character[];
  enemies: Monster[];
  currentRound: number;
  log: string[];
  outcome: CombatOutcome;
}

/**
 * CombatSession — domain entity for a single battle.
 * Tracks live state of all participants.
 * Actual resolution logic lives in CombatDomainService (too complex for entity).
 * Immutable: mutations return new sessions.
 */
export class CombatSession {
  constructor(private readonly props: CombatSessionProps) {}

  get roomId(): string { return this.props.roomId; }
  get partyMembers(): Character[] { return this.props.partyMembers; }
  get enemies(): Monster[] { return this.props.enemies; }
  get currentRound(): number { return this.props.currentRound; }
  get log(): string[] { return this.props.log; }
  get outcome(): CombatOutcome { return this.props.outcome; }

  get isOver(): boolean { return this.props.outcome !== 'ONGOING'; }
  get aliveParty(): Character[] { return this.props.partyMembers.filter(c => c.isAlive); }
  get aliveEnemies(): Monster[] { return this.props.enemies; } // enemies tracked externally

  get winner(): CombatSide | null {
    if (this.props.outcome === 'VICTORY') return 'PARTY';
    if (this.props.outcome === 'DEFEAT') return 'ENEMIES';
    return null;
  }

  appendLog(line: string): CombatSession {
    return new CombatSession({
      ...this.props,
      log: [...this.props.log, line],
    });
  }

  withOutcome(outcome: CombatOutcome): CombatSession {
    return new CombatSession({ ...this.props, outcome });
  }

  withUpdatedParty(members: Character[]): CombatSession {
    return new CombatSession({ ...this.props, partyMembers: members });
  }

  incrementRound(): CombatSession {
    return new CombatSession({ ...this.props, currentRound: this.props.currentRound + 1 });
  }

  toProps(): CombatSessionProps {
    return { ...this.props };
  }

  static create(roomId: string, party: Character[], enemies: Monster[]): CombatSession {
    if (party.length === 0) throw new CombatError('Cannot start combat with empty party');
    if (enemies.length === 0) throw new CombatError('Cannot start combat with no enemies');
    return new CombatSession({
      roomId,
      partyMembers: party,
      enemies,
      currentRound: 0,
      log: [],
      outcome: 'ONGOING',
    });
  }
}
