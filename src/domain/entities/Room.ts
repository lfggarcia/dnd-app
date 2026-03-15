/**
 * Room — domain entity representing a single dungeon room.
 * Immutable.
 */

export type RoomType =
  | 'START'
  | 'NORMAL'
  | 'ELITE'
  | 'EVENT'
  | 'TREASURE'
  | 'BOSS'
  | 'SECRET'
  | 'SAFE_ZONE';

export interface RoomProps {
  id: number;
  type: RoomType;
  connections: number[];
  pos: { x: number; y: number };
  label: string;
  visited: boolean;
  revealed: boolean;
  mutated: boolean;
}

export class Room {
  constructor(private readonly props: RoomProps) {}

  get id(): number { return this.props.id; }
  get type(): RoomType { return this.props.type; }
  get connections(): number[] { return this.props.connections; }
  get pos(): { x: number; y: number } { return this.props.pos; }
  get label(): string { return this.props.label; }
  get visited(): boolean { return this.props.visited; }
  get revealed(): boolean { return this.props.revealed; }
  get mutated(): boolean { return this.props.mutated; }

  get isBossRoom(): boolean { return this.props.type === 'BOSS'; }
  get isSafeZone(): boolean { return this.props.type === 'SAFE_ZONE'; }
  get isSecret(): boolean { return this.props.type === 'SECRET'; }
  get isCombatRoom(): boolean {
    return this.props.type === 'NORMAL' || this.props.type === 'ELITE' || this.props.type === 'BOSS';
  }

  markVisited(): Room {
    return new Room({ ...this.props, visited: true, revealed: true });
  }

  markRevealed(): Room {
    return new Room({ ...this.props, revealed: true });
  }

  toProps(): RoomProps {
    return { ...this.props };
  }

  static fromProps(props: RoomProps): Room {
    return new Room(props);
  }
}
