import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.warn('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#FFB000', fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
          Algo salió mal
        </Text>
        {__DEV__ && this.state.error && (
          <ScrollView style={{ maxHeight: 200, marginBottom: 16 }}>
            <Text style={{ color: '#f87171', fontSize: 12, fontFamily: 'monospace' }}>
              {this.state.error.message}
            </Text>
          </ScrollView>
        )}
        <TouchableOpacity
          onPress={this.handleReset}
          style={{ backgroundColor: '#FFB000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
        >
          <Text style={{ color: '#000', fontWeight: 'bold' }}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
