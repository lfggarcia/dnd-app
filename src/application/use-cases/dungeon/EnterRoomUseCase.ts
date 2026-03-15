import { Dungeon, DungeonProps } from '../../domain/entities/Dungeon';
import type { IGameRepository } from '../../domain/repositories/IGameRepository';
import { GameStateError } from '../../domain/errors/DomainError';

/**
 * EnterRoomUseCase — moves the party into a connected room and persists map state.
 */
export class EnterRoomUseCase {
  constructor(private readonly gameRepo: IGameRepository) {}

  execute(
    gameId: string,
    dungeonProps: DungeonProps,
    targetRoomId: number,
    serializedMapState: string,
  ): DungeonProps {
    const dungeon = Dungeon.fromProps(dungeonProps);
    const updated = dungeon.enterRoom(targetRoomId);
    this.gameRepo.update(gameId, { mapState: serializedMapState });
    return updated.toProps();
  }
}
