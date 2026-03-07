import React, { useEffect, useState, useMemo, useCallback, memo, useRef, type ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  Modal,
  StatusBar,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  withSequence,
} from 'react-native-reanimated';
import { CRTOverlay } from '../components/CRTOverlay';
import { ConfirmModal } from '../components/ConfirmModal';
import { GlossaryButton } from '../components/GlossaryModal';
import { TutorialOverlay } from '../components/TutorialOverlay';
import { useI18n, type Lang } from '../i18n';
import { useTutorial, PARTY_TUTORIAL_STEPS } from '../hooks/useTutorial';
import {
  useRaces,
  useClasses,
  useBackgrounds,
  useAlignments,
  useSubclasses,
} from '../hooks/useResources';
import { getTranslatedField } from '../services/translationBridge';
import { CharacterActionsPanel } from '../components/CharacterActionsPanel';
import {
  DnaIcon,
  SwordIcon,
  TridentIcon,
  ScrollIcon,
  DiceIcon,
  StatsIcon,
  ScaleIcon,
  TagIcon,
  BrainIcon,
  LightningIcon,
  ChevronRightIcon,
} from '../components/Icons';
import type { ScreenProps } from '../navigation/types';
import {
  SUBCLASS_FEATURES,
  CLASS_LVL1_FEATURES,
  RACE_TRAITS,
  CLASS_HIT_DICE,
  calcLvl1HP,
  LVL1_RULES,
  type FeatureEntry,
} from '../constants/dnd5eLevel1';
import { useGameStore } from '../stores/gameStore';
import { generateCharacterPortrait } from '../services/geminiImageService';
import type { CharacterSave } from '../database/gameRepository';

// ─── Types ────────────────────────────────────────────────

type Stats = { STR: number; DEX: number; CON: number; INT: number; WIS: number; CHA: number };

type CharacterDraft = {
  name: string;
  race: string;
  charClass: string;
  subclass: string;
  background: string;
  alignment: string;
  baseStats: Stats;
  statMethod: 'standard' | 'rolled';
  featureChoices: Record<string, string | string[]>;
};

const STAT_KEYS: (keyof Stats)[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

// ─── D&D 5e Stat Generation ──────────────────────────────

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

const CLASS_STAT_PRIORITY: Record<string, (keyof Stats)[]> = {
  barbarian: ['STR', 'CON', 'DEX', 'WIS', 'CHA', 'INT'],
  bard:      ['CHA', 'DEX', 'CON', 'WIS', 'INT', 'STR'],
  cleric:    ['WIS', 'CON', 'STR', 'DEX', 'CHA', 'INT'],
  druid:     ['WIS', 'CON', 'DEX', 'INT', 'CHA', 'STR'],
  fighter:   ['STR', 'CON', 'DEX', 'WIS', 'CHA', 'INT'],
  monk:      ['DEX', 'WIS', 'CON', 'STR', 'CHA', 'INT'],
  paladin:   ['STR', 'CHA', 'CON', 'WIS', 'DEX', 'INT'],
  ranger:    ['DEX', 'WIS', 'CON', 'STR', 'INT', 'CHA'],
  rogue:     ['DEX', 'CON', 'WIS', 'CHA', 'INT', 'STR'],
  sorcerer:  ['CHA', 'CON', 'DEX', 'WIS', 'INT', 'STR'],
  warlock:   ['CHA', 'CON', 'DEX', 'WIS', 'INT', 'STR'],
  wizard:    ['INT', 'CON', 'DEX', 'WIS', 'CHA', 'STR'],
};

function assignStandardArray(classIndex: string): Stats {
  const priority = CLASS_STAT_PRIORITY[classIndex] || STAT_KEYS;
  const stats: Stats = { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 };
  priority.forEach((key, i) => { stats[key] = STANDARD_ARRAY[i]; });
  return stats;
}

/** Roll 4d6, drop lowest — standard D&D 5e method */
function roll4d6DropLowest(): number {
  const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  dice.sort((a, b) => a - b);
  return dice[1] + dice[2] + dice[3];
}

function generateRolledStats(): Stats {
  return {
    STR: roll4d6DropLowest(), DEX: roll4d6DropLowest(), CON: roll4d6DropLowest(),
    INT: roll4d6DropLowest(), WIS: roll4d6DropLowest(), CHA: roll4d6DropLowest(),
  };
}

/** Generate rolled stats within D&D 5e lvl1 balanced range (total 70-80) */
function generateValidRolledStats(): Stats {
  for (let i = 0; i < 100; i++) {
    const stats = generateRolledStats();
    const total = STAT_KEYS.reduce((sum, k) => sum + stats[k], 0);
    if (total >= LVL1_RULES.MIN_ROLL_TOTAL && total <= LVL1_RULES.MAX_ROLL_TOTAL) {
      return stats;
    }
  }
  return assignStandardArray('fighter');
}

function getRacialBonuses(raceRaw: Record<string, unknown>): Partial<Stats> {
  const bonuses: Partial<Stats> = {};
  const ab = raceRaw.ability_bonuses as
    | Array<{ ability_score: { index: string }; bonus: number }>
    | undefined;
  if (ab) {
    for (const b of ab) {
      const key = b.ability_score.index.toUpperCase() as keyof Stats;
      if (STAT_KEYS.includes(key)) bonuses[key] = b.bonus;
    }
  }
  return bonuses;
}

function computeFinalStats(base: Stats, racial: Partial<Stats>): Stats {
  const s = { ...base };
  for (const k of STAT_KEYS) s[k] = Math.min(20, s[k] + (racial[k] || 0));
  return s;
}

function getDescFromRaw(raw: Record<string, unknown>): string {
  const d = raw.desc;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.join(' ');
  return '';
}

/** Look up subclass features from local PHB data (instant, no network) */
function getSubclassFeatures(idx: string): FeatureEntry[] {
  return SUBCLASS_FEATURES[idx] || [];
}

// ─── Alignment Sort Order ─────────────────────────────────

const ALIGNMENT_ORDER = [
  'lawful-good', 'neutral-good', 'chaotic-good',
  'lawful-neutral', 'neutral', 'chaotic-neutral',
  'lawful-evil', 'neutral-evil', 'chaotic-evil',
];

// ─── Default Character ────────────────────────────────────

const INIT_CLASSES = ['fighter', 'rogue', 'wizard', 'cleric'];

// ─── Name Generator ──────────────────────────────────────

const RACE_NAMES: Record<string, string[]> = {
  human:       ['Aldric', 'Beric', 'Caden', 'Dorian', 'Edric', 'Freya', 'Gareth', 'Hilda', 'Iria', 'Jorah', 'Kira', 'Lorn'],
  elf:         ['Aelindra', 'Caladrel', 'Elendir', 'Faendal', 'Ilyana', 'Liriel', 'Naeris', 'Quellin', 'Sylara', 'Taeral'],
  dwarf:       ['Bofri', 'Durgin', 'Fargrim', 'Gimral', 'Harnoth', 'Ildrak', 'Korrak', 'Marduk', 'Norgrim', 'Tordak'],
  halfling:    ['Cade', 'Cordo', 'Eldon', 'Garret', 'Lindin', 'Merric', 'Osborn', 'Perrin', 'Rosie', 'Tobias'],
  'half-orc':  ['Dench', 'Feng', 'Gell', 'Henk', 'Imsh', 'Keth', 'Krusk', 'Mhurren', 'Ront', 'Thokk'],
  tiefling:    ['Akmenos', 'Amnon', 'Barakas', 'Damakos', 'Ekemon', 'Iados', 'Kairon', 'Leucis', 'Mordai', 'Skamos'],
  dragonborn:  ['Arjhan', 'Balasar', 'Bharash', 'Donaar', 'Ghesh', 'Heskan', 'Kriv', 'Medrash', 'Rhogar', 'Torinn'],
  gnome:       ['Alston', 'Alvyn', 'Boddynock', 'Brocc', 'Dimble', 'Eldon', 'Erky', 'Fonkin', 'Gerbo', 'Gimble'],
  'half-elf':  ['Aelith', 'Briana', 'Corvan', 'Dara', 'Elysia', 'Faramir', 'Gaerlan', 'Haelra', 'Ilris', 'Jaeron'],
};

function pickRaceName(raceIndex: string): string {
  const pool = RACE_NAMES[raceIndex] ?? RACE_NAMES.human;
  return pool[Math.floor(Math.random() * pool.length)];
}

function mkDefault(i: number): CharacterDraft {
  const cls = INIT_CLASSES[i % INIT_CLASSES.length];
  return {
    name: `UNIT_${String(i + 1).padStart(2, '0')}`,
    race: 'human',
    charClass: cls,
    subclass: '',
    background: 'acolyte',
    alignment: 'neutral',
    baseStats: assignStandardArray(cls),
    statMethod: 'standard',
    featureChoices: {},
  };
}

// ─── Stable Styles (avoid inline object re-creation) ─────

const S = StyleSheet.create({
  bonusText: { color: 'rgba(0,229,255,0.9)' },
  subFlavor: { color: 'rgba(255,176,0,0.5)' },
  subDesc: { color: 'rgba(255,176,0,0.7)' },
  featureName: { color: 'rgba(255,176,0,0.8)' },
  slotsCount: { color: 'rgba(0,255,65,0.5)' },
  bannerInput: {
    color: '#00FF41', fontFamily: 'RobotoMono-Bold', fontSize: 16,
    fontWeight: 'bold', padding: 0, margin: 0,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,65,0.3)', paddingBottom: 2,
  },
  bannerSub: { color: 'rgba(0,255,65,0.5)' },
  portraitLabel: { color: 'rgba(0,255,65,0.3)' },
  portraitGenBtn: { color: 'rgba(0,255,65,0.6)' },
  portraitBox: {
    width: 72,
    height: 72,
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.3)',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,255,65,0.04)',
    overflow: 'hidden',
  },
  portraitImage: {
    width: 72,
    height: 72,
  },
  statTotal: { color: 'rgba(0,255,65,0.5)' },
  statTotalRacial: { color: 'rgba(0,229,255,0.7)' },
  summaryLabel: { color: 'rgba(0,229,255,0.5)' },
  classFeatureBullet: { color: 'rgba(255,176,0,0.6)' },
  raceTraitBullet: { color: 'rgba(0,255,65,0.5)' },
  raceTraitText: { color: 'rgba(0,255,65,0.7)' },
});

