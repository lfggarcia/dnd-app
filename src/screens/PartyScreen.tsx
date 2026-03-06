import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import type { ScreenProps } from '../navigation/types';

const RACES = ['HUMAN', 'ELF', 'DWARF', 'HALFLING', 'HALF-ORC', 'TIEFLING'];
const CLASSES = ['FIGHTER', 'ROGUE', 'WIZARD', 'CLERIC', 'RANGER', 'WARLOCK'];
const BACKGROUNDS = ['SOLDIER', 'CRIMINAL', 'SAGE', 'ACOLYTE', 'OUTLANDER', 'NOBLE'];
const ALIGNMENTS = ['LG', 'NG', 'CG', 'LN', 'TN', 'CN', 'LE', 'NE', 'CE'];

type CharacterDraft = {
  name: string;
  race: number;
  charClass: number;
  background: number;
  alignment: number;
  stats: { STR: number; DEX: number; CON: number; INT: number; WIS: number; CHA: number };
};

const generateStats = () => ({
  STR: 8 + Math.floor(Math.random() * 10),
  DEX: 8 + Math.floor(Math.random() * 10),
  CON: 8 + Math.floor(Math.random() * 10),
  INT: 8 + Math.floor(Math.random() * 10),
  WIS: 8 + Math.floor(Math.random() * 10),
  CHA: 8 + Math.floor(Math.random() * 10),
});

const defaultCharacter = (index: number): CharacterDraft => ({
  name: `UNIT_${String(index + 1).padStart(2, '0')}`,
  race: 0,
  charClass: index % CLASSES.length,
  background: 0,
  alignment: 4,
  stats: generateStats(),
});

const StatBar = ({ label, value }: { label: string; value: number }) => {
  const mod = Math.floor((value - 10) / 2);
  const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
  const pct = ((value - 3) / 15) * 100;

  return (
    <View className="flex-row items-center mb-1">
      <Text className="text-primary font-robotomono text-[9px] w-8">{label}</Text>
      <View className="flex-1 h-3 bg-muted/40 border border-primary/20 mx-2">
        <View className="h-full bg-primary/40" style={{ width: `${Math.min(pct, 100)}%` }} />
      </View>
      <Text className="text-primary font-robotomono text-[10px] w-6 text-right">{value}</Text>
      <Text className="text-secondary font-robotomono text-[9px] w-6 text-right">{modStr}</Text>
    </View>
  );
};

