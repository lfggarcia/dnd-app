/**
 * Item — domain entity for equipment and loot.
 * Immutable.
 */

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'material' | 'boss_loot';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'unique';

export interface ItemProps {
  id: string;
  seedHash: string;
  ownerGameId: string | null;
  ownerCharName: string | null;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  isEquipped: boolean;
  isUnique: boolean;
  obtainedCycle: number;
  floorObtained: number;
  goldValue: number;
  data: Record<string, unknown>;
  claimed: boolean;
}

export class Item {
  constructor(private readonly props: ItemProps) {}

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get type(): ItemType { return this.props.type; }
  get rarity(): ItemRarity { return this.props.rarity; }
  get isEquipped(): boolean { return this.props.isEquipped; }
  get isUnique(): boolean { return this.props.isUnique; }
  get goldValue(): number { return this.props.goldValue; }
  get data(): Record<string, unknown> { return this.props.data; }
  get claimed(): boolean { return this.props.claimed; }
  get ownerGameId(): string | null { return this.props.ownerGameId; }
  get ownerCharName(): string | null { return this.props.ownerCharName; }

  equip(): Item { return new Item({ ...this.props, isEquipped: true }); }
  unequip(): Item { return new Item({ ...this.props, isEquipped: false }); }
  claim(): Item { return new Item({ ...this.props, claimed: true }); }

  toProps(): ItemProps { return { ...this.props }; }
  static fromProps(props: ItemProps): Item { return new Item(props); }
}
