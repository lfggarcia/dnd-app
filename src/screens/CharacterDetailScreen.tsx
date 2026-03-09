import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { EXPRESSION_PRESETS } from '../services/geminiImageService';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import type { Stats } from '../database/gameRepository';
import type { ScreenProps } from '../navigation/types';

// ─── Constants ────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width;
const PORTRAIT_H = Math.round(SCREEN_W * 1.1);

const EXPRESSION_KEYS = Object.keys(EXPRESSION_PRESETS) as string[];

const EXPR_LABEL: Record<string, { es: string; en: string }> = {
  neutral:   { es: 'Neutral',   en: 'Neutral'   },
  happy:     { es: 'Contento',  en: 'Happy'     },
  angry:     { es: 'Ira',       en: 'Angry'     },
  sad:       { es: 'Triste',    en: 'Sad'       },
  surprised: { es: 'Sorpresa',  en: 'Surprised' },
  wounded:   { es: 'Herido',    en: 'Wounded'   },
};

const STAT_KEYS: (keyof Stats)[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

const STAT_LABELS_ES: Record<keyof Stats, string> = {
  STR: 'FUE', DEX: 'DES', CON: 'CON', INT: 'INT', WIS: 'SAB', CHA: 'CAR',
};

const STAT_FULL_ES: Record<keyof Stats, string> = {
  STR: 'Fuerza', DEX: 'Destreza', CON: 'Constitución',
  INT: 'Inteligencia', WIS: 'Sabiduría', CHA: 'Carisma',
};

const STAT_FULL_EN: Record<keyof Stats, string> = {
  STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution',
  INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma',
};

function statMod(val: number): string {
  const mod = Math.floor((val - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// ─── Screen ───────────────────────────────────────────────

export const CharacterDetailScreen = ({ navigation, route }: ScreenProps<'CharacterDetail'>) => {
  const { charIndex } = route.params;
  const { lang } = useI18n();

  const activeGame = useGameStore(s => s.activeGame);
  const party = useMemo(() => activeGame?.partyData ?? [], [activeGame]);
  const expressionsJson = activeGame?.expressionsJson ?? {};

  const [selectedExpression, setSelectedExpression] = useState('neutral');

  const char = party[charIndex];
  const expressions = expressionsJson[charIndex] ?? null;

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

  // Prev / Next character navigation
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

      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={S.backBtn}>{'<'} {lang === 'es' ? 'VOLVER' : 'BACK'}</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>
          {lang === 'es' ? 'FICHA DE PERSONAJE' : 'CHARACTER SHEET'}
        </Text>
        {/* Prev / Next arrows */}
        <View style={S.navArrows}>
          <TouchableOpacity
            disabled={!hasPrev}
            onPress={() => navigation.replace('CharacterDetail', { charIndex: charIndex - 1 })}
            activeOpacity={0.6}
          >
            <Text style={[S.navArrow, !hasPrev && S.navArrowDisabled]}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={S.navCount}>{charIndex + 1}/{party.length}</Text>
          <TouchableOpacity
            disabled={!hasNext}
            onPress={() => navigation.replace('CharacterDetail', { charIndex: charIndex + 1 })}
            activeOpacity={0.6}
          >
            <Text style={[S.navArrow, !hasNext && S.navArrowDisabled]}>{'>'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Portrait Panel ── */}
        <View style={{ width: SCREEN_W, height: PORTRAIT_H }}>
          {activePortraitUri ? (
            <Image
              source={{ uri: activePortraitUri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View style={S.portraitPlaceholder}>
              <Text style={S.portraitInit}>{char.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {/* Gradient overlay at top: decorative scan line */}
          <View style={S.portraitScanLine} />
          {/* Info overlay at bottom */}
          <View style={S.portraitOverlay}>
            <View style={S.portraitOverlayRow}>
              <View style={{ flex: 1 }}>
                <Text style={S.portraitName}>{char.name.toUpperCase()}</Text>
                <Text style={S.portraitClass}>
                  {char.race}  ·  {char.charClass}{char.subclass ? ` (${char.subclass})` : ''}
                </Text>
                <Text style={S.portraitMeta}>{char.background}  ·  {char.alignment}</Text>
              </View>
              <View>
                <Text style={[S.statusBadge, { color: hpColor, borderColor: hpColor }]}>
                  {statusLabel}
                </Text>
              </View>
            </View>
            {/* HP bar inside overlay */}
            <View style={S.hpRow}>
              <Text style={[S.hpLabel, { color: hpColor }]}>HP</Text>
              <View style={S.hpBarBg}>
                <View style={[S.hpBarFill, {
                  width: `${Math.round(hpPct * 100)}%`,
                  backgroundColor: hpColor,
                }]} />
              </View>
              <Text style={[S.hpNumbers, { color: hpColor }]}>{char.hp}/{char.maxHp}</Text>
            </View>
          </View>
        </View>

        {/* ── Body content ── */}
        <View style={S.body}>

          {/* ── Ability Scores ── */}
          <View style={S.section}>
            <Text style={S.sectionLabel}>
              {lang === 'es' ? '─ PUNTUACIONES DE CARACTERÍSTICA ─' : '─ ABILITY SCORES ─'}
            </Text>
            <View style={S.statsGrid}>
              {STAT_KEYS.map(key => (
                <View key={key} style={S.statCell}>
                  <Text style={S.statFullName}>
                    {lang === 'es' ? STAT_FULL_ES[key] : STAT_FULL_EN[key]}
                  </Text>
                  <View style={S.statBox}>
                    <Text style={S.statModText}>{statMod(char.baseStats[key])}</Text>
                    <View style={S.statDivider} />
                    <Text style={S.statValueText}>{char.baseStats[key]}</Text>
                  </View>
                  <Text style={S.statKeyLabel}>
                    {lang === 'es' ? STAT_LABELS_ES[key] : key}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Expressions ── */}
          {hasExpressions && (
            <View style={S.section}>
              <Text style={S.sectionLabel}>
                {lang === 'es' ? '─ EXPRESIONES ─' : '─ EXPRESSIONS ─'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {EXPRESSION_KEYS.map(key => {
                  const isActive = selectedExpression === key;
                  const hasVariant = !!expressions?.[key];
                  const label = EXPR_LABEL[key]?.[lang === 'es' ? 'es' : 'en'] ?? key;
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setSelectedExpression(key)}
                      style={[
                        S.exprPill,
                        isActive && S.exprPillActive,
                        !hasVariant && S.exprPillDisabled,
                      ]}
                      disabled={!hasVariant}
                      activeOpacity={0.7}
                    >
                      <Text style={[S.exprPillText, isActive && S.exprPillTextActive]}>
                        {label.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ── Feature Choices ── */}
          {Object.keys(char.featureChoices).length > 0 && (
            <View style={S.section}>
              <Text style={S.sectionLabel}>
                {lang === 'es' ? '─ RASGOS Y HABILIDADES ─' : '─ FEATURES & TRAITS ─'}
              </Text>
              {Object.entries(char.featureChoices).map(([k, v]) => (
                <View key={k} style={S.featureRow}>
                  <Text style={S.featureKey}>{k}</Text>
                  <Text style={S.featureVal}>{Array.isArray(v) ? v.join(', ') : v}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Combat details (stat method) ── */}
          <View style={S.section}>
            <Text style={S.sectionLabel}>
              {lang === 'es' ? '─ GENERACIÓN DE ESTADÍSTICAS ─' : '─ STAT GENERATION ─'}
            </Text>
            <Text style={S.metaChip}>
              {char.statMethod === 'standard'
                ? (lang === 'es' ? 'Puntuación estándar [Standard Array]' : 'Standard Array')
                : (lang === 'es' ? 'Tirada de dados [Rolled]' : 'Rolled Stats')}
            </Text>
          </View>

        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────

const S = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,255,65,0.2)',
  },
  backBtn: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 11,
    color: 'rgba(0,255,65,0.6)',
    minWidth: 70,
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
    minWidth: 70,
    justifyContent: 'flex-end',
  },
  navArrow: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 14,
    color: 'rgba(0,255,65,0.7)',
    paddingHorizontal: 6,
  },
  navArrowDisabled: {
    color: 'rgba(0,255,65,0.2)',
  },
  navCount: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 9,
    color: 'rgba(0,255,65,0.4)',
    marginHorizontal: 2,
  },

  // Portrait
  portraitPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,255,65,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitInit: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 72,
    color: 'rgba(0,255,65,0.15)',
  },
  portraitScanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(0,255,65,0.12)',
  },
  portraitOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(6,12,6,0.88)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,255,65,0.25)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  portraitOverlayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  portraitName: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 20,
    color: '#00FF41',
    letterSpacing: 2,
    marginBottom: 2,
  },
  portraitClass: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 12,
    color: 'rgba(255,176,0,0.85)',
    marginBottom: 2,
  },
  portraitMeta: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 10,
    color: 'rgba(0,229,255,0.5)',
  },
  statusBadge: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 9,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    letterSpacing: 2,
    marginTop: 4,
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
    height: 6,
    backgroundColor: 'rgba(0,255,65,0.1)',
  },
  hpBarFill: {
    height: 6,
  },
  hpNumbers: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    marginLeft: 8,
    width: 50,
    textAlign: 'right',
  },

  // Body
  body: {
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 22,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,255,65,0.1)',
  },
  sectionLabel: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 9,
    color: 'rgba(0,255,65,0.3)',
    letterSpacing: 2,
    marginBottom: 14,
  },

  // Stats grid — 3 columns × 2 rows
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  statCell: {
    width: '31%',
    alignItems: 'center',
  },
  statFullName: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 7,
    color: 'rgba(0,255,65,0.25)',
    marginBottom: 5,
    textAlign: 'center',
  },
  statBox: {
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.35)',
    backgroundColor: 'rgba(0,255,65,0.04)',
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
  },
  statModText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 20,
    color: 'rgba(255,176,0,0.9)',
  },
  statDivider: {
    width: '60%',
    height: 1,
    backgroundColor: 'rgba(0,255,65,0.15)',
    marginVertical: 4,
  },
  statValueText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 12,
    color: 'rgba(0,255,65,0.6)',
  },
  statKeyLabel: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    color: 'rgba(0,255,65,0.45)',
    marginTop: 5,
    letterSpacing: 1,
  },

  // Expressions
  exprPill: {
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  exprPillActive: {
    borderColor: 'rgba(0,229,255,0.8)',
    backgroundColor: 'rgba(0,229,255,0.08)',
  },
  exprPillDisabled: {
    opacity: 0.3,
  },
  exprPillText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 9,
    color: 'rgba(0,255,65,0.5)',
    letterSpacing: 1,
  },
  exprPillTextActive: {
    color: 'rgba(0,229,255,0.9)',
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
    color: 'rgba(0,255,65,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
});
