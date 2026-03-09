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
const CELL_W = (SCREEN_W - 2) / 2;   // 2 columns with 2px gap
const CELL_H = Math.round(CELL_W * 1.4);
const GAP = 2;

// ─── Party Collage Cell ───────────────────────────────────

type CellProps = {
  char: CharacterSave;
  portraitUri: string | null;
  onPress: () => void;
  onLongPress: () => void;
};

const CollageCell = memo(({ char, portraitUri, onPress, onLongPress }: CellProps) => {
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
      style={[S.cell, { width: CELL_W, height: CELL_H }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
    >
      {/* Portrait */}
      {portraitUri ? (
        <Image source={{ uri: portraitUri }} style={S.cellImage} resizeMode="cover" />
      ) : (
        <View style={S.cellPlaceholder}>
          <Text style={S.cellPlaceholderText}>{char.name.charAt(0).toUpperCase()}</Text>
        </View>
      )}

      {/* Dead overlay */}
      {!char.alive && <View style={S.deadOverlay} />}

      {/* Bottom info band */}
      <View style={S.cellInfoBand}>
        <View style={S.cellInfoRow}>
          <Text style={S.cellName} numberOfLines={1}>{char.name}</Text>
          <View style={[S.statusDot, { backgroundColor: hpColor }]} />
        </View>
        <Text style={S.cellSub} numberOfLines={1}>
          {char.race} · {char.charClass}
        </Text>
        {/* HP bar */}
        <View style={S.cellHpBg}>
          <View style={[S.cellHpFill, {
            width: `${Math.round(hpPct * 100)}%`,
            backgroundColor: hpColor,
          }]} />
        </View>
      </View>

      {/* Tap cue */}
      <View style={S.tapHint}>
        <Text style={S.tapHintText}>[ → ]</Text>
      </View>
    </TouchableOpacity>
  );
});

// ─── Party Collage Grid ───────────────────────────────────

type CollageProps = {
  party: CharacterSave[];
  expressionsJson: Record<number, Record<string, string>>;
  onCharPress: (idx: number) => void;
  onCharLongPress: (uri: string) => void;
};

const PartyCollage = memo(({ party, expressionsJson, onCharPress, onCharLongPress }: CollageProps) => {
  if (party.length === 0) return null;

  return (
    <View style={S.collageGrid}>
      {party.map((char, i) => {
        const expressions = expressionsJson[i] ?? null;
        const portraitUri = expressions?.['neutral'] ?? char.portrait ?? null;
        return (
          <CollageCell
            key={`${char.name}-${i}`}
            char={char}
            portraitUri={portraitUri}
            onPress={() => onCharPress(i)}
            onLongPress={() => { if (portraitUri) onCharLongPress(portraitUri); }}
          />
        );
      })}
      {/* Filler cell if odd number so grid stays even */}
      {party.length % 2 !== 0 && (
        <View style={[S.cell, S.cellFiller, { width: CELL_W, height: CELL_H }]} />
      )}
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
  collageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: 0,
  },

  // Cell
  cell: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,255,65,0.04)',
  },
  cellFiller: {
    backgroundColor: 'transparent',
  },
  cellImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  cellPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,255,65,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.1)',
  },
  cellPlaceholderText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 40,
    color: 'rgba(0,255,65,0.15)',
  },
  deadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cellInfoBand: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(6,12,6,0.88)',
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 5,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,255,65,0.18)',
  },
  cellInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cellName: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 11,
    color: '#00FF41',
    flex: 1,
    marginRight: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cellSub: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 9,
    color: 'rgba(255,176,0,0.65)',
    marginBottom: 5,
  },
  cellHpBg: {
    height: 3,
    backgroundColor: 'rgba(0,255,65,0.1)',
  },
  cellHpFill: {
    height: 3,
  },
  tapHint: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  tapHintText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 7,
    color: 'rgba(0,255,65,0.45)',
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
