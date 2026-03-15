import { Room, RoomType } from './Room';
import { DungeonFloor } from '../value-objects/DungeonFloor';
import { GameStateError } from '../errors/DomainError';

export interface DungeonLayout {
  seedHash: string;
  floorIndex: number;
  rooms: Room[];
  secretRoomIds: number[];
  startRoomId: number;
  bossRoomId: number;
}

export interface DungeonProps {
  layout: DungeonLayout;
  currentRoomId: number;
  visitedRoomIds: number[];
  revealedRoomIds: number[];
}

/**
 * Dungeon — domain entity for a floor layout and current exploration state.
 * Immutable.
 */
export class Dungeon {
  private readonly _floor: DungeonFloor;

  constructor(private readonly props: DungeonProps) {
    this._floor = new DungeonFloor(props.layout.floorIndex);
  }

  get floor(): DungeonFloor { return this._floor; }
  get currentRoomId(): number { return this.props.currentRoomId; }
  get seedHash(): string { return this.props.layout.seedHash; }

  get currentRoom(): Room {
    const room = this.props.layout.rooms.find(r => r.id === this.props.currentRoomId);
    if (!room) throw new GameStateError(`Room ${this.props.currentRoomId} not found in dungeon`);
    return room;
  }

  get availableExits(): Room[] {
    return this.currentRoom.connections
      .map(id => this.props.layout.rooms.find(r => r.id === id))
      .filter((r): r is Room => r !== undefined);
  }

  get isBossRoom(): boolean { return this.currentRoom.isBossRoom; }
  get isSafeZone(): boolean { return this.currentRoom.isSafeZone; }

  getRoomById(id: number): Room | undefined {
    return this.props.layout.rooms.find(r => r.id === id);
  }

  enterRoom(roomId: number): Dungeon {
    if (!this.currentRoom.connections.includes(roomId)) {
      throw new GameStateError(`Cannot enter room ${roomId} — not connected to current room`);
    }
    const visited = [...new Set([...this.props.visitedRoomIds, roomId])];
    const revealed = this.revealAdjacentRooms(roomId);
    return new Dungeon({
      ...this.props,
      currentRoomId: roomId,
      visitedRoomIds: visited,
      revealedRoomIds: revealed,
    });
  }

  private revealAdjacentRooms(roomId: number): number[] {
    const room = this.getRoomById(roomId);
    if (!room) return this.props.revealedRoomIds;
    const adjacent = room.connections;
    return [...new Set([...this.props.revealedRoomIds, roomId, ...adjacent])];
  }

  toProps(): DungeonProps {
    return { ...this.props };
  }

  static fromProps(props: DungeonProps): Dungeon {
    return new Dungeon(props);
  }
}
