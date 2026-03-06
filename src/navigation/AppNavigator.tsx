import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { MainScreen } from '../screens/MainScreen';
import { SeedScreen } from '../screens/SeedScreen';
import { PartyScreen } from '../screens/PartyScreen';
import { VillageScreen } from '../screens/VillageScreen';
import { MapScreen } from '../screens/MapScreen';
import { BattleScreen } from '../screens/BattleScreen';
import { ReportScreen } from '../screens/ReportScreen';
import { ExtractionScreen } from '../screens/ExtractionScreen';
import { WorldLogScreen } from '../screens/WorldLogScreen';
import { CycleTransitionScreen } from '../screens/CycleTransitionScreen';
import { GuildScreen } from '../screens/GuildScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  return (
    <Stack.Navigator 
      initialRouteName="Main"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="Main" component={MainScreen} />
      <Stack.Screen name="Seed" component={SeedScreen} />
      <Stack.Screen name="Party" component={PartyScreen} />
      <Stack.Screen name="Village" component={VillageScreen} />
      <Stack.Screen name="Guild" component={GuildScreen} />
      <Stack.Screen name="Map" component={MapScreen} />
      <Stack.Screen name="Battle" component={BattleScreen} />
      <Stack.Screen name="Report" component={ReportScreen} />
      <Stack.Screen name="Extraction" component={ExtractionScreen} />
      <Stack.Screen name="WorldLog" component={WorldLogScreen} />
      <Stack.Screen name="CycleTransition" component={CycleTransitionScreen} />
    </Stack.Navigator>
  );
};
