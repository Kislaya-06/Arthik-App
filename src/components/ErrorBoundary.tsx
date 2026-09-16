import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, DevSettings } from 'react-native';
import * as Updates from 'expo-updates';
import { AlertTriangle, RotateCcw } from 'lucide-react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (__DEV__) console.error('Unhandled error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = async () => {
    try {
      if (Updates?.reloadAsync) {
        await Updates.reloadAsync();
      } else if (DevSettings?.reload) {
        DevSettings.reload();
      } else {
        this.setState({ hasError: false, error: null });
      }
    } catch {
      try {
        if (DevSettings?.reload) {
          DevSettings.reload();
        } else {
          this.setState({ hasError: false, error: null });
        }
      } catch {
        this.setState({ hasError: false, error: null });
      }
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <AlertTriangle size={36} color="#DC2626" />
            </View>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              An unexpected glitch occurred in the application. Don't worry, your financial records and data are safe.
            </Text>

            {__DEV__ && this.state.error ? (
              <ScrollView style={styles.devErrorBox}>
                <Text style={styles.devErrorText}>
                  {this.state.error.toString()}
                </Text>
              </ScrollView>
            ) : null}

            <TouchableOpacity
              style={styles.reloadBtn}
              onPress={this.handleReload}
              activeOpacity={0.8}
            >
              <RotateCcw size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.reloadBtnText}>Reload App</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A2B4C',
    fontFamily: 'Quicksand_700Bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8A8FA3',
    fontFamily: 'Quicksand_500Medium',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  devErrorBox: {
    maxHeight: 120,
    width: '100%',
    backgroundColor: '#F1F2F5',
    borderRadius: 12,
    padding: 10,
    marginBottom: 20,
  },
  devErrorText: {
    fontSize: 11,
    color: '#DC2626',
    fontFamily: 'monospace',
  },
  reloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A2B4C',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: '100%',
  },
  reloadBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Quicksand_700Bold',
  },
});
