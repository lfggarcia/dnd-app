import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SectionCard, SectionHeader, SectionHint, DescriptionBox } from './atoms';
import { SubclassAbilitiesPanel } from './SubclassAbilitiesPanel';
import { SwordIcon, TridentIcon } from '../Icons';
import { getTranslatedField } from '../../services/translationBridge';
import { getDescFromRaw } from '../../services/characterStats';
import type { Lang } from '../../i18n';

type ClassEntry = { index: string; name: string; raw: Record<string, unknown> };
type SubEntry = { index: string; name: string; raw: Record<string, unknown> };

type ClassSectionProps = {
  classes: ClassEntry[];
  selectedClass: string;
  currentClass: ClassEntry | undefined;
  lang: Lang;
  classSelectLabel: string;
  classDescHint: string;
  onClassChange: (index: string) => void;
};

type SubclassSectionProps = {
  subs: SubEntry[];
  selectedSubclass: string;
  currentSubData: SubEntry | undefined;
  lang: Lang;
  onSubclassSelect: (index: string) => void;
};

export const ClassSection = memo(({
  classes, selectedClass, currentClass, lang, classSelectLabel, classDescHint, onClassChange,
}: ClassSectionProps) => (
  <SectionCard borderColor="border-secondary/40">
    <SectionHeader
      icon={<SwordIcon size={14} color="rgba(255,176,0,0.9)" />}
      label={classSelectLabel}
      color="text-secondary"
    />
    <SectionHint text={classDescHint} color="text-secondary/50" />
    <View className="flex-row flex-wrap">
      {classes.map(c => {
        const selected = selectedClass === c.index;
        return (
          <TouchableOpacity
            key={c.index}
            onPress={() => onClassChange(c.index)}
            className={`mr-2 mb-2 px-4 py-2 border rounded-sm ${
              selected ? 'bg-secondary border-secondary' : 'border-secondary bg-muted'
            }`}
          >
            <Text className={`text-xs font-robotomono font-bold ${selected ? 'text-background' : 'text-secondary'}`}>
              {c.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
    {currentClass && (
      <DescriptionBox
        text={
          getTranslatedField('classes', selectedClass, 'desc', lang) ||
          getDescFromRaw(currentClass.raw)
        }
        borderColor="border-secondary"
        textColor="text-secondary"
      />
    )}
  </SectionCard>
));

export const SubclassSection = memo(({
  subs, selectedSubclass, currentSubData, lang, onSubclassSelect,
}: SubclassSectionProps) => {
  if (subs.length === 0) return null;
  return (
    <SectionCard borderColor="border-secondary/40">
      <SectionHeader
        icon={<TridentIcon size={14} color="rgba(255,176,0,0.9)" />}
        label={lang === 'es' ? 'SUBCLASE' : 'SUBCLASS'}
        color="text-secondary"
      />
      <SectionHint
        text={
          lang === 'es'
            ? 'Elige tu especialización (máx. 2 por clase)'
            : 'Choose your specialization (max 2 per class)'
        }
        color="text-secondary/50"
      />
      <View className="flex-row flex-wrap">
        {subs.map(s => {
          const selected = selectedSubclass === s.index;
          return (
            <TouchableOpacity
              key={s.index}
              onPress={() => onSubclassSelect(s.index)}
              className={`mr-2 mb-2 px-4 py-2 border rounded-sm ${
                selected ? 'bg-secondary border-secondary' : 'border-secondary bg-muted'
              }`}
            >
              <Text className={`text-xs font-robotomono font-bold ${selected ? 'text-background' : 'text-secondary'}`}>
                {s.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {currentSubData && (
        <SubclassAbilitiesPanel
          subclassIndex={selectedSubclass}
          raw={currentSubData.raw}
          lang={lang}
        />
      )}
    </SectionCard>
  );
});
