import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SectionCard, SectionHeader, SectionHint, DescriptionBox } from './atoms';
import { ScaleIcon, BrainIcon, TagIcon } from '../Icons';
import { getTranslatedField } from '../../services/translationBridge';
import { getDescFromRaw, ALIGNMENT_ORDER } from '../../services/characterStats';
import type { Lang } from '../../i18n';

type AlignmentEntry = { index: string; name: string; raw: Record<string, unknown> };

type AlignmentSectionProps = {
  alignments: AlignmentEntry[];
  selectedAlignment: string;
  currentAlign: AlignmentEntry | undefined;
  lang: Lang;
  alignmentLabel: string;
  alignmentDescHint: string;
  onSelect: (index: string) => void;
};

type TraitsSectionProps = {
  selectedAlignment: string;
  lang: Lang;
  traitPreviewLabel: string;
  moralLabel: string;
  honorableLabel: string;
  neutralLabel: string;
  chaoticLabel: string;
  mentalLabel: string;
  stableLabel: string;
};

export const AlignmentSection = memo(({
  alignments, selectedAlignment, currentAlign, lang,
  alignmentLabel, alignmentDescHint, onSelect,
}: AlignmentSectionProps) => (
  <SectionCard borderColor="border-primary/40">
    <SectionHeader icon={<ScaleIcon size={14} color="rgba(0,255,65,0.9)" />} label={alignmentLabel} />
    <SectionHint text={alignmentDescHint} />
    <View className="flex-row flex-wrap justify-between">
      {alignments.map(a => {
        const abbr = (a.raw as Record<string, unknown>).abbreviation as string || a.index;
        const selected = selectedAlignment === a.index;
        return (
          <TouchableOpacity
            key={a.index}
            onPress={() => onSelect(a.index)}
            className={`w-[31%] mb-2 py-3 border rounded-sm items-center ${
              selected ? 'bg-primary border-primary' : 'border-primary bg-muted'
            }`}
          >
            <Text className={`text-xs font-robotomono ${selected ? 'text-background font-bold' : 'text-primary'}`}>
              {abbr}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
    {currentAlign && (
      <DescriptionBox
        text={
          getTranslatedField('alignments', selectedAlignment, 'desc', lang) ||
          getDescFromRaw(currentAlign.raw)
        }
        borderColor="border-primary"
        textColor="text-primary"
      />
    )}
  </SectionCard>
));

export const TraitsPreviewSection = memo(({
  selectedAlignment, lang, traitPreviewLabel,
  moralLabel, honorableLabel, neutralLabel, chaoticLabel,
  mentalLabel, stableLabel,
}: TraitsSectionProps) => {
  const idx = ALIGNMENT_ORDER.indexOf(selectedAlignment);
  const row = idx >= 0 ? Math.floor(idx / 3) : 1;
  const moral = [honorableLabel, neutralLabel, chaoticLabel][row] || neutralLabel;

  return (
    <SectionCard borderColor="border-primary">
      <SectionHeader icon={<TagIcon size={14} color="rgba(0,255,65,0.9)" />} label={traitPreviewLabel} />
      <View className="flex-row flex-wrap mt-2">
        <View className="flex-row items-center mr-6 mb-1">
          <ScaleIcon size={14} color="rgba(255,176,0,0.9)" />
          <Text className="text-secondary font-robotomono text-sm" style={{ marginLeft: 4 }}>
            {moralLabel}: {moral}
          </Text>
        </View>
        <View className="flex-row items-center mb-1">
          <BrainIcon size={14} color="rgba(0,229,255,0.9)" />
          <Text className="text-accent font-robotomono text-sm" style={{ marginLeft: 4 }}>
            {mentalLabel}: {stableLabel}
          </Text>
        </View>
      </View>
    </SectionCard>
  );
});
