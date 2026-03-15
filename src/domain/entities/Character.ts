import { HitPoints } from '../value-objects/HitPoints';
import { Level } from '../value-objects/Level';
import { AbilityScore, AbilityScoreName, AbilityScores, abilityScoresFromRaw } from '../value-objects/AbilityScore';

export type AscensionPath = 'TITAN' | 'ARCHMAGE' | 'AVATAR_OF_WAR';

export interface CharacterProps {
  characterId: string;
  name: string;
  race: string;
  charClass: string;
  subclass: string;
  background: string;
  alignment: string;
  baseStats: Record<AbilityScoreName, number>;
  statMethod: 'standard' | 'rolled';
  featureChoices: Record<string, string | string[]>;
  hp: number;
  maxHp: number;
  alive: boolean;
  portrait?: string;
  level: number;
  xp: number;
  deathCount: number;
  pendingLevelUps: number;
  morale: number;
  killCount: number;
  isAscended: boolean;
  ascensionPath?: AscensionPath;
  unlockedAbilities: string[];
}

/**
 * Character — domain entity representing a party member.
 * Encapsulates all D&D 5e core stats and TORRE progression rules.
 * Immutable: all mutations return a new Character instance.
 */
export class Character {
  private readonly _level: Level;
  private readonly _hp: HitPoints;
  private readonly _abilityScores: AbilityScores;

  constructor(private readonly props: CharacterProps) {
    this._level = new Level(props.level);
    this._hp = new HitPoints(props.hp, props.maxHp);
    this._abilityScores = abilityScoresFromRaw(props.baseStats);
  }

  // ── Identifiers ───────────────────────────────────────────

  get characterId(): string { return this.props.characterId; }
  get name(): string { return this.props.name; }
  get race(): string { return this.props.race; }
  get charClass(): string { return this.props.charClass; }
  get subclass(): string { return this.props.subclass; }
  get background(): string { return this.props.background; }
  get alignment(): string { return this.props.alignment; }
  get portrait(): string | undefined { return this.props.portrait; }

  // ── Stats ─────────────────────────────────────────────────

  get level(): Level { return this._level; }
  get hp(): HitPoints { return this._hp; }
  get isAlive(): boolean { return this._hp.isAlive; }
  get abilityScores(): AbilityScores { return this._abilityScores; }
  get xp(): number { return this.props.xp; }
  get morale(): number { return this.props.morale; }
  get killCount(): number { return this.props.killCount; }
  get deathCount(): number { return this.props.deathCount; }
  get pendingLevelUps(): number { return this.props.pendingLevelUps; }

  // ── Ascension ─────────────────────────────────────────────

  get isAscended(): boolean { return this.props.isAscended; }
  get ascensionPath(): AscensionPath | undefined { return this.props.ascensionPath; }
  get unlockedAbilities(): string[] { return this.props.unlockedAbilities; }

  // ── D&D 5e computations ───────────────────────────────────

  getModifier(ability: AbilityScoreName): number {
    return this._abilityScores[ability].modifier;
  }

  get proficiencyBonus(): number { return this._level.proficiencyBonus; }

  /** Initiative modifier: DEX modifier */
  get initiativeModifier(): number { return this.getModifier('DEX'); }

  /** Passive perception: 10 + WIS modifier + proficiency if trained */
  get passivePerception(): number { return 10 + this.getModifier('WIS'); }

  // ── State mutations (return new Character) ────────────────

  takeDamage(amount: number): Character {
    const newHp = this._hp.takeDamage(amount);
    return new Character({ ...this.props, hp: newHp.current, alive: newHp.isAlive });
  }

  heal(amount: number): Character {
    const newHp = this._hp.heal(amount);
    return new Character({ ...this.props, hp: newHp.current });
  }

  gainXP(xp: number): Character {
    const newXP = this.props.xp + xp;
    const canLevel = this._level.canLevelUp(newXP) && !this._level.isMax;
    return new Character({
      ...this.props,
      xp: newXP,
      pendingLevelUps: canLevel
        ? this.props.pendingLevelUps + 1
        : this.props.pendingLevelUps,
    });
  }

  levelUp(): Character {
    if (this.props.pendingLevelUps <= 0) return this;
    const newLevel = this._level.increment();
    return new Character({
      ...this.props,
      level: newLevel.value,
      pendingLevelUps: this.props.pendingLevelUps - 1,
    });
  }

  revive(): Character {
    return new Character({
      ...this.props,
      hp: Math.ceil(this.props.maxHp * 0.5),
      alive: true,
      deathCount: this.props.deathCount + 1,
    });
  }

  updateMorale(delta: number): Character {
    const newMorale = Math.max(0, Math.min(100, this.props.morale + delta));
    return new Character({ ...this.props, morale: newMorale });
  }

  incrementKillCount(): Character {
    return new Character({ ...this.props, killCount: this.props.killCount + 1 });
  }

  /** Serialize back to a plain props object (for persistence layer) */
  toProps(): CharacterProps {
    return { ...this.props };
  }

  /** Factory: create from plain props */
  static fromProps(props: CharacterProps): Character {
    return new Character(props);
  }
}
