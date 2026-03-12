import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import type { AscensionPath as CharAscensionPath } from '../database/gameRepository';
import type { ScreenProps } from '../navigation/types';

// ─── Ascension paths spec ─────────────────────────────────

type AscensionPathDef = {
  id: CharAscensionPath;
  nameEs: string;
  nameEn: string;
  descEs: string;
  descEn: string;
  req: (char: { moralScore?: number; level?: number }, bountyLevel: number, epicEssences: number) => boolean;
  reqLabelEs: string;
  reqLabelEn: string;
};

const ASCENSION_PATHS: AscensionPathDef[] = [
  {
    id: 'TITAN',
    nameEs: 'Ascensión de Luz',
    nameEn: 'Light Ascension',
    descEs: '+50% curación party',
    descEn: '+50% party healing',
    req: (char) => (char.moralScore ?? 50) > 80,
    reqLabelEs: 'Moral > 80',
    reqLabelEn: 'Moral > 80',
  },
  {
    id: 'ARCHMAGE',
    nameEs: 'Ascensión Oscura',
    nameEn: 'Shadow Ascension',
    descEs: '+40% daño, -moral party',
    descEn: '+40% damage, -party morale',
    req: (_char, bountyLevel) => bountyLevel >= 3,
    reqLabelEs: 'Bounty nivel 3+',
    reqLabelEn: 'Bounty level 3+',
  },
  {
    id: 'AVATAR_OF_WAR',
    nameEs: 'Ascensión del Vacío',
    nameEn: 'Void Ascension',
    descEs: 'Inmune a esencias ajenas',
    descEn: 'Immune to foreign essences',
    req: (_char, _bl, epicEssences) => epicEssences >= 5,
    reqLabelEs: '5 esencias épicas',
    reqLabelEn: '5 epic essences',
  },
];

// ─── Screen ───────────────────────────────────────────────

