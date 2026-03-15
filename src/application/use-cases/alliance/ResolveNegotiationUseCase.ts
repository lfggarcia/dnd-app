import type { IAllianceStorage } from './ProposeAllianceUseCase';
import type { IGameRepository } from '../../domain/repositories/IGameRepository';
import { Alliance } from '../../domain/entities/Alliance';

/**
 * ResolveNegotiationUseCase — handles the result of a negotiation (accept/reject).
 * If accepted, delegates to ProposeAllianceUseCase logic.
 * If rejected, no state change.
 */
export class ResolveNegotiationUseCase {
  constructor(
    private readonly allianceStorage: IAllianceStorage,
    private readonly gameRepo: IGameRepository,
  ) {}

  terminateAlliance(allianceId: string): void {
    this.allianceStorage.terminateAlliance(allianceId);
  }

  getActiveAlliances(gameId: string, seedHash: string): Alliance[] {
    return this.allianceStorage
      .getActiveAlliances(gameId, seedHash)
      .map(Alliance.fromProps);
  }
}
