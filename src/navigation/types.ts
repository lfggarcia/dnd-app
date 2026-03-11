import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RoomType } from '../services/dungeonGraphService';

export type RootStackParamList = {
  Main: undefined;
  Seed: undefined;
  Party: { seed: string; seedHash: string };
  Village: undefined;
  Guild: undefined;
  CharacterDetail: { charIndex: number };
  Map: undefined;
  Battle: { roomId: string; roomType: RoomType };
  Report: { roomId: string; roomWasCleared: boolean };
  Extraction: { fromDefeat?: boolean } | undefined;
  WorldLog: undefined;
  CycleTransition: { from: 'DAY' | 'NIGHT'; to: 'DAY' | 'NIGHT'; cycle: number };
  // Sprint 6 screens
  Camp: { roomId: string; floor: number };
  LevelUp: { charIndex: number };
  Negotiation: { rivalName: string; floor: number };
  Alliance: undefined;
  Unification: { previousPartyNames: string[]; inheritedLevel: number };
  SimulationLoading: { fromCycle: number };
  Settings: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
