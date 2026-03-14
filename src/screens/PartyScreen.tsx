import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { ConfirmModal } from '../components/ConfirmModal';
import { GlossaryButton } from '../components/GlossaryModal';
import { TutorialOverlay } from '../components/TutorialOverlay';
import { RosterTabs } from '../components/party/RosterTabs';
import { CharacterBanner } from '../components/party/CharacterBanner';
import { LaunchProgressModal } from '../components/party/LaunchProgressModal';
import { PortraitDetailModal } from '../components/party/PortraitDetailModal';
import { CatalogPortraitPicker } from '../components/party/CatalogPortraitPicker';
import { RaceSection } from '../components/party/RaceSection';
import { ClassSection, SubclassSection } from '../components/party/ClassAndSubclassSection';
import { BackgroundSection } from '../components/party/BackgroundSection';
import { AttributesSection } from '../components/party/AttributesSection';
import { Level1SummarySection } from '../components/party/Level1SummarySection';
import { AlignmentSection, TraitsPreviewSection } from '../components/party/AlignmentAndTraitsSection';
import { CharacterActionsPanel } from '../components/CharacterActionsPanel';
import { useI18n } from '../i18n';
import { useTutorial, PARTY_TUTORIAL_STEPS } from '../hooks/useTutorial';
import { usePartyRoster, MAX_PORTRAIT_ROLLS } from '../hooks/usePartyRoster';
import { usePartyLaunch } from '../hooks/usePartyLaunch';
import { getTranslatedField } from '../services/translationBridge';
import type { ScreenProps } from '../navigation/types';
import type { Stats } from '../database/gameRepository';

const S = StyleSheet.create({
  slotsCount: { color: 'rgba(0,255,65,0.5)' },
  bannerInput: {
    color: '#00FF41', fontFamily: 'RobotoMono-Bold', fontSize: 16,
    fontWeight: 'bold', padding: 0, margin: 0,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,65,0.3)', paddingBottom: 2,
  },
});

