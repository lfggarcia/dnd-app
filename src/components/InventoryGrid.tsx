import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useI18n } from '../i18n';
import type { LootDrop } from '../services/lootService';

const RARITY_COLORS: Record<LootDrop['rarity'], string> = {
  common:   '#6b7280',
  uncommon: '#22c55e',
  rare:     '#3b82f6',
  unique:   '#a855f7',
};

const GRID_COLS = 5;
const GRID_ROWS = 6;
const SLOT_COUNT = GRID_COLS * GRID_ROWS;

type Props = {
  items: LootDrop[];
  onItemPress: (item: LootDrop) => void;
  onItemEquip: (item: LootDrop, charName: string) => void;
};

export const InventoryGrid = ({ items, onItemPress }: Props) => {
  const { lang } = useI18n();
  const slots = Array.from({ length: SLOT_COUNT });

  return (
    <View>
      <View className="flex-row flex-wrap gap-1">
        {slots.map((_, idx) => {
          const item = items[idx];
          const color = item ? RARITY_COLORS[item.rarity] : undefined;
          return (
            <TouchableOpacity
              key={idx}
              className="w-12 h-12 border rounded items-center justify-center"
              style={{
                borderColor: color ? `${color}88` : '#1f2937',
                backgroundColor: color ? `${color}11` : '#0a0a0a',
              }}
              onPress={() => item && onItemPress(item)}
              activeOpacity={item ? 0.7 : 1}
            >
              {item && (
                <Text className="font-robotomono text-xs text-center" style={{ color, fontSize: 9 }} numberOfLines={2}>
                  {item.name.slice(0, 6)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {items.length === 0 && (
        <Text className="text-primary/30 font-robotomono text-xs text-center mt-2">
          {lang === 'es' ? 'Inventario vacío' : 'Empty inventory'}
        </Text>
      )}
    </View>
  );
};
