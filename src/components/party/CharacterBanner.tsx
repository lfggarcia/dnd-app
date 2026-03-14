import React, { memo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { PortraitSection } from './PortraitSection';
import { hasCatalogPortraits } from '../../services/characterCatalogService';
import type { Lang } from '../../i18n';

const S = StyleSheet.create({
  nameInput: {
    color: '#00FF41', fontFamily: 'RobotoMono-Bold', fontSize: 16,
    fontWeight: 'bold', padding: 0, margin: 0,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,65,0.3)', paddingBottom: 2,
    flex: 1,
  },
  bannerSub: { color: 'rgba(0,255,65,0.5)' },
  diceBtn: {
    marginLeft: 8, borderWidth: 1, borderColor: 'rgba(0,255,65,0.3)',
    borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4,
  },
  diceBtnLabel: { color: 'rgba(0,255,65,0.7)', fontFamily: 'RobotoMono-Regular', fontSize: 11 },
});

type CharacterBannerProps = {
  name: string;
  raceName: string;
  className: string;
  subName?: string;
  charClass: string;
  lang: Lang;
  namePlaceholder: string;
  portrait: string | null;
  portraitRolls: number;
  generating: boolean;
  error: string | null;
  expanded: boolean;
  maxRolls: number;
  onNameChange: (text: string) => void;
  onRandomName: () => void;
  onToggleExpand: () => void;
  onGenerate: () => void;
  onView: () => void;
  onSelectFromCatalog: () => void;
};

export const CharacterBanner = memo(({
  name, raceName, className, subName, charClass, lang,
  namePlaceholder, portrait, portraitRolls, generating,
  error, expanded, maxRolls,
  onNameChange, onRandomName, onToggleExpand, onGenerate,
  onView, onSelectFromCatalog,
}: CharacterBannerProps) => (
  <View className="border border-primary/30 rounded-md bg-primary/5 px-4 py-3">
    <View className="flex-row items-center mb-1">
      <TextInput
        value={name}
        onChangeText={onNameChange}
        maxLength={16}
        style={S.nameInput}
        placeholderTextColor="rgba(0,255,65,0.3)"
        placeholder={namePlaceholder}
        selectionColor="#00FF41"
      />
      <TouchableOpacity onPress={onRandomName} style={S.diceBtn}>
        <Text style={S.diceBtnLabel}>{lang === 'es' ? '🎲 NOMBRE' : '🎲 NAME'}</Text>
      </TouchableOpacity>
    </View>
    <Text style={S.bannerSub} className="font-robotomono text-xs mb-3">
      {raceName} · {className}{subName ? ` · ${subName}` : ''}
    </Text>
    <PortraitSection
      lang={lang}
      portrait={portrait ?? undefined}
      portraitRolls={portraitRolls}
      generating={generating}
      error={error}
      expanded={expanded}
      maxRolls={maxRolls}
      onToggleExpand={onToggleExpand}
      onGenerate={onGenerate}
      onView={onView}
      catalogAvailable={hasCatalogPortraits(charClass)}
      onSelectFromCatalog={onSelectFromCatalog}
    />
  </View>
));
