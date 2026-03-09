import React, { useMemo, memo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  ClipPath,
  Polygon,
  Image as SvgImage,
  Rect,
  Line,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { PortraitDetailModal } from '../components/party/PortraitDetailModal';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import type { CharacterSave } from '../database/gameRepository';
import type { ScreenProps } from '../navigation/types';

// ─── Dimensions ───────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const STRIP_H  = Math.min(Math.round(SCREEN_H * 0.62), 520);
// Diagonal offset in pixels — how far the cut "leans" top→bottom
const SLANT = 20;
// Per-character accent colours (CRT palette: green, amber, red, cyan)
const STRIP_ACCENTS = ['#00FF41', '#FFB000', '#FF3E3E', '#4DBBFF'] as const;

// ─── Diagonal Panel ───────────────────────────────────────

type DiagPanelProps = {
  char: CharacterSave;
  uri: string | null;
  accent: string;
  idx: number;
  total: number;
  onPress: () => void;
  onLongPress: () => void;
};

const DiagonalPanel = memo(({
  char, uri, accent, idx, total, onPress, onLongPress,
}: DiagPanelProps) => {
  const W = SCREEN_W / total;

  // ── Clip polygon coords ──────────────────────────────────
  // Each panel is a trapezoid; dividers lean right (top-inset, bottom-outset).
  const xl_top = idx === 0          ? 0          : idx * W - SLANT;
  const xl_bot = idx === 0          ? 0          : idx * W + SLANT;
  const xr_top = idx === total - 1  ? SCREEN_W   : (idx + 1) * W - SLANT;
  const xr_bot = idx === total - 1  ? SCREEN_W   : (idx + 1) * W + SLANT;
  const clipPts = `${xl_top},0 ${xr_top},0 ${xr_bot},${STRIP_H} ${xl_bot},${STRIP_H}`;

  // Unique IDs per panel (SVG defs must be unique across the whole document)
  const safeName = char.name.replace(/[^a-zA-Z0-9]/g, '');
  const cpId   = `cp${idx}${safeName}`;
  const gradId = `gr${idx}${safeName}`;

  // ── HP ───────────────────────────────────────────────────
  const hpPct   = char.maxHp > 0 ? char.hp / char.maxHp : 0;
  const hpColor = !char.alive
    ? '#FF3E3E'
    : hpPct > 0.5 ? '#00FF41' : hpPct > 0.25 ? '#FFB000' : '#FF3E3E';

  // ── Image rect inside SVG (slightly wider than panel to let slice fill) ──
  const imgX = idx * W - W * 0.1;
  const imgW = W * 1.2;

  // ── Reanimated entrance (slide-up + fade, staggered by idx) ──
  const translateY = useSharedValue(STRIP_H * 0.28);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    const delay = idx * 110;
    translateY.value = withDelay(delay, withTiming(0, {
      duration: 620,
      easing: Easing.out(Easing.cubic),
    }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // ── Name band geometry (bottom of panel, aligned to diagonal edges) ──
  const BAND_H = 52;
  const bandX = xl_bot;
  const bandW = xr_bot - xl_bot;

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, aStyle]} pointerEvents="box-none">
      {/* ── SVG: portrait + clip + gradient ── */}
      <Svg width={SCREEN_W} height={STRIP_H}>
        <Defs>
          <ClipPath id={cpId}>
            <Polygon points={clipPts} />
          </ClipPath>

          {/* Dark-to-accent bottom gradient */}
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.4"  stopColor="#010a01" stopOpacity="0" />
            <Stop offset="0.82" stopColor="#010a01" stopOpacity="0.75" />
            <Stop offset="1"    stopColor="#010a01" stopOpacity="0.97" />
          </LinearGradient>
        </Defs>

        {/* Dark background tinted with accent */}
        <Rect
          x={0} y={0} width={SCREEN_W} height={STRIP_H}
          fill={`${accent}0D`}
          clipPath={`url(#${cpId})`}
        />

        {/* Portrait */}
        {uri ? (
          <SvgImage
            href={uri}
            x={imgX} y={0}
            width={imgW} height={STRIP_H}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${cpId})`}
          />
        ) : (
          /* Placeholder with large initial */
          <SvgText
            x={(xl_top + xr_top) / 2}
            y={STRIP_H * 0.5 + 18}
            fill={`${accent}22`}
            fontSize={64}
            fontWeight="bold"
            textAnchor="middle"
            clipPath={`url(#${cpId})`}
          >
            {char.name.charAt(0).toUpperCase()}
          </SvgText>
        )}

        {/* Bottom gradient fade (simulates vignette / BG removal) */}
        <Rect
          x={0} y={0} width={SCREEN_W} height={STRIP_H}
          fill={`url(#${gradId})`}
          clipPath={`url(#${cpId})`}
        />

        {/* Dead overlay */}
        {!char.alive && (
          <Rect
            x={0} y={0} width={SCREEN_W} height={STRIP_H}
            fill="rgba(0,0,0,0.55)"
            clipPath={`url(#${cpId})`}
          />
        )}

        {/* ── Top accent bar ── */}
        <Rect
          x={xl_top} y={0}
          width={xr_top - xl_top} height={3}
          fill={accent}
        />

        {/* ── HP bar (just above name band) ── */}
        <Rect
          x={bandX} y={STRIP_H - BAND_H - 3}
          width={bandW} height={2}
          fill="rgba(255,255,255,0.08)"
        />
        <Rect
          x={bandX} y={STRIP_H - BAND_H - 3}
          width={bandW * hpPct} height={2}
          fill={hpColor}
        />

        {/* ── Diagonal divider line (right edge, accent colour) ── */}
        {idx < total - 1 && (
          <Line
            x1={xr_top} y1={0}
            x2={xr_bot} y2={STRIP_H}
            stroke={`${accent}60`}
            strokeWidth={1.5}
          />
        )}

        {/* ── Decorative rotated class text (manga background typography) ── */}
        <SvgText
          x={(xl_top + xr_top) / 2}
          y={STRIP_H * 0.52}
          fill={`${accent}12`}
          fontSize={Math.max(18, Math.min(W * 0.28, 32))}
          fontWeight="bold"
          textAnchor="middle"
          transform={`rotate(-90, ${(xl_top + xr_top) / 2}, ${STRIP_H * 0.52})`}
          clipPath={`url(#${cpId})`}
        >
          {char.charClass.toUpperCase()}
        </SvgText>
      </Svg>

      {/* ── Name band (RN Text for font support) ── */}
      <View
        style={[S.panelBand, {
          left:   bandX,
          width:  bandW,
          bottom: 0,
          height: BAND_H,
        }]}
        pointerEvents="none"
      >
        <Text
          style={[S.panelName, { color: accent }]}
          numberOfLines={1}
        >
          {char.name.toUpperCase()}
        </Text>
        <Text style={S.panelClass} numberOfLines={1}>
          {char.charClass}
        </Text>
      </View>

      {/* ── Touch area (nominal panel width; rectangular approximation) ── */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          left: idx * W,
          top: 0,
          width: W,
          height: STRIP_H,
        }}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.82}
      />
    </Animated.View>
  );
});