export const PartyScreen = ({ navigation }: ScreenProps<'Party'>) => {
  const [roster, setRoster] = useState<CharacterDraft[]>([defaultCharacter(0)]);
  const [activeSlot, setActiveSlot] = useState(0);

  const current = roster[activeSlot];

  const updateCurrent = (updates: Partial<CharacterDraft>) => {
    setRoster(prev => prev.map((c, i) => (i === activeSlot ? { ...c, ...updates } : c)));
  };

  const addCharacter = () => {
    if (roster.length >= 4) return;
    const newChar = defaultCharacter(roster.length);
    setRoster(prev => [...prev, newChar]);
    setActiveSlot(roster.length);
  };

  const removeCharacter = () => {
    if (roster.length <= 1) return;
    setRoster(prev => prev.filter((_, i) => i !== activeSlot));
    setActiveSlot(a => Math.max(0, a - 1));
  };

  const rerollStats = () => {
    updateCurrent({ stats: generateStats() });
  };

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />

      {/* Header */}
      <View className="p-3 border-b border-primary/40 flex-row justify-between items-center">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-primary font-robotomono text-xs">{'<'} BACK</Text>
        </TouchableOpacity>
        <Text className="text-primary font-robotomono text-[10px]">PARTY_ASSEMBLY</Text>
        <Text className="text-primary/50 font-robotomono text-[9px]">
          {roster.length}/4 SLOTS
        </Text>
      </View>

      {/* Party Roster Tabs */}
      <View className="flex-row border-b border-primary/20">
        {[0, 1, 2, 3].map(i => {
          const char = roster[i];
          const isActive = activeSlot === i;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => char && setActiveSlot(i)}
              className={`flex-1 p-2 items-center border-r border-primary/10 ${
                isActive ? 'bg-primary/15 border-b-2 border-b-primary' : ''
              } ${!char ? 'opacity-20' : ''}`}
            >
              <Text className={`font-robotomono text-[8px] ${isActive ? 'text-primary' : 'text-primary/50'}`}>
                {char ? char.name : `SLOT_${i + 1}`}
              </Text>
              {char && (
                <Text className="text-secondary font-robotomono text-[7px]">
                  {CLASSES[char.charClass]}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {/* Character Portrait Area */}
        <View className="flex-row mb-4">
          <View className="w-24 h-32 border border-primary/40 bg-muted/30 items-center justify-center mr-4">
            <View className="w-16 h-24 border border-primary/30 border-dashed items-center justify-center">
              <Text className="text-primary/30 font-robotomono text-[7px]">PORTRAIT</Text>
            </View>
            <Text className="text-primary/40 font-robotomono text-[6px] mt-1">SCAN_ACTIVE</Text>
          </View>

          {/* Basic Info */}
          <View className="flex-1">
            <Text className="text-primary/50 font-robotomono text-[8px] mb-1">DESIGNATION:</Text>
            <Text className="text-primary font-robotomono text-sm font-bold mb-2">
              {current.name}
            </Text>
            <View className="flex-row flex-wrap">
              <View className="mr-3 mb-1">
                <Text className="text-primary/40 font-robotomono text-[7px]">RACE</Text>
                <Text className="text-primary font-robotomono text-[10px]">{RACES[current.race]}</Text>
              </View>
              <View className="mr-3 mb-1">
                <Text className="text-primary/40 font-robotomono text-[7px]">CLASS</Text>
                <Text className="text-secondary font-robotomono text-[10px]">{CLASSES[current.charClass]}</Text>
              </View>
              <View className="mr-3 mb-1">
                <Text className="text-primary/40 font-robotomono text-[7px]">ALIGNMENT</Text>
                <Text className="text-accent font-robotomono text-[10px]">{ALIGNMENTS[current.alignment]}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Race Selection */}
        <View className="mb-4">
          <Text className="text-primary font-robotomono text-[9px] mb-2">RACE_SELECT:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {RACES.map((r, i) => (
              <TouchableOpacity
                key={r}
                onPress={() => updateCurrent({ race: i })}
                className={`mr-2 px-3 py-2 border ${
                  current.race === i
                    ? 'bg-primary border-primary'
                    : 'border-primary/30 bg-muted/20'
                }`}
              >
                <Text
                  className={`text-[9px] font-robotomono font-bold ${
                    current.race === i ? 'text-background' : 'text-primary/70'
                  }`}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Class Selection */}
        <View className="mb-4">
          <Text className="text-primary font-robotomono text-[9px] mb-2">CLASS_SELECT:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CLASSES.map((c, i) => (
              <TouchableOpacity
                key={c}
                onPress={() => updateCurrent({ charClass: i })}
                className={`mr-2 px-3 py-2 border ${
                  current.charClass === i
                    ? 'bg-secondary border-secondary'
                    : 'border-secondary/30 bg-muted/20'
                }`}
              >
                <Text
                  className={`text-[9px] font-robotomono font-bold ${
                    current.charClass === i ? 'text-background' : 'text-secondary/70'
                  }`}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Background Selection */}
        <View className="mb-4">
          <Text className="text-primary font-robotomono text-[9px] mb-2">BACKGROUND:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {BACKGROUNDS.map((b, i) => (
              <TouchableOpacity
                key={b}
                onPress={() => updateCurrent({ background: i })}
                className={`mr-2 px-3 py-2 border ${
                  current.background === i
                    ? 'bg-accent border-accent'
                    : 'border-accent/30 bg-muted/20'
                }`}
              >
                <Text
                  className={`text-[9px] font-robotomono font-bold ${
                    current.background === i ? 'text-background' : 'text-accent/70'
                  }`}
                >
                  {b}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Stats */}
        <View className="mb-4 border border-primary/30 p-3 bg-muted/10">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-primary font-robotomono text-[9px]">ABILITY_SCORES:</Text>
            <TouchableOpacity onPress={rerollStats} className="border border-primary/40 px-2 py-1">
              <Text className="text-primary font-robotomono text-[8px]">REROLL_4D6</Text>
            </TouchableOpacity>
          </View>
          {Object.entries(current.stats).map(([key, val]) => (
            <StatBar key={key} label={key} value={val} />
          ))}
        </View>

        {/* Alignment */}
        <View className="mb-4">
          <Text className="text-primary font-robotomono text-[9px] mb-2">ALIGNMENT_MATRIX:</Text>
          <View className="flex-row flex-wrap">
            {ALIGNMENTS.map((a, i) => (
              <TouchableOpacity
                key={a}
                onPress={() => updateCurrent({ alignment: i })}
                className={`w-[30%] mr-[1.5%] mb-1 p-2 border items-center ${
                  current.alignment === i
                    ? 'bg-primary/20 border-primary'
                    : 'border-primary/15 bg-muted/10'
                }`}
              >
                <Text
                  className={`text-[9px] font-robotomono ${
                    current.alignment === i ? 'text-primary font-bold' : 'text-primary/40'
                  }`}
                >
                  {a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Trait Icons Preview */}
        <View className="mb-4 border border-primary/20 p-3 bg-primary/5">
          <Text className="text-primary font-robotomono text-[9px] mb-2">TRAIT_PREVIEW:</Text>
          <View className="flex-row flex-wrap">
            <Text className="text-secondary font-robotomono text-[10px] mr-4">
              ⚖ MORAL: {['CHAOTIC', 'NEUTRAL', 'HONORABLE'][Math.min(2, Math.floor(current.alignment / 3))]}
            </Text>
            <Text className="text-accent font-robotomono text-[10px] mr-4">🧠 MENTAL: STABLE</Text>
          </View>
        </View>

        <View className="h-20" />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View className="border-t border-primary/40 p-3 bg-background">
        <View className="flex-row justify-between mb-3">
          <TouchableOpacity
            onPress={addCharacter}
            disabled={roster.length >= 4}
            className={`flex-1 mr-2 border border-primary p-2 items-center ${
              roster.length >= 4 ? 'opacity-30' : 'bg-primary/10'
            }`}
          >
            <Text className="text-primary font-robotomono text-[10px]">+ ADD_MEMBER</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={removeCharacter}
            disabled={roster.length <= 1}
            className={`flex-1 ml-2 border border-destructive p-2 items-center ${
              roster.length <= 1 ? 'opacity-30' : 'bg-destructive/10'
            }`}
          >
            <Text className="text-destructive font-robotomono text-[10px]">- REMOVE</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Village')}
          className="bg-primary p-3 items-center"
        >
          <Text className="text-background font-bold font-robotomono">START_EXPEDITION</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
