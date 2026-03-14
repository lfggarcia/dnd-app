import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SectionCard, SectionHeader, SectionHint, DescriptionBox } from './atoms';
import { DnaIcon } from '../Icons';
import { getTranslatedField } from '../../services/translationBridge';
import { getDescFromRaw } from '../../services/characterStats';
import type { Lang } from '../../i18n';

type RaceEntry = { index: string; name: string; raw: Record<string, unknown> };

type RaceSectionProps = {
  races: RaceEntry[];
  selectedRace: string;
  currentRace: RaceEntry | undefined;
  racialBonuses: Record<string, number>;
  featureChoices: Record<string, string | string[]>;
  lang: Lang;
  raceSelectLabel: string;
  raceDescHint: string;
  onRaceSelect: (index: string, keptChoices: Record<string, string | string[]>) => void;
  getAbilityName: (key: string) => string;
};

export const RaceSection = memo(({
  races, selectedRace, currentRace, racialBonuses, featureChoices,
  lang, raceSelectLabel, raceDescHint, onRaceSelect, getAbilityName,
}: RaceSectionProps) => (
  <SectionCard borderColor="border-primary/40">
    <SectionHeader icon={<DnaIcon size={14} color="rgba(0,255,65,0.9)" />} label={raceSelectLabel} />
    <SectionHint text={raceDescHint} />
    <View className="flex-row flex-wrap">
      {races.map(r => {
        const selected = selectedRace === r.index;
        return (
          <TouchableOpacity
            key={r.index}
            onPress={() => {
              const kept: Record<string, string | string[]> = {};
              for (const [k, v] of Object.entries(featureChoices)) {
                if (!k.startsWith('dragonborn-') && !k.startsWith('half-elf-')) kept[k] = v;
              }
              onRaceSelect(r.index, kept);
            }}
            className={`mr-2 mb-2 px-4 py-2 border rounded-sm ${
              selected ? 'bg-primary border-primary' : 'border-primary bg-muted'
            }`}
          >
            <Text className={`text-xs font-robotomono font-bold ${selected ? 'text-background' : 'text-primary'}`}>
              {r.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
    {currentRace && (
      <DescriptionBox
        text={
          getTranslatedField('races', selectedRace, 'desc', lang) ||
          getDescFromRaw(currentRace.raw)
        }
        borderColor="border-primary"
        textColor="text-primary"
      />
    )}
    {Object.keys(racialBonuses).length > 0 && (
      <View className="mt-2 flex-row flex-wrap">
        {Object.entries(racialBonuses).map(([key, val]) => (
          <View key={key} className="mr-2 mb-1 border border-accent/30 rounded px-2 py-1 bg-accent/5">
            <Text className="text-accent font-robotomono text-[9px] font-bold">
              {getAbilityName(key)} +{val}
            </Text>
          </View>
        ))}
      </View>
    )}
  </SectionCard>
));
