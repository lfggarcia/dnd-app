/**
 * Alliance — domain entity for inter-party protection contracts.
 * SYSTEMS.MD: "No existe traición arbitraria. La ruptura es contractual."
 * Immutable.
 */

export type AllianceStatus = 'active' | 'expired' | 'terminated';

export interface AllianceProps {
  id: string;
  seedHash: string;
  partyA: string;        // player gameId
  partyB: string;        // AI party name
  protectionFee: number; // gold per cycle
  expiresAtCycle: number;
  status: AllianceStatus;
  createdCycle: number;
}

export class Alliance {
  constructor(private readonly props: AllianceProps) {}

  get id(): string { return this.props.id; }
  get partyA(): string { return this.props.partyA; }
  get partyB(): string { return this.props.partyB; }
  get protectionFee(): number { return this.props.protectionFee; }
  get expiresAtCycle(): number { return this.props.expiresAtCycle; }
  get status(): AllianceStatus { return this.props.status; }
  get createdCycle(): number { return this.props.createdCycle; }
  get isActive(): boolean { return this.props.status === 'active'; }

  totalCost(currentCycle: number): number {
    const remaining = Math.max(0, this.props.expiresAtCycle - currentCycle);
    return remaining * this.props.protectionFee;
  }

  expire(): Alliance { return new Alliance({ ...this.props, status: 'expired' }); }
  terminate(): Alliance { return new Alliance({ ...this.props, status: 'terminated' }); }

  toProps(): AllianceProps { return { ...this.props }; }
  static fromProps(props: AllianceProps): Alliance { return new Alliance(props); }
}
