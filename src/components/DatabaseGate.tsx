import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useDatabase } from '../hooks/useDatabase';

type Props = {
  children: React.ReactNode;
};

/**
 * Wraps the app content and ensures the database is initialized + synced
 * before rendering children. Shows a CRT-themed loading screen during init.
 */
export function DatabaseGate({ children }: Props) {
  const { status, error, progress, syncNow, retry, syncStatus } = useDatabase();

  // Auto-sync when DB is ready but API data is missing
  useEffect(() => {
    if (status === 'ready' && syncStatus && syncStatus.missing.length > 0) {
      syncNow();
    }
  }, [status, syncStatus, syncNow]);

  if (status === 'initializing') {
    return (
      <LoadingView message="INICIALIZANDO BASE DE DATOS..." />
    );
  }

  if (status === 'syncing' && progress) {
    const pct = progress.endpointsTotalCount > 0
      ? Math.round((progress.endpointsCompleted / progress.endpointsTotalCount) * 100)
      : 0;
    const barFilled = Math.round(pct / 5);
    const bar = '█'.repeat(barFilled) + '░'.repeat(20 - barFilled);

    return (
      <LoadingView
        message={`DESCARGANDO REGLAS D&D 5e...\n\n${bar} ${pct}%\n\n${progress.currentEndpoint}`}
      />
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>ERROR DE BASE DE DATOS</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity onPress={retry} style={styles.retryButton}>
          <Text style={styles.retryLabel}>REINTENTAR</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

function LoadingView({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>⚔ TORRE ⚔</Text>
      <ActivityIndicator size="large" color="#00FF41" style={styles.spinner} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E0A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 24,
    color: '#00FF41',
    marginBottom: 32,
    letterSpacing: 4,
  },
  spinner: {
    marginBottom: 24,
  },
  message: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 12,
    color: '#FFB000',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorTitle: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 16,
    color: '#FF3E3E',
    marginBottom: 16,
  },
  errorMessage: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 12,
    color: '#FF3E3E',
    textAlign: 'center',
    marginBottom: 16,
  },
  hint: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 11,
    color: 'rgba(255,176,0,0.7)',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#FFB000',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryLabel: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 13,
    color: '#000',
    letterSpacing: 2,
  },
});
