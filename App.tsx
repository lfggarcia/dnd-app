import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StatusBar, StyleSheet } from 'react-native';
import { I18nProvider } from './src/i18n';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DatabaseGate } from './src/components/DatabaseGate';

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#0A0E0A' },
});

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <I18nProvider>
          <NavigationContainer>
            <StatusBar barStyle="light-content" backgroundColor="#0A0E0A" />
            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
              <DatabaseGate>
                <AppNavigator />
              </DatabaseGate>
            </SafeAreaView>
          </NavigationContainer>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}