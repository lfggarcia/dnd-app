/**
 * BountyContract — domain entity for the violence history bounty system.
 * SYSTEMS.MD: "El historial de violencia es PERMANENTE. No existe redención automática."
 * Immutable.
 */

export type BountyLevel = 0 | 1 | 2 | 3 | 4 | 5;
export const BOUNTY_LABEL: Record<BountyLevel, string> = {
  0: 'LIBRE',
  1: 'SOSPECHOSO',
  2: 'BUSCADO',
  3: 'PELIGROSO',
  4: 'MUY_PELIGROSO',
  5: 'ASESINO_EN_SERIE',
};

/** Thresholds: kills needed to reach each level and reward amount */
const BOUNTY_THRESHOLDS: Array<{ kills: number; level: BountyLevel; reward: number }> = [
  { kills: 1,  level: 1, reward: 200 },
  { kills: 3,  level: 2, reward: 500 },
  { kills: 5,  level: 3, reward: 1200 },
  { kills: 8,  level: 4, reward: 3000 },
  { kills: 12, level: 5, reward: 7500 },
];

export interface BountyContractProps {
  id: string;
  seedHash: string;
  targetGameId: string;
  rewardAmount: number;
  bountyLevel: BountyLevel;
  isActive: boolean;
  killCount: number;
}

export class BountyContract {
  constructor(private readonly props: BountyContractProps) {}

  get id(): string { return this.props.id; }
  get targetGameId(): string { return this.props.targetGameId; }
  get rewardAmount(): number { return this.props.rewardAmount; }
  get bountyLevel(): BountyLevel { return this.props.bountyLevel; }
  get isActive(): boolean { return this.props.isActive; }
  get killCount(): number { return this.props.killCount; }
  get label(): string { return BOUNTY_LABEL[this.props.bountyLevel]; }

  /** Escalate bounty after a new kill */
  recordKill(): BountyContract {
    const newKills = this.props.killCount + 1;
    const topTier = BOUNTY_THRESHOLDS.filter(t => t.kills <= newKills).pop();
    const newLevel = (topTier?.level ?? 0) as BountyLevel;
    const newReward = topTier?.reward ?? this.props.rewardAmount;
    return new BountyContract({
      ...this.props,
      killCount: newKills,
      bountyLevel: newLevel,
      rewardAmount: newReward,
      isActive: newLevel > 0,
    });
  }

  deactivate(): BountyContract {
    return new BountyContract({ ...this.props, isActive: false });
  }

  toProps(): BountyContractProps { return { ...this.props }; }
  static fromProps(props: BountyContractProps): BountyContract {
    return new BountyContract(props);
  }
}
