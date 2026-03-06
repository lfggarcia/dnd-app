import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryModal, GlossaryButton } from '../components/GlossaryModal';
import { useGlossary } from '../hooks/useGlossary';
import { useI18n } from '../i18n';
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

const STAT_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;

const StatBar = ({ statKey, value, t }: { statKey: string; value: number; t: (k: string) => string }) => {
  const mod = Math.floor((value - 10) / 2);
  const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
  const pct = ((value - 3) / 15) * 100;
  const label = t(`glossary.stats.${statKey}.name`).split(' ')[0];

  return (
    <View className="flex-row items-center mb-2">
      <Text className="text-primary font-robotomono text-xs w-10 font-bold">{label}</Text>
      <View className="flex-1 h-4 bg-muted/40 border border-primary/30 mx-2 rounded-sm">
        <View className="h-full bg-primary/50 rounded-sm" style={{ width: `${Math.min(pct, 100)}%` }} />
      </View>
      <Text className="text-primary font-robotomono text-sm w-7 text-right font-bold">{value}</Text>
      <Text className="text-secondary font-robotomono text-xs w-7 text-right">{modStr}</Text>
    </View>
  );
};

/** Reusable section card wrapper */
const SectionCard = ({ children, borderColor = 'border-primary/30' }: { children: React.ReactNode; borderColor?: string }) => (
  <View className={`mb-5 border ${borderColor} rounded-md bg-muted/10 p-4`}>{children}</View>
);

const SectionHeader = ({ icon, label, color = 'text-primary' }: { icon: string; label: string; color?: string }) => (
  <Text className={`${color} font-robotomono text-sm font-bold mb-1`}>{icon}  {label}</Text>
);

const SectionHint = ({ text, color = 'text-primary/50' }: { text: string; color?: string }) => (
  <Text className={`${color} font-robotomono text-xs mb-3`}>{text}</Text>
);

const DescriptionBox = ({ text, borderColor = 'border-primary/40', textColor = 'text-primary/70' }: { text: string; borderColor?: string; textColor?: string }) => (
  <View className={`mt-3 border-l-2 ${borderColor} pl-3 py-2 bg-background/60 rounded-r-sm`}>
    <Text className={`${textColor} font-robotomono text-[11px] leading-4`}>{text}</Text>
  </View>
);