// ─── Animated Stat Bar ────────────────────────────────────

const AnimatedStatBar = memo(({
  statKey, base, bonus, index, lang,
}: {
  statKey: keyof Stats; base: number; bonus: number; index: number; lang: Lang;
}) => {
  const final = Math.min(20, base + bonus);
  const mod = Math.floor((final - 10) / 2);
  const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
  const pct = Math.min(((final - 3) / 17) * 100, 100);
  const label = getTranslatedField('ability-scores', statKey.toLowerCase(), 'name', lang) || statKey;

  const barWidth = useSharedValue(0);
  const barGlow = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withDelay(
      index * 80,
      withTiming(pct, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    barGlow.value = withDelay(
      index * 80,
      withSequence(
        withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 400, easing: Easing.in(Easing.quad) }),
      ),
    );
  }, [final]);

  const barStyle = useAnimatedStyle(() => ({ width: `${barWidth.value}%` }));
  const glowStyle = useAnimatedStyle(() => ({
    shadowColor: '#00FF41',
    shadowOpacity: barGlow.value * 0.8,
    shadowRadius: 6,
    elevation: barGlow.value > 0 ? 4 : 0,
  }));

  return (
    <View className="flex-row items-center mb-2">
      <Text className="text-primary font-robotomono text-xs w-10 font-bold">{label}</Text>
      <View className="flex-1 h-4 bg-muted/40 border border-primary/30 mx-2 rounded-sm overflow-hidden">
        <Animated.View className="h-full bg-primary/50 rounded-sm" style={[barStyle, glowStyle]} />
      </View>
      <Text className="text-primary font-robotomono text-sm w-7 text-right font-bold">{final}</Text>
      {bonus > 0 && (
        <Text
          style={S.bonusText}
          className="font-robotomono text-[9px] w-6 text-right"
        >
          +{bonus}
        </Text>
      )}
      <Text className="text-secondary font-robotomono text-xs w-7 text-right">{modStr}</Text>
    </View>
  );
});

// ─── UI Helpers (memoized) ────────────────────────────────

