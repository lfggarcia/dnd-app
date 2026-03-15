import type { IGameRepository } from '../../../domain/repositories/IGameRepository';
import { GameStateError } from '../../../domain/errors/DomainError';

/**
 * BuyItemUseCase — deducts gold from the game for a shop purchase.
 */
export class BuyItemUseCase {
  constructor(private readonly gameRepo: IGameRepository) {}

  execute(gameId: string, itemCost: number, currentGold: number): number {
    if (currentGold < itemCost) {
      throw new GameStateError(`Insufficient gold: need ${itemCost}, have ${currentGold}`);
    }
    const newGold = currentGold - itemCost;
    this.gameRepo.update(gameId, { gold: newGold });
    return newGold;
  }
}
