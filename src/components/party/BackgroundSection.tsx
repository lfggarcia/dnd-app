import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SectionCard, SectionHeader, SectionHint, DescriptionBox } from './atoms';
import { ScrollIcon } from '../Icons';
import type { Lang } from '../../i18n';

type BgEntry = { index: string; name: string };

type BackgroundSectionProps = {
  backgrounds: BgEntry[];
  selectedBackground: string;
  bgDescription: string;
  lang: Lang;
  bgLabel: string;
  bgDescHint: string;
  onSelect: (index: string) => void;
};

export const BackgroundSection = memo(({
  backgrounds, selectedBackground, bgDescription, lang,
  bgLabel, bgDescHint, onSelect,
}: BackgroundSectionProps) => (
  <SectionCard borderColor="border-accent/40">
    <SectionHeader
      icon={<ScrollIcon size={14} color="rgba(0,229,255,0.9)" />}
      label={bgLabel}
      color="text-accent"
    />
    <SectionHint text={bgDescHint} color="text-accent/50" />
    <View className="flex-row flex-wrap">
      {backgrounds.map(b => {
        const selected = selectedBackground === b.index;
        return (
          <TouchableOpacity
            key={b.index}
            onPress={() => onSelect(b.index)}
            className={`mr-2 mb-2 px-4 py-2 border rounded-sm ${
              selected ? 'bg-accent border-accent' : 'border-accent bg-muted'
            }`}
          >
            <Text className={`text-xs font-robotomono font-bold ${selected ? 'text-background' : 'text-accent'}`}>
              {b.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
    {bgDescription ? (
      <DescriptionBox text={bgDescription} borderColor="border-accent" textColor="text-accent" />
    ) : null}
  </SectionCard>
));
