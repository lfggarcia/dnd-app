import React, { useState, useEffect, useMemo, memo, useCallback, useRef, type ReactNode } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  Easing, withSequence,
} from 'react-native-reanimated';
import { CRTOverlay } from '../components/CRTOverlay';
import { ConfirmModal } from '../components/ConfirmModal';
import { GlossaryButton } from '../components/GlossaryModal';
import { TutorialOverlay } from '../components/TutorialOverlay';
import { RosterTabs } from '../components/party/RosterTabs';
import { PortraitSection } from '../components/party/PortraitSection';
import { CatalogPortraitPicker } from '../components/party/CatalogPortraitPicker';
import { LaunchProgressModal } from '../components/party/LaunchProgressModal';
import { PortraitDetailModal } from '../components/party/PortraitDetailModal';
import { useI18n, type Lang } from '../i18n';
import { useTutorial, PARTY_TUTORIAL_STEPS } from '../hooks/useTutorial';
import { usePartyRoster, MAX_PORTRAIT_ROLLS } from '../hooks/usePartyRoster';
import { getTranslatedField } from '../services/translationBridge';
import { STAT_KEYS, ALIGNMENT_ORDER, getDescFromRaw, getSubclassFeatures } from '../services/characterStats';
import { CharacterActionsPanel } from '../components/CharacterActionsPanel';
import {
  DnaIcon, SwordIcon, TridentIcon, ScrollIcon, DiceIcon, StatsIcon,
  ScaleIcon, TagIcon, BrainIcon, LightningIcon, ChevronRightIcon,
} from '../components/Icons';
import type { ScreenProps } from '../navigation/types';
import {
  CLASS_LVL1_FEATURES, RACE_TRAITS, CLASS_HIT_DICE,
  calcLvl1HP, LVL1_RULES, type FeatureEntry,
} from '../constants/dnd5eLevel1';
import { useGameStore } from '../stores/gameStore';
import { generateCharacterPortrait, generateCharacterExpressions } from '../services/geminiImageService';
import { hasCatalogPortraits } from '../services/characterCatalogService';
import type { Stats } from '../database/gameRepository';


