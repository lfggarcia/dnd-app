import { Alliance, AllianceProps } from '../../../domain/entities/Alliance';
import type { IGameRepository } from '../../../domain/repositories/IGameRepository';
import { GameStateError } from '../../../domain/errors/DomainError';

// These will be replaced by IAllianceRepository once that port is added.
// For now, raw DB interaction is brokered through IGameRepository snapshots.

export interface IAllianceStorage {
  getActiveAlliances(gameId: string, seedHash: string): AllianceProps[];
  saveAlliance(alliance: AllianceProps): void;
  terminateAlliance(id: string): void;
}

/**
 * ProposeAllianceUseCase — forms a new alliance contract with an AI party.
 */
export class ProposeAllianceUseCase {
  constructor(
    private readonly allianceStorage: IAllianceStorage,
    private readonly gameRepo: IGameRepository,
  ) {}

  execute(
    gameId: string,
    seedHash: string,
    rivalName: string,
    protectionFee: number,
    durationCycles: number,
    currentCycle: number,
    currentGold: number,
  ): Alliance {
    const totalCost = protectionFee * durationCycles;
    if (currentGold < totalCost) {
      throw new GameStateError(`Insufficient gold for alliance: need ${totalCost}, have ${currentGold}`);
    }

    const alliance = Alliance.fromProps({
      id: `${seedHash}_alliance_${gameId}_${rivalName}_${currentCycle}`,
      seedHash,
      partyA: gameId,
      partyB: rivalName,
      protectionFee,
      expiresAtCycle: currentCycle + durationCycles,
      status: 'active',
      createdCycle: currentCycle,
    });

    this.allianceStorage.saveAlliance(alliance.toProps());
    this.gameRepo.update(gameId, { gold: currentGold - totalCost });

    return alliance;
  }
}
