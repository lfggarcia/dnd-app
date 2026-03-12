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
import { CharacterDetailScreen } from '../screens/CharacterDetailScreen';

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
const CampScreen = lazy(() =>
  import('../screens/CampScreen').then(m => ({ default: m.CampScreen }))
);
const LevelUpScreen = lazy(() =>
  import('../screens/LevelUpScreen').then(m => ({ default: m.LevelUpScreen }))
);
const NegotiationScreen = lazy(() =>
  import('../screens/NegotiationScreen').then(m => ({ default: m.NegotiationScreen }))
);
const AllianceScreen = lazy(() =>
  import('../screens/AllianceScreen').then(m => ({ default: m.AllianceScreen }))
);
const UnificationScreen = lazy(() =>
  import('../screens/UnificationScreen').then(m => ({ default: m.UnificationScreen }))
);
const SimulationLoadingScreen = lazy(() =>
  import('../screens/SimulationLoadingScreen').then(m => ({ default: m.SimulationLoadingScreen }))
);
const SettingsScreen = lazy(() =>
  import('../screens/SettingsScreen').then(m => ({ default: m.SettingsScreen }))
);
const AscensionScreen = lazy(() =>
  import('../screens/AscensionScreen').then(m => ({ default: m.AscensionScreen }))
);
const MarketScreen = lazy(() =>
  import('../screens/MarketScreen').then(m => ({ default: m.MarketScreen }))
);
const BlacksmithScreen = lazy(() =>
  import('../screens/BlacksmithScreen').then(m => ({ default: m.BlacksmithScreen }))
);
const EventResolutionScreen = lazy(() =>
  import('../screens/EventResolutionScreen').then(m => ({ default: m.EventResolutionScreen }))
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
        <Stack.Screen name="CharacterDetail" component={CharacterDetailScreen} />
        <Stack.Screen name="Map" component={MapScreen as React.ComponentType<object>} />
        <Stack.Screen name="Battle" component={BattleScreen as React.ComponentType<object>} />
        <Stack.Screen name="Report" component={ReportScreen} />
        <Stack.Screen name="Extraction" component={ExtractionScreen} />
        <Stack.Screen name="WorldLog" component={WorldLogScreen as React.ComponentType<object>} />
        <Stack.Screen name="CycleTransition" component={CycleTransitionScreen as React.ComponentType<object>} />
        <Stack.Screen name="Camp" component={CampScreen as React.ComponentType<object>} />
        <Stack.Screen name="LevelUp" component={LevelUpScreen as React.ComponentType<object>} />
        <Stack.Screen name="Negotiation" component={NegotiationScreen as React.ComponentType<object>} />
        <Stack.Screen name="Alliance" component={AllianceScreen as React.ComponentType<object>} />
        <Stack.Screen name="Unification" component={UnificationScreen as React.ComponentType<object>} />
        <Stack.Screen name="SimulationLoading" component={SimulationLoadingScreen as React.ComponentType<object>} />
        <Stack.Screen name="Settings" component={SettingsScreen as React.ComponentType<object>} />
        <Stack.Screen name="Ascension" component={AscensionScreen as React.ComponentType<object>} />
        <Stack.Screen name="Market" component={MarketScreen as React.ComponentType<object>} />
        <Stack.Screen name="Blacksmith" component={BlacksmithScreen as React.ComponentType<object>} />
        <Stack.Screen name="EventResolution" component={EventResolutionScreen as React.ComponentType<object>} />
      </Stack.Navigator>
    </Suspense>
  );
};
