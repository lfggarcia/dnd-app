import { useState, useCallback } from 'react';
import type { TutorialStep } from '../components/TutorialOverlay';

/** Tutorial steps for the PartyScreen character creation flow */
export const PARTY_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    icon: '🏰',
    titleKey: 'tutorial.steps.welcome.title',
    descKey:  'tutorial.steps.welcome.desc',
  },
  {
    id: 'roster',
    icon: '👥',
    titleKey: 'tutorial.steps.roster.title',
    descKey:  'tutorial.steps.roster.desc',
  },
  {
    id: 'name',
    icon: '✏️',
    titleKey: 'tutorial.steps.name.title',
    descKey:  'tutorial.steps.name.desc',
  },
  {
    id: 'race',
    icon: '🧬',
    titleKey: 'tutorial.steps.race.title',
    descKey:  'tutorial.steps.race.desc',
  },
  {
    id: 'class',
    icon: '⚔️',
    titleKey: 'tutorial.steps.class.title',
    descKey:  'tutorial.steps.class.desc',
  },
  {
    id: 'subclass',
    icon: '🔱',
    titleKey: 'tutorial.steps.subclass.title',
    descKey:  'tutorial.steps.subclass.desc',
  },
  {
    id: 'background',
    icon: '📜',
    titleKey: 'tutorial.steps.background.title',
    descKey:  'tutorial.steps.background.desc',
  },
  {
    id: 'stats',
    icon: '🎲',
    titleKey: 'tutorial.steps.stats.title',
    descKey:  'tutorial.steps.stats.desc',
  },
  {
    id: 'summary',
    icon: '📊',
    titleKey: 'tutorial.steps.summary.title',
    descKey:  'tutorial.steps.summary.desc',
  },
  {
    id: 'alignment',
    icon: '⚖️',
    titleKey: 'tutorial.steps.alignment.title',
    descKey:  'tutorial.steps.alignment.desc',
  },
  {
    id: 'actions',
    icon: '🚀',
    titleKey: 'tutorial.steps.actions.title',
    descKey:  'tutorial.steps.actions.desc',
  },
];

export function useTutorial(steps: TutorialStep[] = PARTY_TUTORIAL_STEPS) {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const start = useCallback(() => {
    setCurrentStep(0);
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  const next = useCallback(() => {
    if (currentStep >= steps.length - 1) {
      close();
    } else {
      setCurrentStep(s => s + 1);
    }
  }, [currentStep, steps.length, close]);

  const prev = useCallback(() => {
    setCurrentStep(s => Math.max(0, s - 1));
  }, []);

  return { visible, currentStep, steps, start, close, next, prev };
}