export const PartyScreen = ({ navigation }: ScreenProps<'Party'>) => {
  const { t } = useI18n();
  const glossary = useGlossary();
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

  const raceKey = RACES[current.race].replace('-', '_');
  const classKey = CLASSES[current.charClass];
  const bgKey = BACKGROUNDS[current.background];
  const alignKey = ALIGNMENTS[current.alignment];

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />
      <GlossaryModal visible={glossary.visible} onClose={glossary.close} />

      {/* Header */}
      <View className="p-3 border-b border-primary/40 flex-row justify-between items-center">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-primary font-robotomono text-xs">{'<'} {t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-primary font-robotomono text-[10px]">{t('party.title')}</Text>
        <Text className="text-primary/50 font-robotomono text-[9px]">
          {roster.length}/4 {t('party.slots')}
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
                  {t(`party.class_${CLASSES[char.charClass]}`)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView className="flex-1 px-3 pt-4" showsVerticalScrollIndicator={false}>

        {/* ── Character Summary Banner ── */}
        <View className="mb-5 border border-primary/30 rounded-md bg-primary/5 px-4 py-3 flex-row items-center justify-between">
          <View>
            <Text className="text-primary font-robotomono text-base font-bold">{current.name}</Text>
            <Text className="text-primary/50 font-robotomono text-xs mt-1">
              {t(`party.race_${raceKey}`)} · {t(`party.class_${classKey}`)} · {t(`party.align_${alignKey}`)}
            </Text>
          </View>
          <View className="items-center border border-primary/20 rounded px-2 py-1">
            <Text className="text-primary/30 font-robotomono text-[8px]">{t('party.portrait')}</Text>
          </View>
        </View>

        {/* ── 1. Race ── */}
        <SectionCard borderColor="border-primary/40">
          <SectionHeader icon="🧬" label={t('party.raceSelect')} color="text-primary" />
          <SectionHint text={t('party.raceDesc')} />
          <View className="flex-row flex-wrap">
            {RACES.map((r, i) => {
              const rk = r.replace('-', '_');
              const selected = current.race === i;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => updateCurrent({ race: i })}
                  className={`mr-2 mb-2 px-4 py-2 border rounded-sm ${
                    selected
                      ? 'bg-primary border-primary'
                      : 'border-primary/30 bg-muted/20'
                  }`}
                >
                  <Text
                    className={`text-xs font-robotomono font-bold ${
                      selected ? 'text-background' : 'text-primary/70'
                    }`}
                  >
                    {t(`party.race_${rk}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <DescriptionBox
            text={t(`glossary.races.${RACES[current.race]}.desc`)}
            borderColor="border-primary/50"
            textColor="text-primary/70"
          />
        </SectionCard>

        {/* ── 2. Class ── */}
        <SectionCard borderColor="border-secondary/40">
          <SectionHeader icon="⚔" label={t('party.classSelect')} color="text-secondary" />
          <SectionHint text={t('party.classDesc')} color="text-secondary/50" />
          <View className="flex-row flex-wrap">
            {CLASSES.map((c, i) => {
              const selected = current.charClass === i;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => updateCurrent({ charClass: i })}
                  className={`mr-2 mb-2 px-4 py-2 border rounded-sm ${
                    selected
                      ? 'bg-secondary border-secondary'
                      : 'border-secondary/30 bg-muted/20'
                  }`}
                >
                  <Text
                    className={`text-xs font-robotomono font-bold ${
                      selected ? 'text-background' : 'text-secondary/70'
                    }`}
                  >
                    {t(`party.class_${c}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <DescriptionBox
            text={t(`glossary.classes.${CLASSES[current.charClass]}.desc`)}
            borderColor="border-secondary/50"
            textColor="text-secondary/70"
          />
        </SectionCard>

        {/* ── 3. Background ── */}
        <SectionCard borderColor="border-accent/40">
          <SectionHeader icon="📜" label={t('party.background')} color="text-accent" />
          <SectionHint text={t('party.backgroundDesc')} color="text-accent/50" />
          <View className="flex-row flex-wrap">
            {BACKGROUNDS.map((b, i) => {
              const selected = current.background === i;
              return (
                <TouchableOpacity
                  key={b}
                  onPress={() => updateCurrent({ background: i })}
                  className={`mr-2 mb-2 px-4 py-2 border rounded-sm ${
                    selected
                      ? 'bg-accent border-accent'
                      : 'border-accent/30 bg-muted/20'
                  }`}
                >
                  <Text
                    className={`text-xs font-robotomono font-bold ${
                      selected ? 'text-background' : 'text-accent/70'
                    }`}
                  >
                    {t(`party.bg_${b}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <DescriptionBox
            text={t(`glossary.backgrounds.${BACKGROUNDS[current.background]}.desc`)}
            borderColor="border-accent/50"
            textColor="text-accent/70"
          />
        </SectionCard>

        {/* ── 4. Attributes ── */}
        <SectionCard borderColor="border-primary/40">
          <View className="flex-row justify-between items-center mb-1">
            <SectionHeader icon="🎲" label={t('party.abilityScores')} />
            <TouchableOpacity onPress={rerollStats} className="border border-primary/50 rounded-sm px-3 py-1 bg-primary/10">
              <Text className="text-primary font-robotomono text-xs">{t('party.reroll')}</Text>
            </TouchableOpacity>
          </View>
          <SectionHint text={t('party.abilityDesc')} />
          {STAT_KEYS.map(key => (
            <StatBar key={key} statKey={key} value={current.stats[key]} t={t} />
          ))}
        </SectionCard>

        {/* ── 5. Alignment ── */}
        <SectionCard borderColor="border-primary/40">
          <SectionHeader icon="⚖" label={t('party.alignment')} />
          <SectionHint text={t('party.alignmentDesc')} />
          <View className="flex-row flex-wrap justify-between">
            {ALIGNMENTS.map((a, i) => {
              const selected = current.alignment === i;
              return (
                <TouchableOpacity
                  key={a}
                  onPress={() => updateCurrent({ alignment: i })}
                  className={`w-[31%] mb-2 py-3 border rounded-sm items-center ${
                    selected
                      ? 'bg-primary/20 border-primary'
                      : 'border-primary/15 bg-muted/10'
                  }`}
                >
                  <Text
                    className={`text-xs font-robotomono ${
                      selected ? 'text-primary font-bold' : 'text-primary/40'
                    }`}
                  >
                    {t(`party.align_${a}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <DescriptionBox
            text={t(`glossary.alignments.${ALIGNMENTS[current.alignment]}.desc`)}
            borderColor="border-primary/50"
            textColor="text-primary/70"
          />
        </SectionCard>

        {/* ── 6. Traits Preview ── */}
        <SectionCard borderColor="border-primary/20">
          <SectionHeader icon="🏷" label={t('party.traitPreview')} />
          <View className="flex-row flex-wrap mt-2">
            <View className="flex-row items-center mr-6 mb-1">
              <Text className="text-secondary font-robotomono text-sm">
                ⚖ {t('party.moral')}: {[t('party.chaotic'), t('party.neutral'), t('party.honorable')][Math.min(2, Math.floor(current.alignment / 3))]}
              </Text>
            </View>
            <View className="flex-row items-center mb-1">
              <Text className="text-accent font-robotomono text-sm">
                🧠 {t('party.mental')}: {t('party.stable')}
              </Text>
            </View>
          </View>
        </SectionCard>

        <View className="h-24" />
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
            <Text className="text-primary font-robotomono text-[10px]">+ {t('party.addMember')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={removeCharacter}
            disabled={roster.length <= 1}
            className={`flex-1 ml-2 border border-destructive p-2 items-center ${
              roster.length <= 1 ? 'opacity-30' : 'bg-destructive/10'
            }`}
          >
            <Text className="text-destructive font-robotomono text-[10px]">- {t('party.removeMember')}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Village')}
          className="bg-primary p-3 items-center"
        >
          <Text className="text-background font-bold font-robotomono">{t('party.startExpedition')}</Text>
        </TouchableOpacity>
      </View>

      <GlossaryButton onPress={glossary.open} />
    </View>
  );
};
