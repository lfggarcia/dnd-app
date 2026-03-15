/**
 * Monster — domain entity for dungeon enemies.
 * Wraps MonsterStats with DnD 5e combat logic.
 * Immutable.
 */

export type EnemyType =
  | 'skeleton' | 'skeleton_archer' | 'skeleton_knight' | 'skeleton_mage'
  | 'zombie' | 'zombie_brute' | 'zombie_shaman'
  | 'ghost' | 'wraith' | 'banshee' | 'shadow'
  | 'boss_lich' | 'boss_death_knight' | 'boss_necromancer' | 'boss_void_herald'
  | 'golem_stone' | 'golem_iron' | 'golem_shadow'
  | 'cultist' | 'cultist_fanatic' | 'cultist_high_priest'
  | 'vampire_spawn' | 'vampire' | 'vampire_lord'
  | 'demon_imp' | 'demon_shadow' | 'demon_lord'
  | 'construct_golem' | string;

export interface MonsterProps {
  name: string;
  displayName: string;
  hp: number;
  ac: number;
  attackBonus: number;
  damage: string; // dice notation e.g. "1d6+2"
  xpReward: number;
  cr: number;
  stealth: number;
  type: EnemyType;
  isBossFlag?: boolean;
}

export class Monster {
  constructor(private readonly props: MonsterProps) {}

  get name(): string { return this.props.name; }
  get displayName(): string { return this.props.displayName; }
  get hp(): number { return this.props.hp; }
  get ac(): number { return this.props.ac; }
  get attackBonus(): number { return this.props.attackBonus; }
  get damage(): string { return this.props.damage; }
  get xpReward(): number { return this.props.xpReward; }
  get cr(): number { return this.props.cr; }
  get stealth(): number { return this.props.stealth; }
  get type(): EnemyType { return this.props.type; }
  get isBoss(): boolean { return this.props.isBossFlag ?? false; }

  /** Scale monster stats by an evolution tier multiplier */
  evolve(tier: number): Monster {
    if (tier <= 0) return this;
    const mult = 1 + tier * 0.25;
    return new Monster({
      ...this.props,
      hp: Math.round(this.props.hp * mult),
      attackBonus: this.props.attackBonus + tier,
      xpReward: Math.round(this.props.xpReward * mult),
    });
  }

  toProps(): MonsterProps {
    return { ...this.props };
  }

  static fromProps(props: MonsterProps): Monster {
    return new Monster(props);
  }
}
