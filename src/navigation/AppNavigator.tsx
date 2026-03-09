import React, { Suspense, lazy } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { MainScreen } from '../screens/MainScreen';
import { SeedScreen } from '../screens/SeedScreen';
import { PartyScreen } from '../screens/PartyScreen';
import { VillageScreen } from '../screens/VillageScreen';
import { ReportScreen } from '../screens/ReportScreen';
import { ExtractionScreen } from '../screens/ExtractionScreen';
import { GuildScreen } from '../screens/GuildScreen';

// Pantallas pesadas — cargadas bajo demanda para no inflar el bundle inicial
const MapScreen = lazy(() =>
  import('../screens/MapScreen').then(m => ({ default: m.MapScreen }))
);
const BattleScreen = lazy(() =>
  import('../screens/BattleScreen').then(m => ({ default: m.BattleScreen }))
);
const CycleTransitionScreen = lazy(() =>
  import('../screens/CycleTransitionScreen').then(m => ({ default: m.CycleTransitionScreen }))
);
const WorldLogScreen = lazy(() =>
  import('../screens/WorldLogScreen').then(m => ({ default: m.WorldLogScreen }))
);

const LazyFallback = () => (
  <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator color="#FFB000" />
  </View>
);

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  return (
    <Suspense fallback={<LazyFallback />}>
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
        <Stack.Screen name="Map" component={MapScreen as React.ComponentType<object>} />
        <Stack.Screen name="Battle" component={BattleScreen as React.ComponentType<object>} />
        <Stack.Screen name="Report" component={ReportScreen} />
        <Stack.Screen name="Extraction" component={ExtractionScreen} />
        <Stack.Screen name="WorldLog" component={WorldLogScreen as React.ComponentType<object>} />
        <Stack.Screen name="CycleTransition" component={CycleTransitionScreen as React.ComponentType<object>} />
      </Stack.Navigator>
    </Suspense>
  );
};
