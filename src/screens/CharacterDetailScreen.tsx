import React, { useMemo, useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Dimensions,
  TextInput,
} from 'react-native';
import { AnimatedAppImage } from '../components/AppImage';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { CRTOverlay } from '../components/CRTOverlay';
import { PortraitDetailModal } from '../components/party/PortraitDetailModal';
import { EXPRESSION_PRESETS, generateCharacterPortrait, generateCharacterExpressions } from '../services/geminiImageService';
import { getCatalogPortrait, hasCatalogPortraits, requireCatalogPortrait } from '../services/characterCatalogService';
import { getItemsByGame } from '../database/itemRepository';
import type { Item } from '../database/itemRepository';
import { getEssencesByChar, equipEssence, unequipEssence, getEquippedCount } from '../database/essenceRepository';
import type { SavedEssence } from '../database/essenceRepository';
import { getEssenceSlots } from '../services/essenceService';
import { ABANDON_THRESHOLD, isGoodOrLawful } from '../services/moralSystem';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import { resolvePortraitSource, resolveExpressionSource, getAvailableExpressions, type PortraitSource } from '../utils/mapState';
import type { Stats } from '../database/gameRepository';
import type { ScreenProps } from '../navigation/types';

// ─── Constants ────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width;
const PORTRAIT_H = Math.round(SCREEN_W * 1.35);

const EXPRESSION_KEYS = Object.keys(EXPRESSION_PRESETS) as string[];

const EXPR_LABELS: Record<string, { es: string; en: string }> = {
  neutral:    { es: 'NEUTRO',   en: 'NEUTRAL'  },
  angry:      { es: 'IRA',      en: 'ANGRY'    },
  confident:  { es: 'SEGURO',   en: 'CONFID'   },
  confused:   { es: 'CONFUSO',  en: 'CONFSD'   },
  despondent: { es: 'ABATIDO',  en: 'DESPND'   },
  determined: { es: 'FIRME',    en: 'DETRMN'   },
  disgusted:  { es: 'ASCO',     en: 'DISGST'   },
  fearful:    { es: 'MIEDO',    en: 'FEARFL'   },
  fierce:     { es: 'FEROZ',    en: 'FIERCE'   },
  flirty:     { es: 'COQUETO',  en: 'FLIRTY'   },
  happy:      { es: 'FELIZ',    en: 'HAPPY'    },
  hollow:     { es: 'VACÍO',    en: 'HOLLOW'   },
  incredulous:{ es: 'INCRÉDULO',en: 'INCRDL'   },
  rage:       { es: 'RABIA',    en: 'RAGE'     },
  sad:        { es: 'TRISTE',   en: 'SAD'      },
  sarcastic:  { es: 'SARCASMO', en: 'SARC'     },
  seductive:  { es: 'SEDUCTOR', en: 'SEDUCT'   },
  serious:    { es: 'SERIO',    en: 'SERIOUS'  },
  shocked:    { es: 'IMPACTO',  en: 'SHOCKD'   },
  surprised:  { es: 'SORPR',    en: 'SURPR'    },
  tired:      { es: 'CANSADO',  en: 'TIRED'    },
  triumph:    { es: 'TRIUNFO',  en: 'TRIUMP'   },
};