export const AscensionScreen = ({ navigation, route }: ScreenProps<'Ascension'>) => {
  const { charIndex } = route.params;
  const { lang } = useI18n();

  const partyData      = useGameStore(s => s.activeGame?.partyData ?? []);
  const updateProgress = useGameStore(s => s.updateProgress);

  const char = partyData[charIndex];

  const [selected, setSelected] = useState<CharAscensionPath | null>(null);

  // Placeholder values — Sprint 7 will wire real bounty/essence data
  const bountyLevel   = 0;
  const epicEssences  = 0;

  const pathAvailability = useMemo(
    () => ASCENSION_PATHS.map(p => ({
      ...p,
      available: char ? p.req(char, bountyLevel, epicEssences) : false,
    })),
    [char, bountyLevel, epicEssences],
  );

  const handleAscend = useCallback(() => {
    if (!selected || !char) return;
    Alert.alert(
      lang === 'es' ? '¿Confirmar ascensión?' : 'Confirm ascension?',
      lang === 'es'
        ? `La ascensión de ${char.name} es PERMANENTE e irreversible.`
        : `${char.name}'s ascension is PERMANENT and cannot be undone.`,
      [
        { text: lang === 'es' ? 'Cancelar' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'es' ? 'ASCENDER' : 'ASCEND',
          style: 'destructive',
          onPress: () => {
            const updatedParty = partyData.map((c, i) => {
              if (i !== charIndex) return c;
              return { ...c, ascensionPath: selected as CharAscensionPath };
            });
            updateProgress({ partyData: updatedParty });
            navigation.goBack();
          },
        },
      ],
    );
  }, [selected, char, charIndex, lang, partyData, updateProgress, navigation]);

  if (!char) {
    return (
      <View style={S.root}>
        <CRTOverlay />
        <TouchableOpacity onPress={() => navigation.goBack()} style={S.backRow}>
          <Text style={S.backBtn}>{'<'} {lang === 'es' ? 'VOLVER' : 'BACK'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isAscended = !!(char as { ascensionPath?: string }).ascensionPath;

  return (
    <View style={S.root}>
      <CRTOverlay />

      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={S.backBtn}>{'<'} {lang === 'es' ? 'VOLVER' : 'BACK'}</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>
          {lang === 'es' ? '✦ ASCENSIÓN' : '✦ ASCENSION'}
        </Text>
        <View style={{ minWidth: 72 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 56 }}>

        {/* Character info */}
        <View style={S.charCard}>
          <Text style={S.charName}>{char.name.toUpperCase()}</Text>
          <Text style={S.charSub}>
            {char.race} · {char.charClass} {lang === 'es' ? 'Nv' : 'Lv'} {char.level ?? 1}
          </Text>
          {isAscended && (
            <Text style={S.ascendedBadge}>
              ✦ {lang === 'es' ? 'YA ASCENDIDO' : 'ALREADY ASCENDED'}
            </Text>
          )}
        </View>

        {/* Divider */}
        <View style={S.divider} />

        {/* Path select label */}
        <Text style={S.sectionLabel}>
          {lang === 'es' ? 'CAMINOS DE ASCENSIÓN:' : 'ASCENSION PATHS:'}
        </Text>

        {/* Path options */}
        {pathAvailability.map(path => {
          const isSelected = selected === path.id;
          const name       = lang === 'es' ? path.nameEs : path.nameEn;
          const desc       = lang === 'es' ? path.descEs : path.descEn;
          const reqLabel   = lang === 'es' ? path.reqLabelEs : path.reqLabelEn;

          return (
            <TouchableOpacity
              key={path.id}
              style={[
                S.pathCard,
                isSelected && S.pathCardSelected,
                !path.available && S.pathCardDisabled,
              ]}
              onPress={() => path.available && setSelected(path.id)}
              activeOpacity={path.available ? 0.75 : 1}
            >
              <View style={S.pathRow}>
                <Text style={[S.pathRadio, isSelected && S.pathRadioSelected]}>
                  {isSelected ? '●' : '○'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[S.pathName, !path.available && S.pathTextDim]}>
                    {name}
                  </Text>
                  <Text style={[S.pathDesc, !path.available && S.pathTextDim]}>
                    {desc}
                  </Text>
                  <Text style={[S.pathReq, path.available ? S.pathReqMet : S.pathReqUnmet]}>
                    {path.available
                      ? (lang === 'es' ? '✓ ' : '✓ ') + reqLabel
                      : (lang === 'es' ? '✗ ' : '✗ ') + reqLabel}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Warning */}
        <View style={S.warningBox}>
          <Text style={S.warningText}>
            ⚠ {lang === 'es'
              ? 'La ascensión es PERMANENTE e irreversible.'
              : 'Ascension is PERMANENT and cannot be undone.'}
          </Text>
        </View>

        {/* Ascend button */}
        <TouchableOpacity
          style={[S.ascendBtn, (!selected || !pathAvailability.find(p => p.id === selected)?.available || isAscended) && S.ascendBtnDisabled]}
          onPress={handleAscend}
          disabled={!selected || isAscended}
        >
          <Text style={S.ascendBtnText}>
            {isAscended
              ? (lang === 'es' ? 'YA ASCENDIDO' : 'ALREADY ASCENDED')
              : (lang === 'es' ? 'ASCENDER' : 'ASCEND')}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────

const S = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#010a01',
  },
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
    fontSize: 14,
    color: '#00FF41',
    letterSpacing: 2,
  },
  backRow: {
    padding: 16,
  },
  charCard: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  charName: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 22,
    color: '#00FF41',
    letterSpacing: 2,
  },
  charSub: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 13,
    color: 'rgba(0,255,65,0.55)',
    marginTop: 4,
  },
  ascendedBadge: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 11,
    color: '#FFB000',
    marginTop: 8,
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,255,65,0.15)',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  sectionLabel: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 11,
    color: 'rgba(0,255,65,0.5)',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  pathCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.2)',
    borderRadius: 4,
    padding: 14,
  },
  pathCardSelected: {
    borderColor: '#00FF41',
    backgroundColor: 'rgba(0,255,65,0.05)',
  },
  pathCardDisabled: {
    opacity: 0.5,
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pathRadio: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 18,
    color: 'rgba(0,255,65,0.35)',
    marginRight: 12,
    marginTop: 2,
  },
  pathRadioSelected: {
    color: '#00FF41',
  },
  pathName: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 14,
    color: '#00FF41',
    marginBottom: 2,
  },
  pathDesc: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 12,
    color: 'rgba(0,255,65,0.7)',
    marginBottom: 4,
  },
  pathTextDim: {
    color: 'rgba(0,255,65,0.35)',
  },
  pathReq: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 11,
    marginTop: 2,
  },
  pathReqMet: {
    color: '#00FF41',
  },
  pathReqUnmet: {
    color: '#FF3E3E',
  },
  warningBox: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFB000',
    borderRadius: 4,
    padding: 12,
  },
  warningText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 12,
    color: '#FFB000',
    textAlign: 'center',
  },
  ascendBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#00FF41',
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ascendBtnDisabled: {
    borderColor: 'rgba(0,255,65,0.2)',
  },
  ascendBtnText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 14,
    color: '#00FF41',
    letterSpacing: 2,
  },
});
