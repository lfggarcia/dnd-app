import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import type { CharacterSave, Stats } from '../database/gameRepository';
import type { ScreenProps } from '../navigation/types';

// ─── Stat modifier helper ─────────────────────────────────

function statMod(val: number): string {
  const mod = Math.floor((val - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

const STAT_KEYS: (keyof Stats)[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

const STAT_LABELS_ES: Record<keyof Stats, string> = {
  STR: 'FUE', DEX: 'DES', CON: 'CON', INT: 'INT', WIS: 'SAB', CHA: 'CAR',
};

// ─── Character Card ───────────────────────────────────────

const CharacterCard = ({ char, lang }: { char: CharacterSave; lang: string }) => {
  const hpPct = char.maxHp > 0 ? char.hp / char.maxHp : 0;
  const hpColor = !char.alive
    ? 'rgba(255,62,62,0.8)'
    : hpPct > 0.5
      ? 'rgba(0,255,65,0.8)'
      : hpPct > 0.25
        ? 'rgba(255,176,0,0.8)'
        : 'rgba(255,62,62,0.8)';

  const statusLabel = !char.alive
    ? (lang === 'es' ? 'MUERTO' : 'DEAD')
    : hpPct < 1
      ? (lang === 'es' ? 'HERIDO' : 'WOUNDED')
      : (lang === 'es' ? 'ACTIVO' : 'ACTIVE');

  return (
    <View style={S.card}>
      {/* Header */}
      <View style={S.cardHeader}>
        <Text style={S.charName}>{char.name}</Text>
        <Text style={[S.statusBadge, { color: hpColor, borderColor: hpColor }]}>
          {statusLabel}
        </Text>
      </View>

      {/* Class / Race / Background */}
      <View style={S.infoRow}>
        <Text style={S.infoLabel}>
          {char.race} · {char.charClass}
          {char.subclass ? ` (${char.subclass})` : ''}
        </Text>
      </View>
      <Text style={S.bgLabel}>{char.background} · {char.alignment}</Text>

      {/* HP Bar */}
      <View style={S.hpContainer}>
        <Text style={[S.hpText, { color: hpColor }]}>
          HP: {char.hp}/{char.maxHp}
        </Text>
        <View style={S.hpBarBg}>
          <View style={[S.hpBarFill, { width: `${Math.round(hpPct * 100)}%`, backgroundColor: hpColor }]} />
        </View>
      </View>

      {/* Stats Grid */}
      <View style={S.statsGrid}>
        {STAT_KEYS.map(key => (
          <View key={key} style={S.statCell}>
            <Text style={S.statLabel}>{lang === 'es' ? STAT_LABELS_ES[key] : key}</Text>
            <Text style={S.statValue}>{char.baseStats[key]}</Text>
            <Text style={S.statMod}>{statMod(char.baseStats[key])}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────

export const GuildScreen = ({ navigation }: ScreenProps<'Guild'>) => {
  const { t, lang } = useI18n();
  const activeGame = useGameStore(s => s.activeGame);

  const party = useMemo(() => activeGame?.partyData ?? [], [activeGame]);
  const aliveCount = useMemo(() => party.filter(c => c.alive).length, [party]);

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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* Guild description */}
        <View style={S.descBox}>
          <Text style={S.descText}>{t('guild.description')}</Text>
        </View>

        {/* Party Overview */}
        <View style={S.sectionHeader}>
          <Text style={S.sectionTitle}>{t('guild.partyRoster')}</Text>
          <Text style={S.memberCount}>
            {aliveCount}/{party.length} {t('common.active').toLowerCase()}
          </Text>
        </View>

        {party.length === 0 ? (
          <View style={S.emptyBox}>
            <Text style={S.emptyText}>{t('guild.noParty')}</Text>
          </View>
        ) : (
          party.map((char, i) => (
            <CharacterCard key={`${char.name}-${i}`} char={char} lang={lang} />
          ))
        )}

        {/* Guild Options */}
        <Text style={[S.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>
          {t('guild.options')}
        </Text>

        <TouchableOpacity style={S.optionBtn} activeOpacity={0.7}>
          <Text style={S.optionIcon}>📊</Text>
          <View style={{ flex: 1 }}>
            <Text style={S.optionTitle}>{t('village.viewRankings')}</Text>
            <Text style={S.optionDesc}>{t('guild.rankingsDesc')}</Text>
          </View>
          <Text style={S.optionArrow}>{'>'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={S.optionBtn} activeOpacity={0.7}>
          <Text style={S.optionIcon}>📋</Text>
          <View style={{ flex: 1 }}>
            <Text style={S.optionTitle}>{t('village.bountyBoard')}</Text>
            <Text style={S.optionDesc}>{t('guild.bountyDesc')}</Text>
          </View>
          <Text style={S.optionArrow}>{'>'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={S.optionBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('WorldLog')}
        >
          <Text style={S.optionIcon}>📜</Text>
          <View style={{ flex: 1 }}>
            <Text style={S.optionTitle}>{t('village.viewWorldLog')}</Text>
            <Text style={S.optionDesc}>{t('guild.worldLogDesc')}</Text>
          </View>
          <Text style={S.optionArrow}>{'>'}</Text>
        </TouchableOpacity>

        {/* Level-up notice */}
        <View style={S.noticeBox}>
          <Text style={S.noticeTitle}>⚠ {t('guild.levelUpNotice')}</Text>
          <Text style={S.noticeText}>{t('guild.levelUpDesc')}</Text>
        </View>
      </ScrollView>

      <GlossaryButton />
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
    fontSize: 10,
    color: 'rgba(0,255,65,0.6)',
  },
  title: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 13,
    color: '#00FF41',
    textAlign: 'center',
  },
  descBox: {
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.15)',
    padding: 12,
    marginBottom: 16,
    backgroundColor: 'rgba(0,255,65,0.03)',
  },
  descText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 10,
    color: 'rgba(0,255,65,0.5)',
    lineHeight: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 11,
    color: '#00FF41',
  },
  memberCount: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 9,
    color: 'rgba(0,229,255,0.7)',
  },
  emptyBox: {
    borderWidth: 1,
    borderColor: 'rgba(255,62,62,0.3)',
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 10,
    color: 'rgba(255,62,62,0.6)',
  },

  // Character Card
  card: {
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.25)',
    backgroundColor: 'rgba(26,31,26,0.8)',
    padding: 12,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  charName: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 12,
    color: '#00FF41',
  },
  statusBadge: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  infoLabel: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 9,
    color: 'rgba(255,176,0,0.8)',
  },
  bgLabel: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 8,
    color: 'rgba(0,229,255,0.5)',
    marginBottom: 8,
  },
  hpContainer: {
    marginBottom: 8,
  },
  hpText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 9,
    marginBottom: 3,
  },
  hpBarBg: {
    height: 4,
    backgroundColor: 'rgba(0,255,65,0.1)',
  },
  hpBarFill: {
    height: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCell: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 7,
    color: 'rgba(0,255,65,0.4)',
    marginBottom: 2,
  },
  statValue: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 11,
    color: 'rgba(0,255,65,0.9)',
  },
  statMod: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 8,
    color: 'rgba(255,176,0,0.6)',
  },

  // Options
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.2)',
    padding: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(26,31,26,0.5)',
  },
  optionIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  optionTitle: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    color: '#00FF41',
  },
  optionDesc: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 8,
    color: 'rgba(0,255,65,0.4)',
    marginTop: 2,
  },
  optionArrow: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 12,
    color: 'rgba(0,255,65,0.3)',
    marginLeft: 8,
  },

  // Notice
  noticeBox: {
    borderWidth: 1,
    borderColor: 'rgba(255,176,0,0.3)',
    backgroundColor: 'rgba(255,176,0,0.05)',
    padding: 12,
    marginTop: 16,
  },
  noticeTitle: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    color: 'rgba(255,176,0,0.9)',
    marginBottom: 4,
  },
  noticeText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 9,
    color: 'rgba(255,176,0,0.5)',
    lineHeight: 14,
  },
});