const STAT_KEYS: (keyof Stats)[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

const STAT_LABELS: Record<keyof Stats, { es: string; en: string }> = {
  STR: { es: 'Fuerza',        en: 'Strength'     },
  DEX: { es: 'Destreza',      en: 'Dexterity'    },
  CON: { es: 'Constitución',  en: 'Constitution' },
  INT: { es: 'Inteligencia',  en: 'Intelligence' },
  WIS: { es: 'Sabiduría',     en: 'Wisdom'       },
  CHA: { es: 'Carisma',      en: 'Charisma'     },
};

const STAT_SHORT: Record<keyof Stats, { es: string; en: string }> = {
  STR: { es: 'FUE', en: 'STR' },
  DEX: { es: 'DES', en: 'DEX' },
  CON: { es: 'CON', en: 'CON' },
  INT: { es: 'INT', en: 'INT' },
  WIS: { es: 'SAB', en: 'WIS' },
  CHA: { es: 'CAR', en: 'CHA' },
};

function statMod(val: number): string {
  const mod = Math.floor((val - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// ─── Animated Stat Bar ─────────────────────────────────────

const StatBar = memo(({
  statKey, value, index, lang,
}: {
  statKey: keyof Stats; value: number; index: number; lang: string;
}) => {
  const mod = Math.floor((value - 10) / 2);
  const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
  const pct = Math.min(((value - 3) / 17) * 100, 100);
  const label = STAT_LABELS[statKey][lang === 'es' ? 'es' : 'en'];
  const shortKey = STAT_SHORT[statKey][lang === 'es' ? 'es' : 'en'];

  const barWidth = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withDelay(
      index * 90,
      withTiming(pct, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
    glowOpacity.value = withDelay(
      index * 90,
      withSequence(
        withTiming(1, { duration: 260 }),
        withTiming(0, { duration: 480 }),
      ),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const barStyle = useAnimatedStyle(() => ({ width: `${barWidth.value}%` }));
  const glowStyle = useAnimatedStyle(() => ({
    shadowColor: '#00FF41',
    shadowOpacity: glowOpacity.value * 0.9,
    shadowRadius: 8,
  }));

  return (
    <View style={S.statBarRow}>
      <View style={S.statBarLeft}>
        <Text style={S.statBarShort}>{shortKey}</Text>
        <Text style={S.statBarLabel}>{label}</Text>
      </View>
      <View style={S.statBarTrack}>
        <Animated.View style={[S.statBarFill, barStyle, glowStyle]} />
        {/* Tick marks at 8, 10, 14, 18 */}
        {[8, 10, 14, 18].map(tick => {
          const tickPct = ((tick - 3) / 17) * 100;
          return (
            <View
              key={tick}
              style={[S.statBarTick, { left: `${tickPct}%` as any }]}
            />
          );
        })}
      </View>
      <Text style={S.statBarValue}>{value}</Text>
      <Text style={S.statBarMod}>{modStr}</Text>
    </View>
  );
});

// ─── Animated Nav Arrow ────────────────────────────────────

const NavArrow = memo(({
  dir, disabled, onPress,
}: {
  dir: '<' | '>'; disabled: boolean; onPress: () => void;
}) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = useCallback(() => {
    scale.value = withSequence(
      withSpring(0.72, { damping: 6 }),
      withSpring(1, { damping: 10 }),
    );
    onPress();
  }, [onPress, scale]);

  return (
    <TouchableOpacity onPress={handlePress} disabled={disabled} activeOpacity={0.7}>
      <Animated.Text style={[S.navArrow, disabled && S.navArrowDisabled, animStyle]}>
        {dir}
      </Animated.Text>
    </TouchableOpacity>
  );
});

// ─── Animated Expression Button ────────────────────────────

const ExprButton = memo(({
  exprKey, isActive, hasVariant, label, onPress,
}: {
  exprKey: string; isActive: boolean; hasVariant: boolean; label: string; onPress: () => void;
}) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = useCallback(() => {
    scale.value = withSequence(
      withSpring(0.82, { damping: 6 }),
      withSpring(1, { damping: 12 }),
    );
    onPress();
  }, [onPress, scale]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={!hasVariant}
      activeOpacity={0.7}
      style={[S.exprBtn, isActive && S.exprBtnActive, !hasVariant && S.exprBtnDisabled]}
    >
      <Animated.Text style={[S.exprBtnText, isActive && S.exprBtnTextActive, animStyle]}>
        {label}
      </Animated.Text>
    </TouchableOpacity>
  );
});

// ─── Screen ───────────────────────────────────────────────

export const CharacterDetailScreen = ({ navigation, route }: ScreenProps<'CharacterDetail'>) => {
  const { charIndex } = route.params;
  const { lang } = useI18n();

  const activeGame    = useGameStore(s => s.activeGame);
  const activeGameId  = useGameStore(s => s.activeGame?.id ?? null);
  const saveCharacterPortraits = useGameStore(s => s.saveCharacterPortraits);
  const updateProgress = useGameStore(s => s.updateProgress);
  const party = useMemo(() => activeGame?.partyData ?? [], [activeGame]);
  const expressionsJson = activeGame?.expressionsJson ?? {};
  const portraitsJson   = activeGame?.portraitsJson ?? {};

  const [selectedExpression, setSelectedExpression] = useState('neutral');
  const [fullscreenUri, setFullscreenUri] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'STATS' | 'EQUIPO' | 'ESENCIAS'>('STATS');
  const [charItems, setCharItems] = useState<Item[]>([]);
  const [essenceList, setEssenceList] = useState<SavedEssence[]>([]);
  const [generatingPortrait, setGeneratingPortrait] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const char = party[charIndex];
  // Stored expression paths (for generated, non-catalog portraits)
  const storedExpressions = expressionsJson[charIndex] ?? null;
  // Path stored when a portrait was assigned (catalog relative path or file URI)
  const portraitPath = (portraitsJson[String(charIndex)] ?? char?.portrait) || null;

  // Load equipment for this character
  useEffect(() => {
    if (!activeGameId || !char) return;
    try {
      const all = getItemsByGame(activeGameId);
      setCharItems(all.filter(it => it.ownerCharName === char.name));
    } catch {
      setCharItems([]);
    }
  }, [activeGameId, char]);

  const refreshEssences = useCallback(() => {
    if (!activeGameId || !char) return;
    try {
      setEssenceList(getEssencesByChar(activeGameId, char.name));
    } catch {
      setEssenceList([]);
    }
  }, [activeGameId, char]);

  useEffect(() => {
    if (activeTab === 'ESENCIAS') refreshEssences();
  }, [activeTab, refreshEssences]);

  const handleGeneratePortrait = useCallback(async () => {
    if (!char || generatingPortrait) return;
    setGeneratingPortrait(true);
    try {
      // Catalog-first: use prebuilt static portrait if available (avoids runtime AI generation)
      if (hasCatalogPortraits(char.charClass)) {
        const catalogEntry = getCatalogPortrait(char.charClass, char.race ?? undefined);
        if (catalogEntry && requireCatalogPortrait(catalogEntry) !== null) {
          saveCharacterPortraits({ [String(charIndex)]: catalogEntry.portraitPath });
          if (catalogEntry.expressions && Object.keys(catalogEntry.expressions).length > 0) {
            useGameStore.getState().saveCharacterExpressions({ [String(charIndex)]: catalogEntry.expressions });
          }
          return;
        }
      }
      // Fallback: live generation via ComfyUI
      const uri = await generateCharacterPortrait(char);
      saveCharacterPortraits({ [String(charIndex)]: uri });
      // Also generate expression variants (non-blocking)
      try {
        const expressions = await generateCharacterExpressions(char, uri);
        useGameStore.getState().saveCharacterExpressions({ [String(charIndex)]: expressions });
      } catch { /* non-blocking */ }
    } catch (err) {
      __DEV__ && console.error('[CharacterDetail] portrait generation error:', err);
    } finally {
      setGeneratingPortrait(false);
    }
  }, [char, charIndex, generatingPortrait, saveCharacterPortraits]);

  // Portrait fade on expression change
  const portraitOpacity = useSharedValue(1);
  const portraitAnimStyle = useAnimatedStyle(() => ({ opacity: portraitOpacity.value }));

  const handleExpressionChange = useCallback((key: string) => {
    if (key === selectedExpression) return;
    portraitOpacity.value = withSequence(
      withTiming(0, { duration: 100 }),
      withTiming(1, { duration: 220 }),
    );
    setSelectedExpression(key);
  }, [selectedExpression, portraitOpacity]);

  const handleRename = useCallback(() => {
    const trimmed = nameInput.trim().slice(0, 20);
    if (!trimmed || trimmed === char?.name) {
      setIsEditingName(false);
      return;
    }
    const updatedParty = party.map(c =>
      c.characterId === char.characterId
        ? { ...c, name: trimmed }
        : c,
    );
    updateProgress({ partyData: updatedParty });
    setIsEditingName(false);
  }, [nameInput, char, party, updateProgress]);

  const hpPct = char ? (char.maxHp > 0 ? char.hp / char.maxHp : 0) : 0;
  // UI-GAP-03: moral risk badge
  const isDeserterAtRisk = char
    ? (char.morale ?? 80) < ABANDON_THRESHOLD && isGoodOrLawful(char.alignment ?? '')
    : false;
  const hpColor = !char?.alive
    ? '#FF3E3E'
    : hpPct > 0.5
      ? '#00FF41'
      : hpPct > 0.25
        ? '#FFB000'
        : '#FF3E3E';

  const statusLabel = !char?.alive
    ? (lang === 'es' ? 'MUERTO' : 'DEAD')
    : hpPct < 1
      ? (lang === 'es' ? 'HERIDO' : 'WOUNDED')
      : (lang === 'es' ? 'ACTIVO' : 'ACTIVE');

  // Catalog expressions (require numbers) take priority; fall back to generated (file URIs)
  const catalogExpressions = getAvailableExpressions(portraitPath);
  const activeSource: PortraitSource | null =
    resolveExpressionSource(portraitPath, selectedExpression) ??
    resolveExpressionSource(portraitPath, 'neutral') ??
    (storedExpressions?.[selectedExpression] ? { uri: storedExpressions[selectedExpression] } : null) ??
    (storedExpressions?.['neutral'] ? { uri: storedExpressions['neutral'] } : null) ??
    resolvePortraitSource(portraitPath);

  const hasExpressions = !!(catalogExpressions ?? (storedExpressions && Object.keys(storedExpressions).length > 0));

  const hasPrev = charIndex > 0;
  const hasNext = charIndex < party.length - 1;

  if (!char) {
    return (
      <View className="flex-1 bg-background">
        <CRTOverlay />
        <View style={S.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={S.backBtn}>{'<'} {lang === 'es' ? 'VOLVER' : 'BACK'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />
      <PortraitDetailModal uri={fullscreenUri} onClose={() => setFullscreenUri(null)} />

      {/* ── Header ── */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={S.backBtn}>{'<'} {lang === 'es' ? 'VOLVER' : 'BACK'}</Text>
        </TouchableOpacity>

        <Text style={S.headerTitle}>
          {lang === 'es' ? 'FICHA DE PERSONAJE' : 'CHARACTER SHEET'}
        </Text>

        <View style={S.navArrows}>
          <NavArrow
            dir="<"
            disabled={!hasPrev}
            onPress={() => navigation.replace('CharacterDetail', { charIndex: charIndex - 1 })}
          />
          <Text style={S.navCount}>{charIndex + 1}/{party.length}</Text>
          <NavArrow
            dir=">"
            disabled={!hasNext}
            onPress={() => navigation.replace('CharacterDetail', { charIndex: charIndex + 1 })}
          />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 56 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Portrait — tappable to fullscreen ── */}
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => activeSource != null && setFullscreenUri(portraitPath)}
          style={{ width: SCREEN_W, height: PORTRAIT_H, backgroundColor: '#010a01' }}
        >
          {activeSource != null ? (
            <>
              <AnimatedAppImage
                source={activeSource as any}
                style={[{ width: '100%', height: '100%' }, portraitAnimStyle]}
                resizeMode="cover"
              />
              {/* Radial vignette: fades portrait edges into bg — simulates BG removal.
                  Fullscreen modal uses the raw URI without this overlay. */}
              <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                <Svg width={SCREEN_W} height={PORTRAIT_H}>
                  <Defs>
                    <RadialGradient
                      id="portraitVig"
                      cx={SCREEN_W * 0.5}
                      cy={PORTRAIT_H * 0.4}
                      r={Math.max(SCREEN_W, PORTRAIT_H) * 0.6}
                      gradientUnits="userSpaceOnUse"
                    >
                      <Stop offset="0" stopColor="#010a01" stopOpacity="0" />
                      <Stop offset="0.52" stopColor="#010a01" stopOpacity="0" />
                      <Stop offset="1" stopColor="#010a01" stopOpacity="1" />
                    </RadialGradient>
                  </Defs>
                  <Rect x="0" y="0" width={SCREEN_W} height={PORTRAIT_H} fill="url(#portraitVig)" />
                </Svg>
              </View>
            </>
          ) : (
            <View style={S.portraitPlaceholder}>
              <Text style={S.portraitInit}>{char.name.charAt(0).toUpperCase()}</Text>
              <TouchableOpacity
                style={S.generatePortraitBtn}
                onPress={handleGeneratePortrait}
                disabled={generatingPortrait}
                activeOpacity={0.7}
              >
                <Text style={S.generatePortraitBtnText}>
                  {generatingPortrait ? '⟳ GENERANDO...' : '✦ GENERAR IMAGEN'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Expand hint */}
          {activeSource != null && (
            <View style={S.expandHint}>
              <Text style={S.expandHintText}>⤢</Text>
            </View>
          )}

          {/* Bottom info overlay — compact */}
          <View style={S.portraitOverlay}>
            <View style={S.statusRow}>
              <View style={[S.statusDot, { backgroundColor: hpColor }]} />
              <Text style={[S.statusBadge, { color: hpColor }]}>{statusLabel}</Text>
              <View style={[S.statusLine, { backgroundColor: hpColor }]} />
            </View>
            {isEditingName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[S.portraitName, { borderBottomWidth: 1, borderBottomColor: '#00FF41', minWidth: 120, paddingBottom: 2 }]}
                  value={nameInput}
                  onChangeText={setNameInput}
                  maxLength={20}
                  autoFocus
                  autoCapitalize="characters"
                  selectionColor="#00FF41"
                  onSubmitEditing={handleRename}
                  onBlur={handleRename}
                />
                <TouchableOpacity onPress={handleRename} style={{ marginLeft: 8 }}>
                  <Text style={{ color: '#00FF41', fontFamily: 'RobotoMono-Bold', fontSize: 12 }}>OK</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onLongPress={() => { setNameInput(char.name); setIsEditingName(true); }} activeOpacity={0.7}>
                <Text style={S.portraitName}>{char.name.toUpperCase()}</Text>
              </TouchableOpacity>
            )}
            <Text style={S.portraitSub}>
              {char.race}  ·  {char.charClass}{char.subclass ? ` (${char.subclass})` : ''}
            </Text>
            <View style={S.hpRow}>
              <Text style={[S.hpLabel, { color: hpColor }]}>HP</Text>
              <View style={S.hpBarBg}>
                <View style={[S.hpBarFill, { width: `${Math.round(hpPct * 100)}%`, backgroundColor: hpColor }]} />
              </View>
              <Text style={[S.hpNumbers, { color: hpColor }]}>{char.hp}/{char.maxHp}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── Expression strip — below portrait ── */}
        {hasExpressions && (
          <View style={S.exprStrip}>
            <Text style={S.exprStripLabel}>
              {lang === 'es' ? 'EXPRESIÓN' : 'EXPRESSION'}
            </Text>
            <View style={S.exprStripDivider} />
            <View style={S.exprBtnRow}>
              {EXPRESSION_KEYS.map(key => {
                const hasVariant = !!(catalogExpressions?.[key] ?? storedExpressions?.[key]);
                const label = EXPR_LABELS[key]?.[lang === 'es' ? 'es' : 'en'] ?? key.toUpperCase();
                return (
                  <ExprButton
                    key={key}
                    exprKey={key}
                    isActive={selectedExpression === key}
                    hasVariant={hasVariant}
                    label={label}
                    onPress={() => handleExpressionChange(key)}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* ── Tab Switcher ── */}
        <View style={S.tabRow}>
          {(['STATS', 'EQUIPO', 'ESENCIAS'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[S.tabBtn, activeTab === tab && S.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[S.tabBtnText, activeTab === tab && S.tabBtnTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Body ── */}
        <View style={S.body}>

          {activeTab === 'STATS' && (
            <View>
          {/* UI-GAP-03: Desertion risk banner */}
          {isDeserterAtRisk && (
            <View style={S.moralRiskBanner}>
              <Text style={S.moralRiskText}>
                ⚠ {lang === 'es'
                  ? `Moral crítica (${char.morale}). Riesgo de deserción en combate.`
                  : `Critical morale (${char.morale}). Desertion risk in combat.`}
              </Text>
            </View>
          )}
          <View style={S.metaRow}>
            <Text style={S.metaTag}>{char.background}</Text>
            <Text style={S.metaSep}>·</Text>
            <Text style={S.metaTag}>{char.alignment}</Text>
          </View>

          {/* ── Ability Scores ── */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <View style={S.sectionLine} />
              <Text style={S.sectionLabel}>
                {lang === 'es' ? 'CARACTERÍSTICAS' : 'ABILITY SCORES'}
              </Text>
              <View style={S.sectionLine} />
            </View>

            <View style={S.statBarsCard}>
              {STAT_KEYS.map((key, i) => (
                <StatBar
                  key={key}
                  statKey={key}
                  value={char.baseStats[key]}
                  index={i}
                  lang={lang}
                />
              ))}
            </View>
          </View>

          {/* ── Features ── */}
          {Object.keys(char.featureChoices).length > 0 && (
            <View style={S.section}>
              <View style={S.sectionHeader}>
                <View style={S.sectionLine} />
                <Text style={S.sectionLabel}>
                  {lang === 'es' ? 'RASGOS Y HABILIDADES' : 'FEATURES & TRAITS'}
                </Text>
                <View style={S.sectionLine} />
              </View>
              {Object.entries(char.featureChoices).map(([k, v]) => (
                <View key={k} style={S.featureRow}>
                  <Text style={S.featureKey}>{k}</Text>
                  <Text style={S.featureVal}>{Array.isArray(v) ? v.join(', ') : v}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Stat generation method ── */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <View style={S.sectionLine} />
              <Text style={S.sectionLabel}>
                {lang === 'es' ? 'GENERACIÓN DE STATS' : 'STAT GENERATION'}
              </Text>
              <View style={S.sectionLine} />
            </View>
            <Text style={S.metaChip}>
              {char.statMethod === 'standard'
                ? (lang === 'es' ? 'Puntuación estándar' : 'Standard Array')
                : (lang === 'es' ? 'Tirada de dados' : 'Rolled Stats')}
            </Text>
          </View>

          {/* ── Moral (UI-GAP-03) ── */}
          {char.morale !== undefined && (
            <View style={S.section}>
              <View style={S.sectionHeader}>
                <View style={S.sectionLine} />
                <Text style={S.sectionLabel}>
                  {lang === 'es' ? 'MORAL' : 'MORALE'}
                </Text>
                <View style={S.sectionLine} />
              </View>
              <View style={S.moraleRow}>
                <View style={S.moraleBarBg}>
                  <View
                    style={[
                      S.moraleBarFill,
                      {
                        width: `${Math.max(0, Math.min(100, char.morale))}%`,
                        backgroundColor: (char.morale ?? 80) < 20
                          ? '#FF3E3E'
                          : (char.morale ?? 80) < 40
                            ? '#FFB000'
                            : '#00FF41',
                      },
                    ]}
                  />
                </View>
                <Text style={S.moraleValue}>{char.morale}/100</Text>
              </View>
            </View>
          )}

          </View>
          )}

          {activeTab === 'EQUIPO' && (
            <View>
              <View style={S.section}>
                <View style={S.sectionHeader}>
                  <View style={S.sectionLine} />
                  <Text style={S.sectionLabel}>
                    {lang === 'es' ? 'EQUIPO' : 'EQUIPMENT'}
                  </Text>
                  <View style={S.sectionLine} />
                </View>
                {charItems.length === 0 ? (
                  <Text style={S.emptyEquip}>
                    {lang === 'es' ? 'Sin equipo asignado' : 'No equipment assigned'}
                  </Text>
                ) : (
                  charItems.map(item => (
                    <View key={item.id} style={S.itemRow}>
                      <View style={S.itemInfo}>
                        <Text style={S.itemName}>{item.name}</Text>
                        <Text style={S.itemMeta}>
                          {item.type}  ·  {item.rarity}  ·  {item.goldValue}g
                        </Text>
                      </View>
                      {item.isEquipped && (
                        <Text style={S.equippedBadge}>
                          {lang === 'es' ? 'EQUIPADO' : 'EQUIPPED'}
                        </Text>
                      )}
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {activeTab === 'ESENCIAS' && activeGameId && (
            <View>
              <View style={S.section}>
                <View style={S.sectionHeader}>
                  <View style={S.sectionLine} />
                  <Text style={S.sectionLabel}>
                    {lang === 'es' ? 'ESENCIAS' : 'ESSENCES'}
                  </Text>
                  <View style={S.sectionLine} />
                </View>

                {/* Slot counter */}
                <View style={S.essenceSlotRow}>
                  <Text style={S.essenceSlotLabel}>
                    {lang === 'es' ? 'SLOTS DISPONIBLES' : 'AVAILABLE SLOTS'}
                  </Text>
                  <Text style={S.essenceSlotValue}>
                    {getEquippedCount(activeGameId, char.name)}/{getEssenceSlots(char.level, char.isAscended ?? false)}
                    {char.isAscended ? ' (+1)' : ''}
                  </Text>
                </View>

                {essenceList.length === 0 ? (
                  <Text style={S.emptyEquip}>
                    {lang === 'es' ? 'Sin esencias — derrota monstruos' : 'No essences — defeat monsters'}
                  </Text>
                ) : (
                  essenceList.map(e => {
                    const essenceColor =
                      e.rank === 1 ? '#FFB000'
                      : e.rank === 2 ? '#AAFF00'
                      : 'rgba(0,255,65,0.8)';
                    return (
                      <View key={e.id} style={S.itemRow}>
                        <View style={S.itemInfo}>
                          <Text style={[S.itemName, { color: essenceColor }]}>
                            {e.definitionId} · Rk{e.rank}
                          </Text>
                          <Text style={S.itemMeta}>
                            {lang === 'es' ? `Evolución ${e.evolutionLevel}/3` : `Evolution ${e.evolutionLevel}/3`}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            if (e.equipped) {
                              unequipEssence(e.id);
                            } else {
                              const slots = getEssenceSlots(char.level, char.isAscended ?? false);
                              const equipped = getEquippedCount(activeGameId, char.name);
                              if (equipped >= slots) {
                                Alert.alert(
                                  lang === 'es' ? 'Sin slots' : 'No slots',
                                  lang === 'es' ? 'No hay slots disponibles' : 'No available slots',
                                );
                                return;
                              }
                              equipEssence(e.id, char.name, activeGameId);
                            }
                            refreshEssences();
                          }}
                        >
                          <Text style={e.equipped ? S.equippedBadge : S.equipBtn}>
                            {e.equipped
                              ? (lang === 'es' ? 'DESEQUIPAR' : 'UNEQUIP')
                              : (lang === 'es' ? 'EQUIPAR' : 'EQUIP')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────

const S = StyleSheet.create({

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,255,65,0.2)',
  },
  backBtn: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 13,
    color: 'rgba(0,255,65,0.6)',
    minWidth: 72,
  },
  headerTitle: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 11,
    color: '#00FF41',
    letterSpacing: 1,
    textAlign: 'center',
    flex: 1,
  },
  navArrows: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 72,
    justifyContent: 'flex-end',
  },
  navArrow: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 22,
    color: 'rgba(0,255,65,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  navArrowDisabled: {
    color: 'rgba(0,255,65,0.18)',
  },
  navCount: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 10,
    color: 'rgba(0,255,65,0.4)',
    marginHorizontal: 2,
  },

  // Portrait
  portraitPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,255,65,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  portraitInit: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 80,
    color: 'rgba(0,255,65,0.12)',
  },
  generatePortraitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.35)',
    backgroundColor: 'rgba(0,255,65,0.04)',
  },
  generatePortraitBtnText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 11,
    color: 'rgba(0,255,65,0.75)',
    letterSpacing: 1.5,
  },
  expandHint: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.25)',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandHintText: {
    fontSize: 14,
    color: 'rgba(0,255,65,0.5)',
  },

  // Portrait bottom overlay
  portraitOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(3,8,3,0.88)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,255,65,0.2)',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 7,
  },
  statusBadge: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 9,
    letterSpacing: 3,
    marginRight: 10,
  },
  statusLine: {
    flex: 1,
    height: 1,
    opacity: 0.2,
  },
  portraitName: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 24,
    color: '#00FF41',
    letterSpacing: 2,
    marginBottom: 2,
  },
  portraitSub: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 12,
    color: 'rgba(255,176,0,0.8)',
    marginBottom: 10,
  },
  hpRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hpLabel: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    letterSpacing: 1,
    marginRight: 8,
    width: 20,
  },
  hpBarBg: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(0,255,65,0.08)',
  },
  hpBarFill: {
    height: 5,
  },
  hpNumbers: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    marginLeft: 8,
    width: 52,
    textAlign: 'right',
  },

  // Expression strip
  exprStrip: {
    backgroundColor: 'rgba(2,12,2,0.97)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,255,65,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  exprStripLabel: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 8,
    color: 'rgba(0,255,65,0.3)',
    letterSpacing: 2,
    marginBottom: 8,
  },
  exprStripDivider: {
    height: 1,
    backgroundColor: 'rgba(0,255,65,0.1)',
    marginBottom: 8,
  },
  exprBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  exprBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.2)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  exprBtnActive: {
    borderColor: 'rgba(0,229,255,0.85)',
    backgroundColor: 'rgba(0,229,255,0.08)',
  },
  exprBtnDisabled: {
    opacity: 0.2,
  },
  exprBtnText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    color: 'rgba(0,255,65,0.55)',
    letterSpacing: 1,
  },
  exprBtnTextActive: {
    color: 'rgba(0,229,255,0.95)',
  },

  // Body
  body: {
    paddingHorizontal: 14,
    backgroundColor: '#010a01',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,255,65,0.08)',
  },
  metaTag: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 10,
    color: 'rgba(0,229,255,0.45)',
    letterSpacing: 0.5,
  },
  metaSep: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 10,
    color: 'rgba(0,255,65,0.2)',
    marginHorizontal: 8,
  },

  // Section
  section: {
    marginTop: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0,255,65,0.12)',
  },
  sectionLabel: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 9,
    color: 'rgba(0,255,65,0.35)',
    letterSpacing: 2,
    marginHorizontal: 10,
  },

  // Stat bars card
  statBarsCard: {
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.12)',
    backgroundColor: 'rgba(0,255,65,0.02)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statBarLeft: {
    width: 90,
    marginRight: 10,
  },
  statBarShort: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 11,
    color: 'rgba(255,176,0,0.85)',
    letterSpacing: 1,
  },
  statBarLabel: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 8,
    color: 'rgba(0,255,65,0.3)',
    marginTop: 1,
  },
  statBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: 'rgba(0,255,65,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.15)',
    marginRight: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    backgroundColor: 'rgba(0,255,65,0.5)',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  statBarTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  statBarValue: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 14,
    color: '#00FF41',
    width: 26,
    textAlign: 'right',
    marginRight: 6,
  },
  statBarMod: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 11,
    color: 'rgba(0,229,255,0.7)',
    width: 28,
    textAlign: 'right',
  },

  // Features
  featureRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,255,65,0.06)',
  },
  featureKey: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    color: 'rgba(0,229,255,0.6)',
    width: 110,
    marginRight: 8,
  },
  featureVal: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 10,
    color: 'rgba(0,255,65,0.6)',
    flex: 1,
    lineHeight: 15,
  },

  // Meta chip
  metaChip: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 10,
    color: 'rgba(0,255,65,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },

  // Tab switcher
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,255,65,0.15)',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#00FF41',
  },
  tabBtnText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 11,
    color: 'rgba(0,255,65,0.4)',
    letterSpacing: 1,
  },
  tabBtnTextActive: {
    color: '#00FF41',
  },

  // Equipment tab
  emptyEquip: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 13,
    color: 'rgba(0,255,65,0.35)',
    textAlign: 'center',
    paddingVertical: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,255,65,0.08)',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 13,
    color: '#00FF41',
  },
  itemMeta: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 10,
    color: 'rgba(0,255,65,0.45)',
    marginTop: 2,
  },
  equippedBadge: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 9,
    color: '#FFB000',
    borderWidth: 1,
    borderColor: '#FFB000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    letterSpacing: 1,
  },
  equipBtn: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 9,
    color: 'rgba(0,255,65,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    letterSpacing: 1,
  },
  essenceSlotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  essenceSlotLabel: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 10,
    color: 'rgba(0,255,65,0.5)',
    letterSpacing: 1,
  },
  essenceSlotValue: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 12,
    color: 'rgba(0,255,65,0.9)',
    letterSpacing: 1,
  },

  // ── Moral risk banner (UI-GAP-03) ──
  moralRiskBanner: {
    borderWidth: 1,
    borderColor: 'rgba(255,62,62,0.6)',
    borderRadius: 3,
    padding: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  moralRiskText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 11,
    color: '#FF3E3E',
    flexShrink: 1,
  },
  moraleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  moraleBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(0,255,65,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  moraleBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  moraleValue: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 11,
    color: 'rgba(0,255,65,0.6)',
    width: 48,
    textAlign: 'right',
  },
});

