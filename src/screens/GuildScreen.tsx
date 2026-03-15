import React, { useMemo, memo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { AppImage } from '../components/AppImage';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { PortraitDetailModal } from '../components/party/PortraitDetailModal';
import { BountyBoard } from '../components/BountyBoard';
import { AllianceCard } from '../components/AllianceCard';
import { getAllActiveBounties } from '../services/bountyService';
import type { BountyRecord } from '../services/bountyService';
import { getActiveAlliances, terminateAlliance } from '../services/allianceService';
import type { Alliance } from '../services/allianceService';
import { getAllSavedGames } from '../database/gameRepository';
import { generateCharacterPortrait, generateCharacterExpressions } from '../services/geminiImageService';
import { savePortraitToFS, saveExpressionsToFS } from '../services/imageStorageService';
import { getCatalogPortraitForNPC, requireCatalogPortrait, hasCatalogPortraits } from '../services/characterCatalogService';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import type { CharacterSave } from '../database/gameRepository';
import type { ScreenProps } from '../navigation/types';
import { resolvePortraitSource, resolveExpressionSource, type PortraitSource } from '../utils/mapState';

// ─── Dimensions ───────────────────────────────────────────

const SCREEN_W  = Dimensions.get('window').width;
const CARD_PAD  = 12;
const CARD_GAP  = 8;
const CARD_W    = (SCREEN_W - CARD_PAD * 2 - CARD_GAP) / 2;

// Per-character accent colours (CRT palette: green, amber, red, cyan)
const STRIP_ACCENTS = ['#00FF41', '#FFB000', '#FF3E3E', '#4DBBFF'] as const;

// ─── Character Card ───────────────────────────────────────

type CardProps = {
  char: CharacterSave;
  portraitPath: string | null;
  accent: string;
  idx: number;
  generatingPortrait?: boolean;
  onPress: (idx: number) => void;
  onLongPress: (portraitPath: string) => void;
  onGeneratePortrait: (idx: number) => void;
};

const CharacterCard = memo(({ char, portraitPath, accent, idx, generatingPortrait, onPress, onLongPress, onGeneratePortrait }: CardProps) => {
  const source = useMemo<PortraitSource | null>(() =>
    resolveExpressionSource(portraitPath, 'aggressive') ??
    resolveExpressionSource(portraitPath, 'angry') ??
    resolveExpressionSource(portraitPath, 'neutral') ??
    resolvePortraitSource(portraitPath),
  [portraitPath]);

  const { hpPct, hpColor } = useMemo(() => {
    const pct = char.maxHp > 0 ? char.hp / char.maxHp : 0;
    const color = !char.alive
      ? '#FF3E3E'
      : pct > 0.5 ? '#00FF41' : pct > 0.25 ? '#FFB000' : '#FF3E3E';
    return { hpPct: pct, hpColor: color };
  }, [char.hp, char.maxHp, char.alive]);

  const handlePress     = useCallback(() => onPress(idx), [onPress, idx]);
  const handleLongPress = useCallback(() => {
    if (portraitPath) onLongPress(portraitPath);
    else onGeneratePortrait(idx);
  }, [portraitPath, onLongPress, onGeneratePortrait, idx]);

  return (
    <TouchableOpacity
      style={[S.card, { borderColor: `${accent}55` }]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.76}
    >
      {/* Portrait */}
      <View style={[S.portrait, { backgroundColor: `${accent}0E` }]}>
        {source != null ? (
          <AppImage
            source={source}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, S.portraitPlaceholder]}>
            {generatingPortrait ? (
              <ActivityIndicator color={accent} size="small" />
            ) : (
              <>
                <Text style={[S.portraitInitial, { color: `${accent}55` }]}>
                  {char.name.charAt(0).toUpperCase()}
                </Text>
                <Text style={[S.portraitGenHint, { color: `${accent}55` }]}>HOLD: GENERAR</Text>
              </>
            )}
          </View>
        )}

        {/* Dead overlay */}
        {!char.alive && (
          <View style={S.deadOverlay}>
            <Text style={S.deadGlyph}>†</Text>
          </View>
        )}

        {/* Accent top bar */}
        <View style={[S.portraitTopBar, { backgroundColor: accent }]} />

        {/* Status badge */}
        <View style={[S.statusBadge, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
          <Text style={[S.statusText, { color: accent }]}>
            {char.alive ? 'ALIVE' : 'DEAD'}
          </Text>
        </View>
      </View>

      {/* Info area */}
      <View style={S.cardBody}>
        <Text style={[S.cardName, { color: accent }]} numberOfLines={1}>
          {char.name.toUpperCase()}
        </Text>
        <Text style={S.cardSubline} numberOfLines={1}>
          {char.race} · {char.charClass}
        </Text>

        {/* HP bar */}
        <View style={S.hpTrack}>
          <View
            style={[
              S.hpFill,
              { width: `${Math.max(0, Math.min(100, hpPct * 100))}%`, backgroundColor: hpColor },
            ]}
          />
        </View>
        <Text style={[S.hpLabel, { color: `${hpColor}BB` }]}>
          {char.hp}/{char.maxHp} HP
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ─── Party Grid ───────────────────────────────────────────

type GridProps = {
  party: CharacterSave[];
  portraitsJson: Record<string, string> | null;
  generatingForIdx: number | null;
  onCharPress: (idx: number) => void;
  onCharLongPress: (portraitPath: string) => void;
  onGeneratePortrait: (idx: number) => void;
};

const PartyGrid = memo(({ party, portraitsJson, generatingForIdx, onCharPress, onCharLongPress, onGeneratePortrait }: GridProps) => {
  if (party.length === 0) return null;

  return (
    <View style={S.grid}>
      {party.map((char, i) => {
        const portraitPath = portraitsJson?.[String(i)] ?? char.portrait ?? null;
        return (
          <CharacterCard
            key={char.characterId}
            char={char}
            portraitPath={portraitPath}
            accent={STRIP_ACCENTS[i % STRIP_ACCENTS.length]}
            idx={i}
            generatingPortrait={generatingForIdx === i}
            onPress={onCharPress}
            onLongPress={onCharLongPress}
            onGeneratePortrait={onGeneratePortrait}
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
  const saveCharacterPortraits = useGameStore(s => s.saveCharacterPortraits);

  const party           = useMemo(() => activeGame?.partyData ?? [], [activeGame]);
  const aliveCount      = useMemo(() => party.filter(c => c.alive).length, [party]);
  const portraitsJson   = activeGame?.portraitsJson ?? null;

  const [modalUri, setModalUri] = useState<string | null>(null);
  const [showBountyBoard, setShowBountyBoard] = useState(false);
  const [showAlliances, setShowAlliances] = useState(false);
  const [showRankings, setShowRankings] = useState(false);
  const [generatingForIdx, setGeneratingForIdx] = useState<number | null>(null);

  const activeBounties = useMemo<BountyRecord[]>(() => {
    if (!showBountyBoard || !activeGame?.seedHash) return [];
    try { return getAllActiveBounties(activeGame.seedHash); } catch { return []; }
  }, [showBountyBoard, activeGame?.seedHash]);

  const activeAlliances = useMemo<Alliance[]>(() => {
    if (!showAlliances || !activeGame?.id || !activeGame?.seedHash) return [];
    try { return getActiveAlliances(activeGame.id, activeGame.seedHash); } catch { return []; }
  }, [showAlliances, activeGame?.id, activeGame?.seedHash]);

  const rankings = useMemo(() => {
    if (!showRankings) return [];
    try {
      return getAllSavedGames()
        .sort((a, b) => (b.floor ?? 0) - (a.floor ?? 0))
        .slice(0, 10);
    } catch { return []; }
  }, [showRankings]);

  const handleCharPress     = useCallback((idx: number) => {
    navigation.navigate('CharacterDetail', { charIndex: idx });
  }, [navigation]);

  const handleCharLongPress = useCallback((uri: string) => {
    setModalUri(uri);
  }, []);

  // Auto-assign catalog portraits on mount for characters without a portrait.
  // This ensures that when world creation skips illustration selection,
  // the guild screen immediately shows prebuilt catalog portraits rather than
  // showing a blank placeholder until the user manually long-presses.
  useEffect(() => {
    if (party.length === 0 || !activeGame) return;
    const newPortraits: Record<string, string>              = {};
    const newExpressions: Record<string, Record<string, string>> = {};

    party.forEach((char, idx) => {
      const alreadyHasPortrait =
        !!char.portrait ||
        !!(portraitsJson?.[String(idx)]);
      if (alreadyHasPortrait) return;
      if (!hasCatalogPortraits(char.charClass)) return;

      const entry = getCatalogPortraitForNPC(
        char.charClass,
        char.race ?? 'human',
        char.characterId ?? char.name,
      );
      if (!entry) return;
      if (requireCatalogPortrait(entry) === null) return;

      newPortraits[String(idx)] = entry.portraitPath;
      if (entry.expressions && Object.keys(entry.expressions).length > 0) {
        newExpressions[String(idx)] = entry.expressions as Record<string, string>;
      }
    });

    if (Object.keys(newPortraits).length > 0) {
      saveCharacterPortraits(newPortraits);
    }
    if (Object.keys(newExpressions).length > 0) {
      Object.entries(newExpressions).forEach(([idx, exprs]) => {
        useGameStore.getState().saveCharacterExpressions({ [idx]: exprs });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentional: run only once on mount

  const handleGeneratePortrait = useCallback(async (idx: number) => {
    if (generatingForIdx !== null) return;
    const char = party[idx];
    if (!char) return;
    setGeneratingForIdx(idx);
    try {
      // Catalog-first: use local portrait if available and character has no portrait
      if (!char.portrait && hasCatalogPortraits(char.charClass)) {
        const entry = getCatalogPortraitForNPC(
          char.charClass,
          char.race ?? 'human',
          char.characterId ?? char.name,
        );
        if (entry) {
          const source = requireCatalogPortrait(entry);
          if (source !== null) {
            saveCharacterPortraits({ [String(idx)]: entry.portraitPath });
            if (entry.expressions && Object.keys(entry.expressions).length > 0) {
              useGameStore.getState().saveCharacterExpressions({ [String(idx)]: entry.expressions });
            }
            setGeneratingForIdx(null);
            return;
          }
        }
      }
      // Fallback: ComfyUI live generation
      const base64Uri = await generateCharacterPortrait(char);
      // PF-01: persist file URI, not base64
      const localUri = await savePortraitToFS(char.characterId, base64Uri);
      saveCharacterPortraits({ [String(idx)]: localUri });
      try {
        const expressions = await generateCharacterExpressions(char, base64Uri);
        const localExpressions = await saveExpressionsToFS(char.characterId, expressions);
        useGameStore.getState().saveCharacterExpressions({ [String(idx)]: localExpressions });
      } catch { /* non-blocking */ }
    } catch (err) {
      __DEV__ && console.error('[Guild] portrait generation error:', err);
    } finally {
      setGeneratingForIdx(null);
    }
  }, [generatingForIdx, party, saveCharacterPortraits]);

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
        {/* ── Party Grid ── */}
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

            <PartyGrid
              party={party}
              portraitsJson={portraitsJson}
              generatingForIdx={generatingForIdx}
              onCharPress={handleCharPress}
              onCharLongPress={handleCharLongPress}
              onGeneratePortrait={handleGeneratePortrait}
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

          <TouchableOpacity style={S.optionBtn} activeOpacity={0.7} onPress={() => setShowRankings(v => !v)}>
            <View style={S.optionIconBox}>
              <Text style={S.optionIconText}>RNK</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.optionTitle}>{t('village.viewRankings')}</Text>
              <Text style={S.optionDesc}>{t('guild.rankingsDesc')}</Text>
            </View>
            <Text style={S.optionArrow}>{showRankings ? 'v' : '>'}</Text>
          </TouchableOpacity>

          {showRankings && (
            <View style={{ marginBottom: 8 }}>
              {rankings.length === 0 ? (
                <Text style={{ color: '#888', fontSize: 12, paddingLeft: 8 }}>—</Text>
              ) : rankings.map((g, i) => (
                <View key={g.id} style={{ flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#ffffff22' }}>
                  <Text style={{ color: '#aaa', width: 24, fontSize: 12 }}>#{i + 1}</Text>
                  <Text style={{ color: '#fff', flex: 1, fontSize: 12 }}>{g.partyName ?? g.seedHash.slice(0, 8)}</Text>
                  <Text style={{ color: '#00FF41', fontSize: 12 }}>Floor {g.floor}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={S.optionBtn} activeOpacity={0.7} onPress={() => setShowAlliances(v => !v)}>
            <View style={S.optionIconBox}>
              <Text style={S.optionIconText}>ALI</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.optionTitle}>{lang === 'es' ? 'Alianzas Activas' : 'Active Alliances'}</Text>
              <Text style={S.optionDesc}>{lang === 'es' ? 'Gestionar pactos de protección' : 'Manage protection pacts'}</Text>
            </View>
            <Text style={S.optionArrow}>{showAlliances ? 'v' : '>'}</Text>
          </TouchableOpacity>

          {showAlliances && activeGame && (
            <View style={{ marginBottom: 8 }}>
              {activeAlliances.length === 0 ? (
                <Text style={{ color: '#888', fontSize: 12, paddingLeft: 8 }}>
                  {lang === 'es' ? 'Sin alianzas activas' : 'No active alliances'}
                </Text>
              ) : activeAlliances.map(alliance => (
                <AllianceCard
                  key={alliance.id}
                  alliance={alliance}
                  currentCycle={activeGame.cycle ?? 1}
                  onBreak={() => {
                    try { terminateAlliance(alliance.id); } catch { /* ignore */ }
                    setShowAlliances(false);
                    setTimeout(() => setShowAlliances(true), 50);
                  }}
                />
              ))}
            </View>
          )}

          <TouchableOpacity
            style={S.optionBtn}
            activeOpacity={0.7}
            onPress={() => setShowBountyBoard(v => !v)}
          >
            <View style={S.optionIconBox}>
              <Text style={S.optionIconText}>MIS</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.optionTitle}>{t('village.bountyBoard')}</Text>
              <Text style={S.optionDesc}>{t('guild.bountyDesc')}</Text>
            </View>
            <Text style={S.optionArrow}>{showBountyBoard ? 'v' : '>'}</Text>
          </TouchableOpacity>

          {showBountyBoard && activeGame && (
            <BountyBoard
              bounties={activeBounties}
              seedHash={activeGame.seedHash}
            />
          )}

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

  // ── Party grid ──
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: CARD_PAD,
    gap: CARD_GAP,
  },
  card: {
    width: CARD_W,
    borderWidth: 1,
    backgroundColor: 'rgba(1,10,1,0.88)',
    overflow: 'hidden',
  },
  portrait: {
    width: '100%',
    height: CARD_W * 1.18,
    overflow: 'hidden',
  },
  portraitPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  portraitInitial: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 52,
  },
  portraitGenHint: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 7,
    letterSpacing: 0.5,
  },
  portraitTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  statusBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  statusText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 7,
    letterSpacing: 0.5,
  },
  deadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deadGlyph: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 36,
    color: '#FF3E3E',
  },
  cardBody: {
    padding: 8,
    paddingTop: 7,
  },
  cardName: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  cardSubline: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 8,
    color: 'rgba(255,176,0,0.5)',
    marginBottom: 7,
  },
  hpTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 3,
  },
  hpFill: {
    height: '100%',
  },
  hpLabel: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 8,
  },

  partyMetaStrip: {
    backgroundColor: 'rgba(0,255,65,0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,255,65,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 8,
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