export const PartyScreen = ({ navigation, route }: ScreenProps<'Party'>) => {
  const { t, lang } = useI18n();
  const { seed, seedHash, inheritedLevel } = route.params;
  const tutorial = useTutorial(PARTY_TUTORIAL_STEPS);

  const rosterHook = usePartyRoster(lang);
  const {
    races, classes, backgrounds, loading,
    activeSlot, setActiveSlot, current,
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
    currentRace, currentClass, currentSubData, currentAlign,
    currentSubs, bgDescription,
    updateCurrent, onClassChange, generateRandomName,
    addCharacter, removeCharacter, buildPartySaves,
    rerollStats, useStdArray, handleGeneratePortrait,
    showCatalogPicker, setShowCatalogPicker, handleSelectCatalogPortrait,
  } = rosterHook;

  const [activeCatalogSlot, setActiveCatalogSlot] = useState<number | null>(null);

  const { partyNameInput, setPartyNameInput, handleLaunch } = usePartyLaunch({
    seed, seedHash, inheritedLevel, lang, navigation, launchStep,
    roster: rosterHook.roster,
    charPortraits, buildPartySaves,
    setCharPortraits, setLaunchStep, setLaunchSubStep,
    setPortraitMissingCount, setPortraitConfirmVisible, pendingLaunch,
  });

  const featureChoicesRef = useRef(current?.featureChoices);
  useEffect(() => { featureChoicesRef.current = current?.featureChoices; }, [current?.featureChoices]);

  const handleChoiceSelect = useCallback(
    (choiceKey: string, value: string | string[]) =>
      updateCurrent({ featureChoices: { ...featureChoicesRef.current, [choiceKey]: value } }),
    [updateCurrent],
  );

  const handlePortraitView = useCallback(() => {
    const uri = charPortraits[activeSlot];
    if (uri) setPortraitDetailUri(uri);
  }, [charPortraits, activeSlot, setPortraitDetailUri]);

  const handlePortraitDetailClose = useCallback(() => setPortraitDetailUri(null), [setPortraitDetailUri]);

  const getAbilityName = useCallback(
    (key: string) => getTranslatedField('ability-scores', key.toLowerCase(), 'name', lang) || key,
    [lang],
  );

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
          <TouchableOpacity onPress={tutorial.start} className="mr-3 border border-primary/40 rounded px-2 py-1">
            <Text className="text-primary font-robotomono text-[10px] font-bold">{t('tutorial.button')}</Text>
          </TouchableOpacity>
          <Text style={S.slotsCount} className="font-robotomono text-[9px]">
            {rosterHook.roster.length}/4 {t('party.slots')}
          </Text>
        </View>
      </View>

      {/* Party Name */}
      <View className="p-3">
        <View className="p-3 border-b border-primary/40 flex-row justify-between items-center">
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
        </View>
      </View>

      <RosterTabs
        roster={rosterHook.roster}
        activeSlot={activeSlot}
        onSlotPress={setActiveSlot}
        classes={classes}
      />

      {/* Character Banner */}
      <View className="px-3">
        <CharacterBanner
          name={current.name}
          raceName={currentRace?.name || current.race}
          className={currentClass?.name || current.charClass}
          subName={currentSubData?.name}
          charClass={current.charClass}
          lang={lang}
          namePlaceholder={t('party.namePlaceholder')}
          portrait={charPortraits[activeSlot] ?? null}
          portraitRolls={charPortraitRolls[activeSlot] ?? 0}
          generating={generatingPortraitFor === activeSlot}
          error={portraitError}
          expanded={portraitExpanded}
          maxRolls={MAX_PORTRAIT_ROLLS}
          onNameChange={text => updateCurrent({ name: text })}
          onRandomName={generateRandomName}
          onToggleExpand={() => setPortraitExpanded(v => !v)}
          onGenerate={handleGeneratePortrait}
          onView={handlePortraitView}
          onSelectFromCatalog={() => {
            setActiveCatalogSlot(activeSlot);
            setShowCatalogPicker(true);
          }}
        />
      </View>

      <ScrollView className="flex-1 px-3 pt-4" showsVerticalScrollIndicator={false}>

        <RaceSection
          races={races as { index: string; name: string; raw: Record<string, unknown> }[]}
          selectedRace={current.race}
          currentRace={currentRace as { index: string; name: string; raw: Record<string, unknown> } | undefined}
          racialBonuses={racialBonuses}
          featureChoices={current.featureChoices}
          lang={lang}
          raceSelectLabel={t('party.raceSelect')}
          raceDescHint={t('party.raceDesc')}
          onRaceSelect={(index, keptChoices) => updateCurrent({ race: index, featureChoices: keptChoices })}
          getAbilityName={getAbilityName}
        />

        <ClassSection
          classes={classes as { index: string; name: string; raw: Record<string, unknown> }[]}
          selectedClass={current.charClass}
          currentClass={currentClass as { index: string; name: string; raw: Record<string, unknown> } | undefined}
          lang={lang}
          classSelectLabel={t('party.classSelect')}
          classDescHint={t('party.classDesc')}
          onClassChange={onClassChange}
        />

        <SubclassSection
          subs={currentSubs as { index: string; name: string; raw: Record<string, unknown> }[]}
          selectedSubclass={current.subclass}
          currentSubData={currentSubData as { index: string; name: string; raw: Record<string, unknown> } | undefined}
          lang={lang}
          onSubclassSelect={index => updateCurrent({ subclass: index })}
        />

        <BackgroundSection
          backgrounds={backgrounds}
          selectedBackground={current.background}
          bgDescription={bgDescription}
          lang={lang}
          bgLabel={t('party.background')}
          bgDescHint={t('party.backgroundDesc')}
          onSelect={index => updateCurrent({ background: index })}
        />

        <AttributesSection
          baseStats={current.baseStats as Stats}
          racialBonuses={racialBonuses}
          statMethod={current.statMethod}
          totalBase={totalBase}
          totalFinal={totalFinal}
          lang={lang}
          abilityScoresLabel={t('party.abilityScores')}
          onReroll={rerollStats}
          onStdArray={useStdArray}
        />

        <Level1SummarySection
          charClass={current.charClass}
          race={current.race}
          finalStats={finalStats as Stats}
          lang={lang}
        />

        <CharacterActionsPanel
          race={current.race}
          charClass={current.charClass}
          subclass={current.subclass}
          lang={lang}
          featureChoices={current.featureChoices}
          onChoiceSelect={handleChoiceSelect}
        />

        <AlignmentSection
          alignments={sortedAlignments as { index: string; name: string; raw: Record<string, unknown> }[]}
          selectedAlignment={current.alignment}
          currentAlign={currentAlign as { index: string; name: string; raw: Record<string, unknown> } | undefined}
          lang={lang}
          alignmentLabel={t('party.alignment')}
          alignmentDescHint={t('party.alignmentDesc')}
          onSelect={index => updateCurrent({ alignment: index })}
        />

        <TraitsPreviewSection
          selectedAlignment={current.alignment}
          lang={lang}
          traitPreviewLabel={t('party.traitPreview')}
          moralLabel={t('party.moral')}
          honorableLabel={t('party.honorable')}
          neutralLabel={t('party.neutral')}
          chaoticLabel={t('party.chaotic')}
          mentalLabel={t('party.mental')}
          stableLabel={t('party.stable')}
        />

        <View className="h-24" />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View className="border-t border-primary p-3 bg-background">
        <View className="flex-row justify-between mb-3">
          <TouchableOpacity
            onPress={addCharacter}
            disabled={rosterHook.roster.length >= 4}
            className={`flex-1 mr-2 border border-primary p-2 items-center ${
              rosterHook.roster.length >= 4 ? 'opacity-30' : 'bg-primary'
            }`}
          >
            <Text className="text-background font-robotomono text-[10px]">+ {t('party.addMember')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={removeCharacter}
            disabled={rosterHook.roster.length <= 1}
            className={`flex-1 ml-2 border border-destructive p-2 items-center ${
              rosterHook.roster.length <= 1 ? 'opacity-30' : 'bg-destructive/80'
            }`}
          >
            <Text className="text-destructive font-robotomono text-[10px]">- {t('party.removeMember')}</Text>
          </TouchableOpacity>
        </View>
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
        charClass={rosterHook.roster[activeCatalogSlot ?? 0]?.charClass ?? ''}
        race={rosterHook.roster[activeCatalogSlot ?? 0]?.race}
        lang={lang}
        onSelect={entry => {
          handleSelectCatalogPortrait(activeCatalogSlot ?? 0, entry);
          setShowCatalogPicker(false);
        }}
        onClose={() => setShowCatalogPicker(false)}
      />
    </View>
  );
};