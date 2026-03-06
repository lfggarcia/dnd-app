import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StatusBar, StyleSheet } from 'react-native';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <NavigationContainer>
        <StatusBar hidden />
        <AppNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}