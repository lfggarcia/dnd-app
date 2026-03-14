import { useState, useCallback, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { generateCharacterPortrait, generateCharacterExpressions } from '../services/geminiImageService';
import { getCatalogPortrait, requireCatalogPortrait } from '../services/characterCatalogService';
import type { Lang } from '../i18n';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { CharacterSave } from '../database/gameRepository';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Party'>;

type UsePartyLaunchParams = {
  seed: string;
  seedHash: string;
  inheritedLevel?: number;
  lang: Lang;
  navigation: Navigation;
  launchStep: string | null;
  roster: { charClass: string; portrait?: string }[];
  charPortraits: Record<number, string>;
  buildPartySaves: () => CharacterSave[];
  setCharPortraits: (updater: (prev: Record<number, string>) => Record<number, string>) => void;
  setLaunchStep: (step: string | null) => void;
  setLaunchSubStep: (sub: string | null) => void;
  setPortraitMissingCount: (count: number) => void;
  setPortraitConfirmVisible: (visible: boolean) => void;
  pendingLaunch: React.MutableRefObject<(() => void) | null>;
};

export function usePartyLaunch({
  seed, seedHash, inheritedLevel, lang, navigation, launchStep,
  roster, charPortraits, buildPartySaves,
  setCharPortraits, setLaunchStep, setLaunchSubStep,
  setPortraitMissingCount, setPortraitConfirmVisible, pendingLaunch,
}: UsePartyLaunchParams) {
  const [partyNameInput, setPartyNameInput] = useState('');
  const startNewGame = useGameStore(s => s.startNewGame);
  // Keep partyNameInput accessible inside the async doLaunch without stale closure
  const partyNameRef = useRef(partyNameInput);
  partyNameRef.current = partyNameInput;

  const doLaunch = useCallback(async () => {
    setLaunchStep(lang === 'es' ? 'Iniciando partida...' : 'Initializing game...');
    setLaunchSubStep(null);
    try {
      const party = buildPartySaves();
      const finalParty = inheritedLevel
        ? party.map(c => ({ ...c, level: Math.max(c.level, inheritedLevel) }))
        : party;
      const finalName = partyNameRef.current.trim() || `PARTY_${seed.slice(0, 6).toUpperCase()}`;
      startNewGame(seed, seedHash, finalParty, finalName);

      const newPortraits: Record<string, string> = {};
      const totalMissing = party.filter(c => !c.portrait).length;
      let doneCount = 0;

      for (let i = 0; i < party.length; i++) {
        if (!party[i].portrait) {
          const remaining = totalMissing - doneCount;
          setLaunchStep(
            lang === 'es'
              ? `Creando ilustración para ${party[i].name}`
              : `Creating portrait for ${party[i].name}`,
          );
          setLaunchSubStep(
            lang === 'es'
              ? `${remaining} de ${totalMissing} ilustraciones pendientes`
              : `${remaining} of ${totalMissing} portraits remaining`,
          );
          try {
            const catalogEntry = getCatalogPortrait(party[i].charClass, party[i].race ?? undefined);
            if (catalogEntry && requireCatalogPortrait(catalogEntry) !== null) {
              const uri = catalogEntry.portraitPath;
              setCharPortraits(prev => ({ ...prev, [i]: uri }));
              newPortraits[String(i)] = uri;
              if (catalogEntry.expressions && Object.keys(catalogEntry.expressions).length > 0) {
                useGameStore.getState().saveCharacterExpressions({ [String(i)]: catalogEntry.expressions });
              }
            } else {
              const uri = await generateCharacterPortrait(party[i]);
              setCharPortraits(prev => ({ ...prev, [i]: uri }));
              newPortraits[String(i)] = uri;

              setLaunchStep(
                lang === 'es'
                  ? `Generando expresiones para ${party[i].name}`
                  : `Generating expressions for ${party[i].name}`,
              );
              try {
                const expressions = await generateCharacterExpressions(party[i], uri);
                useGameStore.getState().saveCharacterExpressions({ [String(i)]: expressions });
              } catch {
                // non-blocking
              }
            }
          } catch {
            // portrait failure is non-blocking
          }
          doneCount++;
        }
      }

      // Expression variants for characters that already had a portrait
      for (let i = 0; i < party.length; i++) {
        if (party[i].portrait) {
          setLaunchStep(
            lang === 'es'
              ? `Generando expresiones para ${party[i].name}`
              : `Generating expressions for ${party[i].name}`,
          );
          setLaunchSubStep(null);
          try {
            const expressions = await generateCharacterExpressions(party[i], party[i].portrait!);
            useGameStore.getState().saveCharacterExpressions({ [String(i)]: expressions });
          } catch {
            // non-blocking
          }
        }
      }

      if (Object.keys(newPortraits).length > 0) {
        setLaunchStep(lang === 'es' ? 'Guardando ilustraciones...' : 'Saving portraits...');
        setLaunchSubStep(null);
        useGameStore.getState().saveCharacterPortraits(newPortraits);
      }

      setLaunchStep(lang === 'es' ? 'Entrando a la aldea...' : 'Entering the village...');
      setLaunchSubStep(null);
      navigation.reset({ index: 0, routes: [{ name: 'Village' }] });
    } finally {
      setLaunchStep(null);
      setLaunchSubStep(null);
    }
  }, [
    buildPartySaves, inheritedLevel, lang, navigation,
    seed, seedHash, setCharPortraits, setLaunchStep,
    setLaunchSubStep, startNewGame,
  ]);

  const handleLaunch = useCallback(() => {
    if (launchStep !== null) return;
    const missingCount = roster.filter((_, i) => !charPortraits[i]).length;
    if (missingCount > 0) {
      pendingLaunch.current = doLaunch;
      setPortraitMissingCount(missingCount);
      setPortraitConfirmVisible(true);
    } else {
      doLaunch();
    }
  }, [
    launchStep, roster, charPortraits, doLaunch,
    pendingLaunch, setPortraitMissingCount, setPortraitConfirmVisible,
  ]);

  return { partyNameInput, setPartyNameInput, handleLaunch };
}