const SectionCard = memo(({ children, borderColor = 'border-primary/30' }: { children: React.ReactNode; borderColor?: string }) => (
  <View className={`mb-5 border ${borderColor} rounded-md bg-muted/10 p-4`}>{children}</View>
));

const SectionHeader = memo(({ icon, label, color = 'text-primary' }: { icon: ReactNode; label: string; color?: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
    {icon}
    <Text className={`${color} font-robotomono text-sm font-bold`} style={{ marginLeft: 6 }}>{label}</Text>
  </View>
));

const SectionHint = memo(({ text, color = 'text-primary/50' }: { text: string; color?: string }) => (
  <Text className={`${color} font-robotomono text-xs mb-3`}>{text}</Text>
));

const DescriptionBox = memo(({ text, borderColor = 'border-primary/40', textColor = 'text-primary/70' }: { text: string; borderColor?: string; textColor?: string }) => (
  <View className={`mt-3 border-l-2 ${borderColor} pl-3 py-2 bg-background/60 rounded-r-sm`}>
    <Text className={`${textColor} font-robotomono text-[11px] leading-4`}>{text}</Text>
  </View>
));

// ─── Subclass Abilities Panel (sync, no network) ─────────

const SubclassAbilitiesPanel = memo(({
  subclassIndex, raw, lang,
}: {
  subclassIndex: string; raw: Record<string, unknown>; lang: Lang;
}) => {
  const features = useMemo(() => getSubclassFeatures(subclassIndex), [subclassIndex]);

  const desc = getTranslatedField('subclasses', subclassIndex, 'desc', lang) || getDescFromRaw(raw);
  const flavor = raw.subclass_flavor as string || '';

  return (
    <View className="mt-3 border border-secondary/20 rounded-sm bg-muted/5 p-3">
      {flavor ? (
        <Text style={S.subFlavor} className="font-robotomono text-[9px] mb-1 uppercase">
          {flavor}
        </Text>
      ) : null}
      <Text style={S.subDesc} className="font-robotomono text-[10px] leading-4 mb-2">
        {desc}
      </Text>
      {features.length > 0 ? (
        <View className="border-t border-secondary/20 pt-2 mt-1">
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <LightningIcon size={9} color="rgba(255,176,0,0.9)" />
            <Text className="text-secondary font-robotomono text-[9px] font-bold" style={{ marginLeft: 4 }}>
              {lang === 'es' ? 'HABILIDADES DESBLOQUEADAS:' : 'UNLOCKED FEATURES:'}
            </Text>
          </View>
          {features.map(f => (
            <View key={`${f.en}-${f.level}`} className="flex-row items-center mb-1">
              <Text className="text-accent font-robotomono text-[8px] w-10">Lv.{f.level}</Text>
              <Text
                style={S.featureName}
                className="font-robotomono text-[9px] flex-1"
              >
                {f[lang]}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

// ─── Main Screen ──────────────────────────────────────────

export const PartyScreen = ({ navigation, route }: ScreenProps<'Party'>) => {
  const { t, lang } = useI18n();
  const { seed, seedHash } = route.params;
  const startNewGame = useGameStore(s => s.startNewGame);
  const updateProgress = useGameStore(s => s.updateProgress);
  const saveCharacterPortraits = useGameStore(s => s.saveCharacterPortraits);

  // DB-driven data hooks
  const { data: races, loading: racesLoading } = useRaces();
  const { data: classes, loading: classesLoading } = useClasses();
  const { data: backgrounds, loading: bgLoading } = useBackgrounds();
  const { data: alignments, loading: alignLoading } = useAlignments();
  const { data: allSubclasses, loading: subLoading } = useSubclasses();

  const tutorial = useTutorial(PARTY_TUTORIAL_STEPS);

  const [roster, setRoster] = useState<CharacterDraft[]>([mkDefault(0)]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [charPortraits, setCharPortraits] = useState<Record<number, string>>({});
  const [charPortraitRolls, setCharPortraitRolls] = useState<Record<number, number>>({});
  const [generatingPortraitFor, setGeneratingPortraitFor] = useState<number | null>(null);
  const [portraitError, setPortraitError] = useState<string | null>(null);
  const [portraitDetailUri, setPortraitDetailUri] = useState<string | null>(null);
  const [portraitExpanded, setPortraitExpanded] = useState(true);
  const [startingGame, setStartingGame] = useState(false);
  const [portraitConfirmVisible, setPortraitConfirmVisible] = useState(false);
  const [portraitMissingCount, setPortraitMissingCount] = useState(0);
  const pendingLaunch = useRef<(() => void) | null>(null);

  const current = roster[activeSlot];
  const loading = racesLoading || classesLoading || bgLoading || alignLoading || subLoading;

  // ── Helpers ──

  const updateCurrent = useCallback((updates: Partial<CharacterDraft>) => {
    setRoster(prev => prev.map((c, i) => (i === activeSlot ? { ...c, ...updates } : c)));
  }, [activeSlot]);

  const subsByClass = useMemo(() => {
    const map = new Map<string, typeof allSubclasses>();
    for (const s of allSubclasses) {
      const cls = (s.raw as { class?: { index?: string } }).class?.index;
      if (cls) {
        const arr = map.get(cls) || [];
        if (arr.length < 2) arr.push(s);
        map.set(cls, arr);
      }
    }
    return map;
  }, [allSubclasses]);

  const subsForClass = useCallback(
    (classIndex: string) => subsByClass.get(classIndex) || [],
    [subsByClass],
  );

  // Auto-select first subclass when data loads
  useEffect(() => {
    if (!current.subclass && allSubclasses.length > 0) {
      const subs = subsForClass(current.charClass);
      if (subs.length > 0) updateCurrent({ subclass: subs[0].index });
    }
  }, [allSubclasses, current.charClass, current.subclass, subsForClass, updateCurrent]);

  const onClassChange = useCallback((classIndex: string) => {
    const subs = subsByClass.get(classIndex) || [];
    setRoster(prev => prev.map((c, i) => {
      if (i !== activeSlot) return c;
      // Clear class/subclass-related choices, keep race choices
      const kept: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(c.featureChoices)) {
        if (k.startsWith('dragonborn-') || k.startsWith('half-elf-')) kept[k] = v;
      }
      return {
        ...c,
        charClass: classIndex,
        subclass: subs[0]?.index || '',
        baseStats: c.statMethod === 'standard' ? assignStandardArray(classIndex) : c.baseStats,
        featureChoices: kept,
      };
    }));
  }, [activeSlot, subsByClass]);

  const generateRandomName = useCallback(() => {
    updateCurrent({ name: pickRaceName(current.race) });
  }, [current.race, updateCurrent]);

  // ── Computed values ──

  const racialBonuses = useMemo(() => {
    const race = races.find(r => r.index === current.race);
    return race ? getRacialBonuses(race.raw as Record<string, unknown>) : {};
  }, [current.race, races]);

  const finalStats = useMemo(
    () => computeFinalStats(current.baseStats, racialBonuses),
    [current.baseStats, racialBonuses],
  );

  const totalBase = useMemo(
    () => STAT_KEYS.reduce((sum, k) => sum + current.baseStats[k], 0),
    [current.baseStats],
  );

  const totalFinal = useMemo(
    () => STAT_KEYS.reduce((sum, k) => sum + finalStats[k], 0),
    [finalStats],
  );

  const sortedAlignments = useMemo(() => {
    return [...alignments].sort((a, b) => {
      const ai = ALIGNMENT_ORDER.indexOf(a.index);
      const bi = ALIGNMENT_ORDER.indexOf(b.index);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });
  }, [alignments]);

  // ── Actions ──

  const addCharacter = () => {
    if (roster.length >= 4) return;
    setRoster(prev => [...prev, mkDefault(prev.length)]);
    setActiveSlot(roster.length);
  };

  const removeCharacter = () => {
    if (roster.length <= 1) return;
    setRoster(prev => prev.filter((_, i) => i !== activeSlot));
    setActiveSlot(a => Math.max(0, a - 1));
  };

  const buildPartySaves = useCallback((): CharacterSave[] => {
    return roster.map((c, i) => {
      const race = races.find(r => r.index === c.race);
      const rb = race ? getRacialBonuses(race.raw as Record<string, unknown>) : {};
      const fs = computeFinalStats(c.baseStats, rb);
      const hp = calcLvl1HP(c.charClass, fs.CON);
      return {
        name: c.name,
        race: c.race,
        charClass: c.charClass,
        subclass: c.subclass,
        background: c.background,
        alignment: c.alignment,
        baseStats: c.baseStats,
        statMethod: c.statMethod,
        featureChoices: c.featureChoices,
        hp,
        maxHp: hp,
        alive: true,
        portrait: charPortraits[i],
      };
    });
  }, [roster, races, charPortraits]);

  const rerollStats = () => updateCurrent({ baseStats: generateValidRolledStats(), statMethod: 'rolled' });
  const useStdArray = () => updateCurrent({ baseStats: assignStandardArray(current.charClass), statMethod: 'standard' });

  const MAX_PORTRAIT_ROLLS = 2;

  const handleGeneratePortrait = useCallback(async () => {
    if (generatingPortraitFor !== null) return;
    const rolls = charPortraitRolls[activeSlot] ?? 0;
    if (rolls >= MAX_PORTRAIT_ROLLS) return;
    setGeneratingPortraitFor(activeSlot);
    setPortraitError(null);
    try {
      const char = buildPartySaves()[activeSlot];
      const uri = await generateCharacterPortrait(char);
      setCharPortraits(prev => ({ ...prev, [activeSlot]: uri }));
      setCharPortraitRolls(prev => ({ ...prev, [activeSlot]: (prev[activeSlot] ?? 0) + 1 }));
      // Persist portrait immediately to DB so it survives navigation
      saveCharacterPortraits({ [String(activeSlot)]: uri });
    } catch (err) {
      console.error('[Portrait] generation error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setPortraitError(msg.length > 38 ? msg.substring(0, 38) + '...' : msg);
    } finally {
      setGeneratingPortraitFor(null);
    }
  }, [generatingPortraitFor, activeSlot, buildPartySaves, charPortraitRolls, saveCharacterPortraits]);

  // ── Current selections ──

  const currentRace = races.find(r => r.index === current.race);
  const currentClass = classes.find(c => c.index === current.charClass);
  const currentBg = backgrounds.find(b => b.index === current.background);
  const currentAlign = sortedAlignments.find(a => a.index === current.alignment);
  const currentSubs = subsForClass(current.charClass);
  const currentSubData = allSubclasses.find(s => s.index === current.subclass);

  const bgDescription = useMemo(() => {
    if (!currentBg) return '';
    const bgRaw = currentBg.raw as Record<string, unknown>;
    const feature = bgRaw.feature as { name?: string; desc?: string[] } | undefined;
    return getTranslatedField('backgrounds', current.background, 'desc', lang)
      || feature?.desc?.join(' ')
      || '';
  }, [currentBg, current.background, lang]);

  // ── Loading State ──

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#00FF41" />
        <Text className="text-primary font-robotomono text-xs mt-4">
          {lang === 'es' ? 'CARGANDO DATOS...' : 'LOADING DATA...'}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <GlossaryButton />
      <CRTOverlay />
      <ConfirmModal
        visible={portraitConfirmVisible}
        title={lang === 'es' ? 'Retratos pendientes' : 'Pending Portraits'}
        message={
          lang === 'es'
            ? `${portraitMissingCount} personaje${portraitMissingCount !== 1 ? 's' : ''} no tiene${portraitMissingCount !== 1 ? 'n' : ''} retrato generado. Al iniciar la expedición se generarán automáticamente — se usará el primer resultado obtenido. ¿Deseas continuar?`
            : `${portraitMissingCount} character${portraitMissingCount !== 1 ? 's' : ''} ${portraitMissingCount !== 1 ? "don't" : "doesn't"} have a portrait yet. They will be auto-generated when the expedition starts — the first result will be used automatically. Continue?`
        }
        confirmLabel={lang === 'es' ? 'Continuar' : 'Continue'}
        cancelLabel={lang === 'es' ? 'Cancelar' : 'Cancel'}
        onConfirm={() => {
          setPortraitConfirmVisible(false);
          pendingLaunch.current?.();
        }}
        onCancel={() => setPortraitConfirmVisible(false)}
      />
      <TutorialOverlay
        visible={tutorial.visible}
        steps={tutorial.steps}
        currentStep={tutorial.currentStep}
        onNext={tutorial.next}
        onPrev={tutorial.prev}
        onSkip={tutorial.close}
        onClose={tutorial.close}
      />

      {/* Header */}
      <View className="p-3 border-b border-primary/40 flex-row justify-between items-center">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-primary font-robotomono text-xs">{'<'} {t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-primary font-robotomono text-[10px]">{t('party.title')}</Text>
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={tutorial.start}
            className="mr-3 border border-primary/40 rounded px-2 py-1"
          >
            <Text className="text-primary font-robotomono text-[10px] font-bold">{t('tutorial.button')}</Text>
          </TouchableOpacity>
          <Text style={S.slotsCount} className="font-robotomono text-[9px]">
            {roster.length}/4 {t('party.slots')}
          </Text>
        </View>
      </View>

      {/* Roster Tabs */}
      <View className="flex-row border-b border-primary/20">
        {[0, 1, 2, 3].map(i => {
          const char = roster[i];
          const isActive = activeSlot === i;
          const cls = char ? classes.find(c => c.index === char.charClass) : null;
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
              {char && cls && (
                <Text className="text-secondary font-robotomono text-[7px]">{cls.name}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView className="flex-1 px-3 pt-4" showsVerticalScrollIndicator={false}>

        {/* ── Character Summary Banner ── */}
        <View className="mb-5 border border-primary/30 rounded-md bg-primary/5 px-4 py-3">
          {/* Name row with random name button */}
          <View className="flex-row items-center mb-1">
            <TextInput
              value={current.name}
              onChangeText={text => updateCurrent({ name: text })}
              maxLength={16}
              style={[S.bannerInput, { flex: 1 }]}
              placeholderTextColor="rgba(0,255,65,0.3)"
              placeholder={t('party.namePlaceholder')}
              selectionColor="#00FF41"
            />
            <TouchableOpacity
              onPress={generateRandomName}
              style={{ marginLeft: 8, borderWidth: 1, borderColor: 'rgba(0,255,65,0.3)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 }}
            >
              <Text style={{ color: 'rgba(0,255,65,0.7)', fontFamily: 'RobotoMono-Regular', fontSize: 11 }}>
                {lang === 'es' ? '🎲 NOMBRE' : '🎲 NAME'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={S.bannerSub} className="font-robotomono text-xs mb-3">
            {currentRace?.name || current.race} · {currentClass?.name || current.charClass}
            {currentSubData ? ` · ${currentSubData.name}` : ''}
          </Text>

          {/* Portrait section — collapsible toggle */}
          <TouchableOpacity
            onPress={() => setPortraitExpanded(v => !v)}
            activeOpacity={0.7}
            className="flex-row items-center justify-between mb-2"
          >
            <Text style={{ color: 'rgba(0,255,65,0.45)', fontFamily: 'RobotoMono-Regular', fontSize: 9, letterSpacing: 1 }}>
              {lang === 'es' ? '— RETRATO —' : '— PORTRAIT —'}
            </Text>
            <Text style={{ color: 'rgba(0,255,65,0.45)', fontFamily: 'RobotoMono-Regular', fontSize: 11 }}>
              {portraitExpanded ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {/* Portrait row */}
          {portraitExpanded && (
          <View className="flex-row items-center">
            {/* Portrait thumbnail — tap to zoom when portrait exists */}
            <TouchableOpacity
              onPress={() => charPortraits[activeSlot] && setPortraitDetailUri(charPortraits[activeSlot])}
              disabled={!charPortraits[activeSlot]}
              style={S.portraitBox}
            >
              {charPortraits[activeSlot] ? (
                <Image
                  source={{ uri: charPortraits[activeSlot] }}
                  style={S.portraitImage}
                  resizeMode="cover"
                />
              ) : generatingPortraitFor === activeSlot ? (
                <ActivityIndicator size="small" color="#00FF41" />
              ) : (
                <Text style={S.portraitLabel} className="font-robotomono text-[7px] text-center">
                  {t('party.portrait')}
                </Text>
              )}
            </TouchableOpacity>

            {/* Portrait action buttons */}
            <View className="flex-1 ml-3">
              {!charPortraits[activeSlot] ? (
                <TouchableOpacity
                  onPress={handleGeneratePortrait}
                  disabled={generatingPortraitFor !== null}
                  style={{
                    borderWidth: 1,
                    borderColor: 'rgba(0,255,65,0.4)',
                    borderRadius: 4,
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                    backgroundColor: 'rgba(0,255,65,0.06)',
                    opacity: generatingPortraitFor !== null ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: 'rgba(0,255,65,0.9)', fontFamily: 'RobotoMono-Bold', fontSize: 11, textAlign: 'center' }}>
                    {generatingPortraitFor === activeSlot
                      ? (lang === 'es' ? '⏳ GENERANDO...' : '⏳ GENERATING...')
                      : (lang === 'es' ? '⚡ GENERAR RETRATO' : '⚡ GENERATE PORTRAIT')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View>
                  <TouchableOpacity
                    onPress={() => setPortraitDetailUri(charPortraits[activeSlot])}
                    style={{ borderWidth: 1, borderColor: 'rgba(0,229,255,0.4)', borderRadius: 4, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: 'rgba(0,229,255,0.06)', marginBottom: 6 }}
                  >
                    <Text style={{ color: 'rgba(0,229,255,0.9)', fontFamily: 'RobotoMono-Bold', fontSize: 11, textAlign: 'center' }}>
                      {lang === 'es' ? '🔍 VER RETRATO' : '🔍 VIEW PORTRAIT'}
                    </Text>
                  </TouchableOpacity>
                  {(charPortraitRolls[activeSlot] ?? 0) < MAX_PORTRAIT_ROLLS ? (
                    <TouchableOpacity
                      onPress={handleGeneratePortrait}
                      disabled={generatingPortraitFor !== null}
                      style={{ borderWidth: 1, borderColor: 'rgba(255,176,0,0.4)', borderRadius: 4, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: 'rgba(255,176,0,0.06)', opacity: generatingPortraitFor !== null ? 0.5 : 1 }}
                    >
                      <Text style={{ color: 'rgba(255,176,0,0.9)', fontFamily: 'RobotoMono-Bold', fontSize: 11, textAlign: 'center' }}>
                        {generatingPortraitFor === activeSlot
                          ? (lang === 'es' ? '⏳ GENERANDO...' : '⏳ GENERATING...')
                          : `↻ ${lang === 'es' ? 'REGENERAR' : 'REGENERATE'} (${MAX_PORTRAIT_ROLLS - (charPortraitRolls[activeSlot] ?? 0)}/${MAX_PORTRAIT_ROLLS})`}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={{ color: 'rgba(0,255,65,0.35)', fontFamily: 'RobotoMono-Regular', fontSize: 9, textAlign: 'center', marginTop: 2 }}>
                      {lang === 'es' ? `MÁXIMO ALCANZADO (${MAX_PORTRAIT_ROLLS}/${MAX_PORTRAIT_ROLLS})` : `MAX ROLLS (${MAX_PORTRAIT_ROLLS}/${MAX_PORTRAIT_ROLLS})`}
                    </Text>
                  )}
                </View>
              )}
              {portraitError && (
                <Text style={{ color: 'rgba(255,62,62,0.75)', fontFamily: 'RobotoMono-Regular', fontSize: 8, marginTop: 4 }}>
                  ⚠ {portraitError}
                </Text>
              )}
            </View>
          </View>
          )}
        </View>

        {/* ── 1. Race ── */}
        <SectionCard borderColor="border-primary/40">
          <SectionHeader icon={<DnaIcon size={14} color="rgba(0,255,65,0.9)" />} label={t('party.raceSelect')} />
          <SectionHint text={t('party.raceDesc')} />
          <View className="flex-row flex-wrap">
            {races.map(r => {
              const selected = current.race === r.index;
              return (
                <TouchableOpacity
                  key={r.index}
                  onPress={() => {
                    // Clear race-related choices, keep class choices
                    const kept: Record<string, string | string[]> = {};
                    for (const [k, v] of Object.entries(current.featureChoices)) {
                      if (!k.startsWith('dragonborn-') && !k.startsWith('half-elf-')) kept[k] = v;
                    }
                    updateCurrent({ race: r.index, featureChoices: kept });
                  }}
                  className={`mr-2 mb-2 px-4 py-2 border rounded-sm ${
                    selected ? 'bg-primary border-primary' : 'border-primary bg-muted'
                  }`}
                >
                  <Text className={`text-xs font-robotomono font-bold ${
                    selected ? 'text-background' : 'text-primary'
                  }`}>
                    {r.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {currentRace && (
            <DescriptionBox
              text={
                getTranslatedField('races', current.race, 'desc', lang) ||
                getDescFromRaw(currentRace.raw as Record<string, unknown>)
              }
              borderColor="border-primary"
              textColor="text-primary"
            />
          )}
          {/* Racial ability bonuses */}
          {Object.keys(racialBonuses).length > 0 && (
            <View className="mt-2 flex-row flex-wrap">
              {Object.entries(racialBonuses).map(([key, val]) => (
                <View key={key} className="mr-2 mb-1 border border-accent/30 rounded px-2 py-1 bg-accent/5">
                  <Text className="text-accent font-robotomono text-[9px] font-bold">
                    {getTranslatedField('ability-scores', key.toLowerCase(), 'name', lang) || key} +{val}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </SectionCard>

        {/* ── 2. Class ── */}
        <SectionCard borderColor="border-secondary/40">
          <SectionHeader icon={<SwordIcon size={14} color="rgba(255,176,0,0.9)" />} label={t('party.classSelect')} color="text-secondary" />
          <SectionHint text={t('party.classDesc')} color="text-secondary/50" />
          <View className="flex-row flex-wrap">
            {classes.map(c => {
              const selected = current.charClass === c.index;
              return (
                <TouchableOpacity
                  key={c.index}
                  onPress={() => onClassChange(c.index)}
                  className={`mr-2 mb-2 px-4 py-2 border rounded-sm ${
                    selected ? 'bg-secondary border-secondary' : 'border-secondary bg-muted'
                  }`}
                >
                  <Text className={`text-xs font-robotomono font-bold ${
                    selected ? 'text-background' : 'text-secondary'
                  }`}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {currentClass && (
            <DescriptionBox
              text={
                getTranslatedField('classes', current.charClass, 'desc', lang) ||
                getDescFromRaw(currentClass.raw as Record<string, unknown>)
              }
              borderColor="border-secondary"
              textColor="text-secondary"
            />
          )}
        </SectionCard>

        {/* ── 3. Subclass ── */}
        {currentSubs.length > 0 && (
          <SectionCard borderColor="border-secondary/40">
            <SectionHeader
              icon={<TridentIcon size={14} color="rgba(255,176,0,0.9)" />}
              label={lang === 'es' ? 'SUBCLASE' : 'SUBCLASS'}
              color="text-secondary"
            />
            <SectionHint
              text={lang === 'es'
                ? 'Elige tu especialización (máx. 2 por clase)'
                : 'Choose your specialization (max 2 per class)'}
              color="text-secondary/50"
            />
            <View className="flex-row flex-wrap">
              {currentSubs.map(s => {
                const selected = current.subclass === s.index;
                return (
                  <TouchableOpacity
                    key={s.index}
                    onPress={() => updateCurrent({ subclass: s.index })}
                    className={`mr-2 mb-2 px-4 py-2 border rounded-sm ${
                      selected ? 'bg-secondary border-secondary' : 'border-secondary bg-muted'
                    }`}
                  >
                    <Text className={`text-xs font-robotomono font-bold ${
                      selected ? 'text-background' : 'text-secondary'
                    }`}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {currentSubData && (
              <SubclassAbilitiesPanel
                subclassIndex={current.subclass}
                raw={currentSubData.raw as Record<string, unknown>}
                lang={lang}
              />
            )}
          </SectionCard>
        )}

        {/* ── 4. Background ── */}
        <SectionCard borderColor="border-accent/40">
          <SectionHeader icon={<ScrollIcon size={14} color="rgba(0,229,255,0.9)" />} label={t('party.background')} color="text-accent" />
          <SectionHint text={t('party.backgroundDesc')} color="text-accent/50" />
          <View className="flex-row flex-wrap">
            {backgrounds.map(b => {
              const selected = current.background === b.index;
              return (
                <TouchableOpacity
                  key={b.index}
                  onPress={() => updateCurrent({ background: b.index })}
                  className={`mr-2 mb-2 px-4 py-2 border rounded-sm ${
                    selected ? 'bg-accent border-accent' : 'border-accent bg-muted'
                  }`}
                >
                  <Text className={`text-xs font-robotomono font-bold ${
                    selected ? 'text-background' : 'text-accent'
                  }`}>
                    {b.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {bgDescription ? (
            <DescriptionBox
              text={bgDescription}
              borderColor="border-accent"
              textColor="text-accent"
            />
          ) : null}
        </SectionCard>

        {/* ── 5. Attributes ── */}
        <SectionCard borderColor="border-primary/40">
          <View className="flex-row justify-between items-center mb-1">
            <SectionHeader icon={<DiceIcon size={14} color="rgba(0,255,65,0.9)" />} label={t('party.abilityScores')} />
            <View className="flex-row">
              <TouchableOpacity
                onPress={useStdArray}
                className={`mr-2 border rounded-sm px-2 py-1 ${
                  current.statMethod === 'standard'
                    ? 'bg-primary border-primary'
                    : 'border-primary bg-muted'
                }`}
              >
                <Text className={`font-robotomono text-[8px] ${
                  current.statMethod === 'standard' ? 'text-background font-bold' : 'text-primary'
                }`}>
                  {lang === 'es' ? 'ESTÁNDAR' : 'STANDARD'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={rerollStats}
                className={`border rounded-sm px-2 py-1 ${
                  current.statMethod === 'rolled'
                    ? 'bg-primary border-primary'
                    : 'border-primary bg-muted'
                }`}
              >
                <Text className={`font-robotomono text-[8px] ${
                  current.statMethod === 'rolled' ? 'text-background font-bold' : 'text-primary'
                }`}>
                  4d6
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <SectionHint
            text={
              current.statMethod === 'standard'
                ? (lang === 'es'
                  ? 'Array estándar [15,14,13,12,10,8] asignado por clase'
                  : 'Standard array [15,14,13,12,10,8] assigned by class')
                : (lang === 'es'
                  ? '4d6 descarta menor — rango balanceado (total 70-80)'
                  : '4d6 drop lowest — balanced range (total 70-80)')
            }
          />
          {STAT_KEYS.map((key, i) => (
            <AnimatedStatBar
              key={key}
              statKey={key}
              base={current.baseStats[key]}
              bonus={racialBonuses[key] || 0}
              index={i}
              lang={lang}
            />
          ))}
          <View className="flex-row justify-between mt-2 border-t border-primary/20 pt-2">
            <Text style={S.statTotal} className="font-robotomono text-[9px]">
              BASE: {totalBase}
            </Text>
            <Text style={S.statTotalRacial} className="font-robotomono text-[9px]">
              TOTAL + RACIAL: {totalFinal}
            </Text>
          </View>
        </SectionCard>

        {/* ── 6. Level 1 Summary ── */}
        <SectionCard borderColor="border-accent/40">
          <SectionHeader
            icon={<StatsIcon size={14} color="rgba(0,229,255,0.9)" />}
            label={lang === 'es' ? 'RESUMEN NIVEL 1' : 'LEVEL 1 SUMMARY'}
            color="text-accent"
          />
          <View className="flex-row flex-wrap mt-2 mb-3">
            <View className="mr-4 mb-2 border border-accent/30 rounded px-3 py-2 bg-accent/5 items-center">
              <Text style={S.summaryLabel} className="font-robotomono text-[7px] uppercase">
                {lang === 'es' ? 'NIVEL' : 'LEVEL'}
              </Text>
              <Text className="text-accent font-robotomono text-lg font-bold">1</Text>
            </View>
            <View className="mr-4 mb-2 border border-accent/30 rounded px-3 py-2 bg-accent/5 items-center">
              <Text style={S.summaryLabel} className="font-robotomono text-[7px] uppercase">HP</Text>
              <Text className="text-accent font-robotomono text-lg font-bold">
                {calcLvl1HP(current.charClass, finalStats.CON)}
              </Text>
            </View>
            <View className="mr-4 mb-2 border border-accent/30 rounded px-3 py-2 bg-accent/5 items-center">
              <Text style={S.summaryLabel} className="font-robotomono text-[7px] uppercase">
                {lang === 'es' ? 'COMPETENCIA' : 'PROFICIENCY'}
              </Text>
              <Text className="text-accent font-robotomono text-lg font-bold">+{LVL1_RULES.PROFICIENCY_BONUS}</Text>
            </View>
            <View className="mb-2 border border-accent/30 rounded px-3 py-2 bg-accent/5 items-center">
              <Text style={S.summaryLabel} className="font-robotomono text-[7px] uppercase">
                {lang === 'es' ? 'DADO GOLPE' : 'HIT DIE'}
              </Text>
              <Text className="text-accent font-robotomono text-lg font-bold">
                d{CLASS_HIT_DICE[current.charClass] || 8}
              </Text>
            </View>
          </View>

          {/* Class Features */}
          {CLASS_LVL1_FEATURES[current.charClass] && (
            <View className="mb-3">
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <SwordIcon size={9} color="rgba(255,176,0,0.9)" />
                <Text className="text-secondary font-robotomono text-[9px] font-bold mb-1" style={{ marginLeft: 4 }}>
                  {lang === 'es' ? 'HABILIDADES DE CLASE (Nv.1):' : 'CLASS FEATURES (Lv.1):'}
                </Text>
              </View>
              {CLASS_LVL1_FEATURES[current.charClass].map((f, i) => (
                <View key={i} className="flex-row items-center mb-1 ml-2">
                <View style={{ marginRight: 4 }}><ChevronRightIcon size={8} color="rgba(255,176,0,0.6)" /></View>
                  <Text style={S.featureName} className="font-robotomono text-[9px]">
                    {lang === 'es' ? f.es : f.en}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Race Traits */}
          {RACE_TRAITS[current.race] && (
            <View className="mb-1">
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <DnaIcon size={9} color="rgba(0,255,65,0.9)" />
                <Text className="text-primary font-robotomono text-[9px] font-bold mb-1" style={{ marginLeft: 4 }}>
                  {lang === 'es' ? 'RASGOS RACIALES:' : 'RACE TRAITS:'}
                </Text>
              </View>
              {RACE_TRAITS[current.race].map((t2, i) => (
                <View key={i} className="flex-row items-center mb-1 ml-2">
                  <View style={{ marginRight: 4 }}><ChevronRightIcon size={8} color="rgba(0,255,65,0.6)" /></View>
                  <Text style={S.raceTraitText} className="font-robotomono text-[9px]">
                    {lang === 'es' ? t2.es : t2.en}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </SectionCard>

        {/* ── 7. Available Actions ── */}
        <CharacterActionsPanel
          race={current.race}
          charClass={current.charClass}
          subclass={current.subclass}
          lang={lang}
          featureChoices={current.featureChoices}
          onChoiceSelect={(choiceKey, value) =>
            updateCurrent({
              featureChoices: { ...current.featureChoices, [choiceKey]: value },
            })
          }
        />

        {/* ── 8. Alignment ── */}
        <SectionCard borderColor="border-primary/40">
          <SectionHeader icon={<ScaleIcon size={14} color="rgba(0,255,65,0.9)" />} label={t('party.alignment')} />
          <SectionHint text={t('party.alignmentDesc')} />
          <View className="flex-row flex-wrap justify-between">
            {sortedAlignments.map(a => {
              const abbr = (a.raw as Record<string, unknown>).abbreviation as string || a.index;
              const selected = current.alignment === a.index;
              return (
                <TouchableOpacity
                  key={a.index}
                  onPress={() => updateCurrent({ alignment: a.index })}
                  className={`w-[31%] mb-2 py-3 border rounded-sm items-center ${
                    selected ? 'bg-primary border-primary' : 'border-primary bg-muted'
                  }`}
                >
                  <Text className={`text-xs font-robotomono ${
                    selected ? 'text-background font-bold' : 'text-primary'
                  }`}>
                    {abbr}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {currentAlign && (
            <DescriptionBox
              text={
                getTranslatedField('alignments', current.alignment, 'desc', lang) ||
                getDescFromRaw(currentAlign.raw as Record<string, unknown>)
              }
              borderColor="border-primary"
              textColor="text-primary"
            />
          )}
        </SectionCard>

        {/* ── 9. Traits Preview ── */}
        <SectionCard borderColor="border-primary">
          <SectionHeader icon={<TagIcon size={14} color="rgba(0,255,65,0.9)" />} label={t('party.traitPreview')} />
          <View className="flex-row flex-wrap mt-2">
            <View className="flex-row items-center mr-6 mb-1">
              <ScaleIcon size={14} color="rgba(255,176,0,0.9)" />
              <Text className="text-secondary font-robotomono text-sm" style={{ marginLeft: 4 }}>
                {t('party.moral')}: {(() => {
                  const idx = ALIGNMENT_ORDER.indexOf(current.alignment);
                  const row = idx >= 0 ? Math.floor(idx / 3) : 1;
                  return [t('party.honorable'), t('party.neutral'), t('party.chaotic')][row] || t('party.neutral');
                })()}
              </Text>
            </View>
            <View className="flex-row items-center mb-1">
              <BrainIcon size={14} color="rgba(0,229,255,0.9)" />
              <Text className="text-accent font-robotomono text-sm" style={{ marginLeft: 4 }}>
                {t('party.mental')}: {t('party.stable')}
              </Text>
            </View>
          </View>
        </SectionCard>

        <View className="h-24" />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View className="border-t border-primary p-3 bg-background">
        <View className="flex-row justify-between mb-3">
          <TouchableOpacity
            onPress={addCharacter}
            disabled={roster.length >= 4}
            className={`flex-1 mr-2 border border-primary p-2 items-center ${
              roster.length >= 4 ? 'opacity-30' : 'bg-primary'
            }`}
          >
            <Text className="text-background font-robotomono text-[10px]">+ {t('party.addMember')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={removeCharacter}
            disabled={roster.length <= 1}
            className={`flex-1 ml-2 border border-destructive p-2 items-center ${
              roster.length <= 1 ? 'opacity-30' : 'bg-destructive/80'
            }`}
          >
            <Text className="text-destructive font-robotomono text-[10px]">- {t('party.removeMember')}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => {
            if (startingGame) return;

            const missingCount = roster.filter((_, i) => !charPortraits[i]).length;

            const doLaunch = async () => {
              setStartingGame(true);
              try {
                const party = buildPartySaves();
                startNewGame(seed, seedHash, party);

                // Auto-generate portraits for any character that doesn't have one yet
                const newPortraits: Record<string, string> = {};
                for (let i = 0; i < party.length; i++) {
                  if (!party[i].portrait) {
                    try {
                      const uri = await generateCharacterPortrait(party[i]);
                      setCharPortraits(prev => ({ ...prev, [i]: uri }));
                      newPortraits[String(i)] = uri;
                    } catch {
                      // Portrait generation failed — not blocking
                    }
                  }
                }
                if (Object.keys(newPortraits).length > 0) {
                  // Save portraits to dedicated portraits_json column, not inside party_data
                  saveCharacterPortraits(newPortraits);
                }

                navigation.reset({ index: 0, routes: [{ name: 'Village' }] });
              } finally {
                setStartingGame(false);
              }
            };

            if (missingCount > 0) {
              pendingLaunch.current = doLaunch;
              setPortraitMissingCount(missingCount);
              setPortraitConfirmVisible(true);
            } else {
              doLaunch();
            }
          }}
          disabled={startingGame}
          className={`p-3 items-center ${startingGame ? 'bg-primary/50' : 'bg-primary'}`}
        >
          {startingGame ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#0A0E0A" style={{ marginRight: 8 }} />
              <Text className="text-background font-bold font-robotomono">
                {lang === 'es' ? 'PREPARANDO EXPEDICIÓN...' : 'PREPARING EXPEDITION...'}
              </Text>
            </View>
          ) : (
            <Text className="text-background font-bold font-robotomono">{t('party.startExpedition')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Portrait Detail Modal ── */}
      <Modal
        visible={portraitDetailUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPortraitDetailUri(null)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.92)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          activeOpacity={1}
          onPress={() => setPortraitDetailUri(null)}
        >
          {portraitDetailUri && (
            <>
              <Image
                source={{ uri: portraitDetailUri }}
                style={{
                  width: 300,
                  height: 440,
                  borderWidth: 1,
                  borderColor: 'rgba(0,255,65,0.5)',
                  borderRadius: 4,
                }}
                resizeMode="contain"
              />
              <Text
                style={{ color: 'rgba(0,255,65,0.4)', marginTop: 12, fontSize: 10 }}
                className="font-robotomono"
              >
                TAP TO CLOSE
              </Text>
            </>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
};