// ─── Manga Collage ────────────────────────────────────────

type CollageProps = {
  party: CharacterSave[];
  expressionsJson: Record<number, Record<string, string>>;
  onCharPress: (idx: number) => void;
  onCharLongPress: (uri: string) => void;
};

const MangaCollage = memo(({ party, expressionsJson, onCharPress, onCharLongPress }: CollageProps) => {
  if (party.length === 0) return null;
  const n = party.length;

  return (
    <View style={{ width: SCREEN_W, height: STRIP_H }}>
      {party.map((char, i) => {
        const expressions = expressionsJson[i] ?? null;
        const uri = expressions?.['neutral'] ?? char.portrait ?? null;
        return (
          <DiagonalPanel
            key={`${char.name}-${i}`}
            char={char}
            uri={uri}
            accent={STRIP_ACCENTS[i % STRIP_ACCENTS.length]}
            idx={i}
            total={n}
            onPress={() => onCharPress(i)}
            onLongPress={() => { if (uri) onCharLongPress(uri); }}
          />
        );
      })}
    </View>
  );
});

// ─── Main Screen ──────────────────────────────────────────

export const GuildScreen = ({ navigation }: ScreenProps<'Guild'>) => {
  const { t, lang } = useI18n();
  const activeGame = useGameStore(s => s.activeGame);

  const party        = useMemo(() => activeGame?.partyData ?? [], [activeGame]);
  const aliveCount   = useMemo(() => party.filter(c => c.alive).length, [party]);
  const expressionsJson = activeGame?.expressionsJson ?? {};

  const [modalUri, setModalUri] = useState<string | null>(null);

  const handleCharPress     = useCallback((idx: number) => {
    navigation.navigate('CharacterDetail', { charIndex: idx });
  }, [navigation]);

  const handleCharLongPress = useCallback((uri: string) => {
    setModalUri(uri);
  }, []);

  const handlePortraitClose = useCallback(() => setModalUri(null), []);

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />

      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={S.backBtn}>{'<'} {t('common.back').toUpperCase()}</Text>
        </TouchableOpacity>
        <Text style={S.title}>{t('guild.title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Manga Collage ── */}
        {party.length > 0 ? (
          <View style={S.collageSection}>
            {/* Section header row */}
            <View style={S.collageTitleRow}>
              <View>
                <Text style={S.collageTitle}>{t('guild.partyRoster').toUpperCase()}</Text>
                <Text style={S.collageSub}>
                  {aliveCount}/{party.length} {t('common.active').toLowerCase()}
                  {'  ·  '}{lang === 'es' ? 'Toca para ver ficha' : 'Tap for character sheet'}
                </Text>
              </View>
              {/* Decorative bracket */}
              <Text style={S.collageDecor}>[{aliveCount}]</Text>
            </View>

            <MangaCollage
              party={party}
              expressionsJson={expressionsJson}
              onCharPress={handleCharPress}
              onCharLongPress={handleCharLongPress}
            />

            {/* Party metadata strip */}
            <View style={S.partyMetaStrip}>
              <Text style={S.partyMetaText}>
                {lang === 'es'
                  ? 'GRUPO ACTIVO — CAMPAÑA EN CURSO'
                  : 'ACTIVE PARTY — CAMPAIGN IN PROGRESS'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <View style={S.emptyBox}>
              <Text style={S.emptyText}>{t('guild.noParty')}</Text>
            </View>
          </View>
        )}

        {/* ── Guild description ── */}
        <View style={S.contentPad}>
          <View style={S.descBox}>
            <Text style={S.descText}>{t('guild.description')}</Text>
          </View>

          {/* ── Guild Options ── */}
          <Text style={S.sectionTitle}>{t('guild.options')}</Text>

          <TouchableOpacity style={S.optionBtn} activeOpacity={0.7}>
            <View style={S.optionIconBox}>
              <Text style={S.optionIconText}>RNK</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.optionTitle}>{t('village.viewRankings')}</Text>
              <Text style={S.optionDesc}>{t('guild.rankingsDesc')}</Text>
            </View>
            <Text style={S.optionArrow}>&gt;</Text>
          </TouchableOpacity>

          <TouchableOpacity style={S.optionBtn} activeOpacity={0.7}>
            <View style={S.optionIconBox}>
              <Text style={S.optionIconText}>MIS</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.optionTitle}>{t('village.bountyBoard')}</Text>
              <Text style={S.optionDesc}>{t('guild.bountyDesc')}</Text>
            </View>
            <Text style={S.optionArrow}>&gt;</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={S.optionBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('WorldLog')}
          >
            <View style={S.optionIconBox}>
              <Text style={S.optionIconText}>LOG</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.optionTitle}>{t('village.viewWorldLog')}</Text>
              <Text style={S.optionDesc}>{t('guild.worldLogDesc')}</Text>
            </View>
            <Text style={S.optionArrow}>&gt;</Text>
          </TouchableOpacity>

          {/* Level-up notice */}
          <View style={S.noticeBox}>
            <Text style={S.noticeTitle}>[!] {t('guild.levelUpNotice')}</Text>
            <Text style={S.noticeText}>{t('guild.levelUpDesc')}</Text>
          </View>
        </View>
      </ScrollView>

      <GlossaryButton />
      <PortraitDetailModal uri={modalUri} onClose={handlePortraitClose} />
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
  },
  title: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 14,
    color: '#00FF41',
    textAlign: 'center',
  },

  // ── Collage section ──
  collageSection: {
    marginBottom: 4,
  },
  collageTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  collageTitle: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 13,
    color: '#00FF41',
    letterSpacing: 1,
  },
  collageSub: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 9,
    color: 'rgba(0,255,65,0.35)',
    marginTop: 2,
  },
  collageDecor: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 28,
    color: 'rgba(0,255,65,0.12)',
    lineHeight: 32,
  },

  // ── Panel name band (RN Text layer over SVG) ──
  panelBand: {
    position: 'absolute',
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 7,
    justifyContent: 'flex-end',
  },
  panelName: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  panelClass: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 8,
    color: 'rgba(255,176,0,0.5)',
    letterSpacing: 0.5,
  },

  partyMetaStrip: {
    backgroundColor: 'rgba(0,255,65,0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,255,65,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  partyMetaText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 8,
    color: 'rgba(0,255,65,0.25)',
    letterSpacing: 2,
  },

  // Content padding wrapper
  contentPad: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Guild description
  descBox: {
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.15)',
    padding: 12,
    marginBottom: 20,
    backgroundColor: 'rgba(0,255,65,0.03)',
  },
  descText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 10,
    color: 'rgba(0,255,65,0.5)',
    lineHeight: 16,
  },

  // Section title
  sectionTitle: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 13,
    color: '#00FF41',
    marginBottom: 12,
  },

  // Empty state
  emptyBox: {
    borderWidth: 1,
    borderColor: 'rgba(255,62,62,0.3)',
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 11,
    color: 'rgba(255,62,62,0.6)',
  },

  // Options
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.2)',
    padding: 14,
    marginBottom: 8,
    backgroundColor: 'rgba(26,31,26,0.5)',
  },
  optionIconBox: {
    width: 36,
    height: 28,
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.3)',
    backgroundColor: 'rgba(0,255,65,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionIconText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 9,
    color: 'rgba(0,255,65,0.7)',
    letterSpacing: 1,
  },
  optionTitle: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 12,
    color: '#00FF41',
  },
  optionDesc: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 10,
    color: 'rgba(0,255,65,0.4)',
    marginTop: 2,
  },
  optionArrow: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 13,
    color: 'rgba(0,255,65,0.3)',
    marginLeft: 8,
  },

  // Notice
  noticeBox: {
    borderWidth: 1,
    borderColor: 'rgba(255,176,0,0.3)',
    borderLeftWidth: 3,
    backgroundColor: 'rgba(255,176,0,0.05)',
    padding: 12,
    marginTop: 16,
  },
  noticeTitle: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 11,
    color: 'rgba(255,176,0,0.9)',
    marginBottom: 4,
  },
  noticeText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 10,
    color: 'rgba(255,176,0,0.5)',
    lineHeight: 16,
  },
});
