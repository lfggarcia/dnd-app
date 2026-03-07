import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  useRaces,
  useClasses,
  useBackgrounds,
  useAlignments,
  useSubclasses,
} from './useResources';
import { getTranslatedField } from '../services/translationBridge';
import {
  STAT_KEYS,
  ALIGNMENT_ORDER,
  assignStandardArray,
  generateValidRolledStats,
  getRacialBonuses,
  computeFinalStats,
  pickRaceName,
} from '../services/characterStats';
import { generateCharacterPortrait } from '../services/geminiImageService';
import { useGameStore } from '../stores/gameStore';
import { calcLvl1HP } from '../constants/dnd5eLevel1';
import type { Stats, CharacterSave } from '../database/gameRepository';
import type { Lang } from '../i18n';

// ─── Types ────────────────────────────────────────────────

export type CharacterDraft = {
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

export const MAX_PORTRAIT_ROLLS = 2;

// ─── Constants ────────────────────────────────────────────

const INIT_CLASSES = ['fighter', 'rogue', 'wizard', 'cleric'];

export function mkDefault(i: number): CharacterDraft {
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

// ─── Hook ─────────────────────────────────────────────────

export function usePartyRoster(lang: Lang) {
  const saveCharacterPortraits = useGameStore(s => s.saveCharacterPortraits);

  const { data: races, loading: racesLoading } = useRaces();
  const { data: classes, loading: classesLoading } = useClasses();
  const { data: backgrounds, loading: bgLoading } = useBackgrounds();
  const { data: alignments, loading: alignLoading } = useAlignments();
  const { data: allSubclasses, loading: subLoading } = useSubclasses();

  const loading = racesLoading || classesLoading || bgLoading || alignLoading || subLoading;

  // ── State ──

  const [roster, setRoster] = useState<CharacterDraft[]>([mkDefault(0)]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [charPortraits, setCharPortraits] = useState<Record<number, string>>({});
  const [charPortraitRolls, setCharPortraitRolls] = useState<Record<number, number>>({});
  const [generatingPortraitFor, setGeneratingPortraitFor] = useState<number | null>(null);
  const [portraitError, setPortraitError] = useState<string | null>(null);
  const [portraitDetailUri, setPortraitDetailUri] = useState<string | null>(null);
  const [portraitExpanded, setPortraitExpanded] = useState(true);
  const [launchStep, setLaunchStep] = useState<string | null>(null);
  const [launchSubStep, setLaunchSubStep] = useState<string | null>(null);
  const [portraitConfirmVisible, setPortraitConfirmVisible] = useState(false);
  const [portraitMissingCount, setPortraitMissingCount] = useState(0);
  const pendingLaunch = useRef<(() => void) | null>(null);

  const current = roster[activeSlot];

  // ── Sub-helpers ──

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
    if (!current?.subclass && allSubclasses.length > 0) {
      const subs = subsForClass(current?.charClass ?? '');
      if (subs.length > 0) updateCurrent({ subclass: subs[0].index });
    }
  }, [allSubclasses, current?.charClass, current?.subclass, subsForClass, updateCurrent]);

  // ── Actions ──

  const onClassChange = useCallback((classIndex: string) => {
    const subs = subsByClass.get(classIndex) || [];
    setRoster(prev => prev.map((c, i) => {
      if (i !== activeSlot) return c;
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
    updateCurrent({ name: pickRaceName(current?.race ?? 'human') });
  }, [current?.race, updateCurrent]);

  const addCharacter = useCallback(() => {
    if (roster.length >= 4) return;
    const nextIndex = roster.length;
    setRoster(prev => [...prev, mkDefault(prev.length)]);
    setActiveSlot(nextIndex);
  }, [roster.length]);

  const removeCharacter = useCallback(() => {
    if (roster.length <= 1) return;
    setRoster(prev => prev.filter((_, i) => i !== activeSlot));
    setActiveSlot(a => Math.max(0, a - 1));
  }, [roster.length, activeSlot]);

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

  const rerollStats = useCallback(
    () => updateCurrent({ baseStats: generateValidRolledStats(), statMethod: 'rolled' }),
    [updateCurrent],
  );

  const useStdArray = useCallback(
    () => updateCurrent({ baseStats: assignStandardArray(current?.charClass ?? 'fighter'), statMethod: 'standard' }),
    [current?.charClass, updateCurrent],
  );

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
      saveCharacterPortraits({ [String(activeSlot)]: uri });
    } catch (err) {
      console.error('[Portrait] generation error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setPortraitError(msg.length > 38 ? msg.substring(0, 38) + '...' : msg);
    } finally {
      setGeneratingPortraitFor(null);
    }
  }, [generatingPortraitFor, activeSlot, buildPartySaves, charPortraitRolls, saveCharacterPortraits]);

  // ── Computed selections ──

  const racialBonuses = useMemo(() => {
    const race = races.find(r => r.index === current?.race);
    return race ? getRacialBonuses(race.raw as Record<string, unknown>) : {};
  }, [current?.race, races]);

  const finalStats = useMemo(
    () => computeFinalStats(current?.baseStats ?? { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }, racialBonuses),
    [current?.baseStats, racialBonuses],
  );

  const totalBase = useMemo(
    () => STAT_KEYS.reduce((sum, k) => sum + (current?.baseStats[k] ?? 0), 0),
    [current?.baseStats],
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

  const currentRace = useMemo(
    () => races.find(r => r.index === current?.race),
    [races, current?.race],
  );
  const currentClass = useMemo(
    () => classes.find(c => c.index === current?.charClass),
    [classes, current?.charClass],
  );
  const currentBg = useMemo(
    () => backgrounds.find(b => b.index === current?.background),
    [backgrounds, current?.background],
  );
  const currentAlign = useMemo(
    () => sortedAlignments.find(a => a.index === current?.alignment),
    [sortedAlignments, current?.alignment],
  );
  const currentSubs = useMemo(
    () => subsForClass(current?.charClass ?? ''),
    [subsForClass, current?.charClass],
  );
  const currentSubData = useMemo(
    () => allSubclasses.find(s => s.index === current?.subclass),
    [allSubclasses, current?.subclass],
  );

  const bgDescription = useMemo(() => {
    if (!currentBg) return '';
    const bgRaw = currentBg.raw as Record<string, unknown>;
    const feature = bgRaw.feature as { name?: string; desc?: string[] } | undefined;
    return getTranslatedField('backgrounds', current?.background ?? '', 'desc', lang)
      || feature?.desc?.join(' ')
      || '';
  }, [currentBg, current?.background, lang]);

  return {
    // Resource data
    races, classes, backgrounds, allSubclasses, loading,
    // Roster
    roster, activeSlot, setActiveSlot, current,
    // Portrait state
    charPortraits, setCharPortraits,
    charPortraitRolls,
    generatingPortraitFor,
    portraitError,
    portraitDetailUri, setPortraitDetailUri,
    portraitExpanded, setPortraitExpanded,
    // Launch state
    launchStep, setLaunchStep,
    launchSubStep, setLaunchSubStep,
    portraitConfirmVisible, setPortraitConfirmVisible,
    portraitMissingCount, setPortraitMissingCount,
    pendingLaunch,
    // Computed values
    racialBonuses, finalStats, totalBase, totalFinal,
    sortedAlignments,
    currentRace, currentClass, currentBg, currentAlign,
    currentSubs, currentSubData, bgDescription,
    // Actions
    updateCurrent, onClassChange, generateRandomName,
    addCharacter, removeCharacter,
    buildPartySaves, rerollStats, useStdArray,
    handleGeneratePortrait,
  };
}
