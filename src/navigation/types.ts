import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Main: undefined;
  Seed: undefined;
  Party: undefined;
  Village: undefined;
  Map: undefined;
  Battle: undefined;
  Report: undefined;
  Extraction: undefined;
  WorldLog: undefined;
  CycleTransition: { from: 'DAY' | 'NIGHT'; to: 'DAY' | 'NIGHT'; cycle: number };
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
