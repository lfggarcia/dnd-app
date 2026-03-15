import { Character } from './Character';
import { GameStateError } from '../errors/DomainError';

export type MoralEvent = {
  type: 'ALLY_DOWN' | 'VICTORY' | 'DEFEAT' | 'BOSS_KILLED' | 'REVIVED';
  impact: number; // positive = morale gain, negative = morale loss
};

export type CultureEvent = {
  type: 'COMBAT_WIN' | 'FLOOR_ADVANCE' | 'BOSS_KILLED' | 'REST' | 'DEFEAT';
  detail?: string;
};

export type PartyOrigin = 'PLAYER' | 'IA_INHERITED' | 'SYSTEM';

export interface PartyProps {
  members: Character[];
  partyName: string | null;
  origin: PartyOrigin;
}

/**
 * Party — domain entity grouping Characters.
 * Enforces party viability rules and encapsulates morale/culture logic.
 * Immutable: mutations return a new Party instance.
 */
export class Party {
  constructor(private readonly props: PartyProps) {}

  get members(): Character[] { return this.props.members; }
  get partyName(): string | null { return this.props.partyName; }
  get origin(): PartyOrigin { return this.props.origin; }

  get aliveMembers(): Character[] { return this.props.members.filter(c => c.isAlive); }
  get deadMembers(): Character[] { return this.props.members.filter(c => !c.isAlive); }

  get isViable(): boolean { return this.aliveMembers.length > 0; }
  get size(): number { return this.props.members.length; }

  get totalLevel(): number {
    return this.props.members.reduce((sum, c) => sum + c.level.value, 0);
  }

  get averageLevel(): number {
    if (this.props.members.length === 0) return 0;
    return Math.floor(this.totalLevel / this.props.members.length);
  }

  getMember(characterId: string): Character | undefined {
    return this.props.members.find(c => c.characterId === characterId);
  }

  hasMember(characterId: string): boolean {
    return this.props.members.some(c => c.characterId === characterId);
  }

  addMember(character: Character): Party {
    if (this.hasMember(character.characterId)) {
      throw new GameStateError(`Character ${character.characterId} is already in the party`);
    }
    return new Party({ ...this.props, members: [...this.props.members, character] });
  }

  removeMember(characterId: string): Party {
    const updated = this.props.members.filter(c => c.characterId !== characterId);
    return new Party({ ...this.props, members: updated });
  }

  updateMember(updated: Character): Party {
    const members = this.props.members.map(c =>
      c.characterId === updated.characterId ? updated : c,
    );
    return new Party({ ...this.props, members });
  }

  applyMoralImpact(event: MoralEvent): Party {
    const updated = this.props.members.map(c =>
      c.isAlive ? c.updateMorale(event.impact) : c,
    );
    return new Party({ ...this.props, members: updated });
  }

  /** Distribute XP equally among alive members */
  distributeXP(totalXP: number): Party {
    const alive = this.aliveMembers.length;
    if (alive === 0) return this;
    const share = Math.floor(totalXP / alive);
    const updated = this.props.members.map(c =>
      c.isAlive ? c.gainXP(share) : c,
    );
    return new Party({ ...this.props, members: updated });
  }

  toProps(): PartyProps {
    return { ...this.props };
  }

  static fromProps(props: PartyProps): Party {
    return new Party(props);
  }
}
