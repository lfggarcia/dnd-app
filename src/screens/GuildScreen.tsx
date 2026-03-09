import React, { useMemo, memo, useState, useCallback } from 'react';
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
import { GlossaryButton } from '../components/GlossaryModal';
import { PortraitDetailModal } from '../components/party/PortraitDetailModal';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import type { CharacterSave } from '../database/gameRepository';
import type { ScreenProps } from '../navigation/types';

// ─── Dimensions ───────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const GAP = 2;
const STRIP_H = Math.min(Math.round(SCREEN_H * 0.62), 520);
// One accent color per roster slot — gives each character a distinct identity
const STRIP_ACCENTS = ['#00FF41', '#FFB000', '#FF3E3E', '#4DBBFF'] as const;

// ─── Party Strip Cell ─────────────────────────────────────

type StripProps = {
  char: CharacterSave;
  portraitUri: string | null;
  accentColor: string;
  stripW: number;
  onPress: () => void;
  onLongPress: () => void;
};

const StripCell = memo(({ char, portraitUri, accentColor, stripW, onPress, onLongPress }: StripProps) => {
  const hpPct = char.maxHp > 0 ? char.hp / char.maxHp : 0;
  const hpColor = !char.alive
    ? '#FF3E3E'
    : hpPct > 0.5
      ? '#00FF41'
      : hpPct > 0.25
        ? '#FFB000'
        : '#FF3E3E';

  return (
    <TouchableOpacity
      style={[S.strip, { width: stripW }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
    >
      {/* Portrait */}
      {portraitUri ? (
        <Image source={{ uri: portraitUri }} style={S.stripImage} resizeMode="cover" />
      ) : (
        <View style={[S.stripPlaceholder, { borderColor: `${accentColor}22` }]}>
          <Text style={[S.stripInitial, { color: `${accentColor}33` }]}>
            {char.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      {/* Dead overlay */}
      {!char.alive && <View style={S.deadOverlay} />}

      {/* Top accent bar */}
      <View style={[S.accentTopBar, { backgroundColor: accentColor }]} />

      {/* Bottom name band */}
      <View style={[S.stripBand, { borderTopColor: `${accentColor}55` }]}>
        {/* HP bar */}
        <View style={S.stripHpBg}>
          <View style={[S.stripHpFill, {
            width: `${Math.round(hpPct * 100)}%` as any,
            backgroundColor: hpColor,
          }]} />
        </View>
        <Text style={[S.stripName, { color: accentColor }]} numberOfLines={1}>
          {char.name.toUpperCase()}
        </Text>
        <Text style={S.stripClass} numberOfLines={1}>
          {char.charClass}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ─── Party Strip Row ──────────────────────────────────────

type CollageProps = {
  party: CharacterSave[];
  expressionsJson: Record<number, Record<string, string>>;
  onCharPress: (idx: number) => void;
  onCharLongPress: (uri: string) => void;
};

const PartyCollage = memo(({ party, expressionsJson, onCharPress, onCharLongPress }: CollageProps) => {
  if (party.length === 0) return null;

  const n = party.length;
  const stripW = Math.floor((SCREEN_W - GAP * (n - 1)) / n);

  return (
    <View style={S.stripRow}>
      {party.map((char, i) => {
        const expressions = expressionsJson[i] ?? null;
        const portraitUri = expressions?.['neutral'] ?? char.portrait ?? null;
        return (
          <StripCell
            key={`${char.name}-${i}`}
            char={char}
            portraitUri={portraitUri}
            accentColor={STRIP_ACCENTS[i % STRIP_ACCENTS.length]}
            stripW={stripW}
            onPress={() => onCharPress(i)}
            onLongPress={() => { if (portraitUri) onCharLongPress(portraitUri); }}
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

  const party = useMemo(() => activeGame?.partyData ?? [], [activeGame]);
  const aliveCount = useMemo(() => party.filter(c => c.alive).length, [party]);
  const expressionsJson = activeGame?.expressionsJson ?? {};

  const [modalUri, setModalUri] = useState<string | null>(null);

  const handleCharPress = useCallback((idx: number) => {
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
        {/* ── Party Collage ── */}
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

            <PartyCollage
              party={party}
              expressionsJson={expressionsJson}
              onCharPress={handleCharPress}
              onCharLongPress={handleCharLongPress}
            />

            {/* Party metadata strip */}
            <View style={S.partyMetaStrip}>
              <Text style={S.partyMetaText}>
                {lang === 'es' ? 'GRUPO ACTIVO — CAMPAÑA EN CURSO' : 'ACTIVE PARTY — CAMPAIGN IN PROGRESS'}
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

  // Strip row (horizontal poster layout)
  stripRow: {
    flexDirection: 'row',
    gap: GAP,
  },
  strip: {
    height: STRIP_H,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,255,65,0.03)',
  },
  stripImage: {
    ...StyleSheet.absoluteFillObject,
  },
  stripPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stripInitial: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 32,
  },
  deadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  accentTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  stripBand: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(4,8,4,0.93)',
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 7,
    borderTopWidth: 1,
  },
  stripHpBg: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 5,
  },
  stripHpFill: {
    height: 2,
  },
  stripName: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  stripClass: {
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
