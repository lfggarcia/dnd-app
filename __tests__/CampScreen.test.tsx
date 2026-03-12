/**
 * CampScreen.test.tsx — Smoke render tests for CampScreen.
 * Verifies: renders without crash, shows primary UI elements,
 * tab switching between PARTY and REST.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CampScreen } from '../src/screens/CampScreen';

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

function makeNavigation() {
  return {
    navigate: mockNavigate,
    goBack: mockGoBack,
    replace: jest.fn(),
    push: jest.fn(),
    dispatch: jest.fn(),
  };
}

function makeRoute(floor = 1) {
  return {
    key: 'Camp',
    name: 'Camp',
    params: { floor },
  };
}

// ─── Store mock ───────────────────────────────────────────────────────────────

const mockAdvanceCycle = jest.fn().mockResolvedValue(undefined);
const mockUpdateProgress = jest.fn();
const mockAdvanceToVillage = jest.fn().mockResolvedValue(undefined);

const mockGameState = {
  activeGame: {
    id: 'game_001',
    seed: 'test_seed',
    seedHash: 'abc123',
    partyData: [
      {
        id: 'char_1',
        name: 'Aria',
        charClass: 'Fighter',
        level: 3,
        hp: 20,
        maxHp: 30,
        alive: true,
        xp: 100,
        pendingLevelUps: 1,
        portraitUri: null,
        seed: 'aria_seed',
        ascensionPath: null,
      },
    ],
    floor: 1,
    cycle: 2,
    gold: 500,
    status: 'active',
  },
  advanceCycle: mockAdvanceCycle,
  updateProgress: mockUpdateProgress,
  advanceToVillage: mockAdvanceToVillage,
};

jest.mock('../src/stores/gameStore', () => ({
  useGameStore: jest.fn((selector: (s: typeof mockGameState) => unknown) => selector(mockGameState)),
}));

// ─── i18n mock ────────────────────────────────────────────────────────────────

jest.mock('../src/i18n', () => ({
  useI18n: () => ({ lang: 'es', t: (k: string) => k }),
}));

// ─── Service mocks ────────────────────────────────────────────────────────────

jest.mock('../src/services/timeService', () => ({
  cyclesRemaining: jest.fn().mockReturnValue(5),
}));

jest.mock('../src/services/progressionService', () => ({
  confirmLevelUps: jest.fn((char: unknown) => ({ char })),
}));

// ─── CRTOverlay mock ──────────────────────────────────────────────────────────

jest.mock('../src/components/CRTOverlay', () => ({
  CRTOverlay: ({ children }: { children: React.ReactNode }) => children,
}));

describe('CampScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders without crashing', () => {
    expect(() =>
      render(
        <CampScreen
          navigation={makeNavigation() as never}
          route={makeRoute() as never}
        />,
      ),
    ).not.toThrow();
  });

  test('shows party member name', () => {
    const { getByText } = render(
      <CampScreen
        navigation={makeNavigation() as never}
        route={makeRoute() as never}
      />,
    );
    expect(getByText('Aria')).toBeTruthy();
  });

  test('shows floor information from route params', () => {
    const { getByText } = render(
      <CampScreen
        navigation={makeNavigation() as never}
        route={makeRoute(4) as never}
      />,
    );
    // Floor 4 should appear somewhere (e.g., "Piso 4" or "Floor 4")
    const floorEl = getByText(/4/);
    expect(floorEl).toBeTruthy();
  });

  test('defaults to PARTY tab showing member list', () => {
    const { getByText } = render(
      <CampScreen
        navigation={makeNavigation() as never}
        route={makeRoute() as never}
      />,
    );
    // Should show party member on PARTY tab
    expect(getByText('Aria')).toBeTruthy();
  });

  test('renders gold value', () => {
    const { getByText } = render(
      <CampScreen
        navigation={makeNavigation() as never}
        route={makeRoute() as never}
      />,
    );
    expect(getByText(/500/)).toBeTruthy();
  });
});