// ─── Stable Styles ────────────────────────────────────────

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
  statTotal: { color: 'rgba(0,255,65,0.5)' },
  statTotalRacial: { color: 'rgba(0,229,255,0.7)' },
  summaryLabel: { color: 'rgba(0,229,255,0.5)' },
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const { seed, seedHash, inheritedLevel } = route.params;
  const startNewGame = useGameStore(s => s.startNewGame);
  const tutorial = useTutorial(PARTY_TUTORIAL_STEPS);
  const [partyNameInput, setPartyNameInput] = useState('');
  const [activeCatalogSlot, setActiveCatalogSlot] = useState<number | null>(null);

  const {
    races, classes, backgrounds, loading,
    roster, activeSlot, setActiveSlot, current,
    charPortraits, setCharPortraits,
    charPortraitRolls, generatingPortraitFor,
    portraitError, portraitDetailUri, setPortraitDetailUri,
    portraitExpanded, setPortraitExpanded,
    launchStep, setLaunchStep, launchSubStep, setLaunchSubStep,
    portraitConfirmVisible, setPortraitConfirmVisible,
    portraitMissingCount, setPortraitMissingCount,
    pendingLaunch,
    racialBonuses, finalStats, totalBase, totalFinal,
    sortedAlignments,
    currentRace, currentClass, currentBg, currentAlign,
    currentSubs, currentSubData, bgDescription,
    updateCurrent, onClassChange, generateRandomName,
    addCharacter, removeCharacter, buildPartySaves,
    rerollStats, useStdArray, handleGeneratePortrait,
    showCatalogPicker, setShowCatalogPicker, handleSelectCatalogPortrait,
  } = usePartyRoster(lang);

  const handlePortraitView = useCallback(() => {
    const uri = charPortraits[activeSlot];
    if (uri) setPortraitDetailUri(uri);
  }, [charPortraits, activeSlot, setPortraitDetailUri]);

  const handlePortraitDetailClose = useCallback(() => setPortraitDetailUri(null), [setPortraitDetailUri]);

  // Ref estable para featureChoices — evita que handleChoiceSelect se invalide en cada update del roster
  const featureChoicesRef = useRef(current?.featureChoices);
  useEffect(() => { featureChoicesRef.current = current?.featureChoices; }, [current?.featureChoices]);

  // Estabiliza la referencia para que React.memo en CharacterActionsPanel funcione
  const handleChoiceSelect = useCallback(
    (choiceKey: string, value: string | string[]) =>
      updateCurrent({
        featureChoices: { ...featureChoicesRef.current, [choiceKey]: value },
      }),
    [updateCurrent],
  );

  const handleLaunch = useCallback(() => {
    if (launchStep !== null) return;
    const missingCount = roster.filter((_, i) => !charPortraits[i]).length;

    const doLaunch = async () => {
      setLaunchStep(lang === 'es' ? 'Iniciando partida...' : 'Initializing game...');
      setLaunchSubStep(null);
      try {
        const party = buildPartySaves();
        // R5: Apply inherited level if this seed had a previous party
        const finalParty = inheritedLevel
          ? party.map(c => ({ ...c, level: Math.max(c.level, inheritedLevel) }))
          : party;
        startNewGame(seed, seedHash, finalParty, partyNameInput.trim() || `PARTY_${seed.slice(0, 6).toUpperCase()}`);

        const newPortraits: Record<string, string> = {};
        const totalMissing = party.filter(c => !c.portrait).length;
        let doneCount = 0;

        for (let i = 0; i < party.length; i++) {
          if (!party[i].portrait) {
            const remaining = totalMissing - doneCount;
            setLaunchStep(
              lang === 'es'
                ? `Creando ilustración para ${party[i].name}`
                : `Creating portrait for ${party[i].name}`,
            );
            setLaunchSubStep(
              lang === 'es'
                ? `${remaining} de ${totalMissing} ilustraciones pendientes`
                : `${remaining} of ${totalMissing} portraits remaining`,
            );
            try {
              const uri = await generateCharacterPortrait(party[i]);
              setCharPortraits(prev => ({ ...prev, [i]: uri }));
              newPortraits[String(i)] = uri;

              // Auto-generate expression variants (neutral, happy, angry, sad, surprised, wounded)
              setLaunchStep(
                lang === 'es'
                  ? `Generando expresiones para ${party[i].name}`
                  : `Generating expressions for ${party[i].name}`,
              );
              try {
                const expressions = await generateCharacterExpressions(party[i], uri);
                useGameStore.getState().saveCharacterExpressions({ [String(i)]: expressions });
              } catch {
                // Expression generation is non-blocking
              }
            } catch {
              // Portrait failure is non-blocking
            }
            doneCount++;
          }
        }

        // Generate expressions for characters that already had a portrait
        for (let i = 0; i < party.length; i++) {
          if (party[i].portrait) {
            setLaunchStep(
              lang === 'es'
                ? `Generando expresiones para ${party[i].name}`
                : `Generating expressions for ${party[i].name}`,
            );
            setLaunchSubStep(null);
            try {
              const expressions = await generateCharacterExpressions(party[i], party[i].portrait!);
              useGameStore.getState().saveCharacterExpressions({ [String(i)]: expressions });
            } catch {
              // Expression generation is non-blocking
            }
          }
        }

        if (Object.keys(newPortraits).length > 0) {
          setLaunchStep(lang === 'es' ? 'Guardando ilustraciones...' : 'Saving portraits...');
          setLaunchSubStep(null);
          useGameStore.getState().saveCharacterPortraits(newPortraits);
        }

        setLaunchStep(lang === 'es' ? 'Entrando a la aldea...' : 'Entering the village...');
        setLaunchSubStep(null);
        navigation.reset({ index: 0, routes: [{ name: 'Village' }] });
      } finally {
        setLaunchStep(null);
        setLaunchSubStep(null);
      }
    };

    if (missingCount > 0) {
      pendingLaunch.current = doLaunch;
      setPortraitMissingCount(missingCount);
      setPortraitConfirmVisible(true);
    } else {
      doLaunch();
    }
  }, [
    launchStep, roster, charPortraits, buildPartySaves, startNewGame, seed, seedHash,
    lang, setCharPortraits, setLaunchStep, setLaunchSubStep,
    setPortraitMissingCount, setPortraitConfirmVisible, pendingLaunch, navigation, partyNameInput,
  ]);

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

      <RosterTabs
        roster={roster}
        activeSlot={activeSlot}
        onSlotPress={setActiveSlot}
        classes={classes}
      />

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

          <PortraitSection
            lang={lang}
            portrait={charPortraits[activeSlot] ?? null}
            portraitRolls={charPortraitRolls[activeSlot] ?? 0}
            generating={generatingPortraitFor === activeSlot}
            error={portraitError}
            expanded={portraitExpanded}
            maxRolls={MAX_PORTRAIT_ROLLS}
            onToggleExpand={() => setPortraitExpanded(v => !v)}
            onGenerate={handleGeneratePortrait}
            onView={handlePortraitView}
            catalogAvailable={hasCatalogPortraits(current?.charClass ?? '')}
            onSelectFromCatalog={() => {
              setActiveCatalogSlot(activeSlot);
              setShowCatalogPicker(true);
            }}
          />
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
          onChoiceSelect={handleChoiceSelect}
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
        <TextInput
          style={S.bannerInput}
          value={partyNameInput}
          onChangeText={setPartyNameInput}
          placeholder={lang === 'es' ? 'NOMBRE DE LA PARTY...' : 'PARTY NAME...'}
          placeholderTextColor="rgba(0,255,65,0.3)"
          maxLength={24}
          autoCapitalize="characters"
          selectionColor="#00FF41"
        />
        <TouchableOpacity
          onPress={handleLaunch}
          disabled={launchStep !== null}
          className={`p-3 items-center ${launchStep !== null ? 'bg-primary/50' : 'bg-primary'}`}
        >
          <Text className="text-background font-bold font-robotomono">{t('party.startExpedition')}</Text>
        </TouchableOpacity>
      </View>

      <LaunchProgressModal
        visible={launchStep !== null}
        lang={lang}
        step={launchStep}
        subStep={launchSubStep}
      />
      <PortraitDetailModal
        uri={portraitDetailUri}
        onClose={handlePortraitDetailClose}
      />
      <CatalogPortraitPicker
        visible={showCatalogPicker}
        charClass={roster[activeCatalogSlot ?? 0]?.charClass ?? ''}
        race={roster[activeCatalogSlot ?? 0]?.race}
        lang={lang}
        onSelect={(entry) => {
          handleSelectCatalogPortrait(activeCatalogSlot ?? 0, entry);
          setShowCatalogPicker(false);
        }}
        onClose={() => setShowCatalogPicker(false)}
      />
    </View>
  );
};
