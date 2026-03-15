import type { ItemProps } from '../entities/Item';

/**
 * IItemRepository — port for item/loot persistence.
 */
export interface IItemRepository {
  findByGame(gameId: string): ItemProps[];
  findById(id: string): ItemProps | null;
  create(item: Omit<ItemProps, 'id'>): ItemProps;
  update(id: string, updates: Partial<ItemProps>): void;
  delete(id: string): void;
  claim(id: string): void;
}
