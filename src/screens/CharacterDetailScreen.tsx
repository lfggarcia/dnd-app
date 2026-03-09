import React, { useMemo, useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
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
import { EXPRESSION_PRESETS } from '../services/geminiImageService';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import type { Stats } from '../database/gameRepository';
import type { ScreenProps } from '../navigation/types';

// ─── Constants ────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width;
const PORTRAIT_H = Math.round(SCREEN_W * 1.35);

const EXPRESSION_KEYS = Object.keys(EXPRESSION_PRESETS) as string[];

const EXPR_LABELS: Record<string, { es: string; en: string }> = {
  neutral:   { es: 'NEUTRO', en: 'NEUTRAL' },
  happy:     { es: 'FELIZ',  en: 'HAPPY'   },
  angry:     { es: 'IRA',    en: 'ANGRY'   },
  sad:       { es: 'TRISTE', en: 'SAD'     },
  surprised: { es: 'SORPR',  en: 'SURPR'   },
  wounded:   { es: 'HERIDO', en: 'WOUNDED' },
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

  const activeGame = useGameStore(s => s.activeGame);
  const party = useMemo(() => activeGame?.partyData ?? [], [activeGame]);
  const expressionsJson = activeGame?.expressionsJson ?? {};

  const [selectedExpression, setSelectedExpression] = useState('neutral');
  const [fullscreenUri, setFullscreenUri] = useState<string | null>(null);

  const char = party[charIndex];
  const expressions = expressionsJson[charIndex] ?? null;

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

  const hpPct = char ? (char.maxHp > 0 ? char.hp / char.maxHp : 0) : 0;
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

  const activePortraitUri = expressions?.[selectedExpression]
    ?? expressions?.['neutral']
    ?? char?.portrait
    ?? null;

  const hasExpressions = !!expressions && Object.keys(expressions).length > 0;

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
          onPress={() => activePortraitUri && setFullscreenUri(activePortraitUri)}
          style={{ width: SCREEN_W, height: PORTRAIT_H, backgroundColor: '#010a01' }}
        >
          {activePortraitUri ? (
            <>
              <Animated.Image
                source={{ uri: activePortraitUri }}
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
            </View>
          )}

          {/* Expand hint */}
          {activePortraitUri && (
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
            <Text style={S.portraitName}>{char.name.toUpperCase()}</Text>
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
                const hasVariant = !!expressions?.[key];
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

        {/* ── Body ── */}
        <View style={S.body}>

          {/* ── Meta info ── */}
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
  },
  portraitInit: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 80,
    color: 'rgba(0,255,65,0.12)',
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
});
