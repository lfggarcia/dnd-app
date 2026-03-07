import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { CharacterDraft } from '../../hooks/usePartyRoster';

type Props = {
  roster: CharacterDraft[];
  activeSlot: number;
  onSlotPress: (i: number) => void;
  classes: { index: string; name: string }[];
};

export const RosterTabs = memo(({ roster, activeSlot, onSlotPress, classes }: Props) => (
  <View className="flex-row border-b border-primary/20">
    {[0, 1, 2, 3].map(i => {
      const char = roster[i];
      const isActive = activeSlot === i;
      const cls = char ? classes.find(c => c.index === char.charClass) : null;
      return (
        <TouchableOpacity
          key={i}
          onPress={() => char && onSlotPress(i)}
          className={`flex-1 p-2 items-center border-r border-primary/10 ${
            isActive ? 'bg-primary/15 border-b-2 border-b-primary' : ''
          } ${!char ? 'opacity-20' : ''}`}
        >
          <Text className={`font-robotomono text-[8px] ${isActive ? 'text-primary' : 'text-primary/50'}`}>
            {char ? char.name : `SLOT_${i + 1}`}
          </Text>
          {char && cls && (
            <Text className="text-secondary font-robotomono text-[7px]">{cls.name}</Text>
          )}
        </TouchableOpacity>
      );
    })}
  </View>
));
