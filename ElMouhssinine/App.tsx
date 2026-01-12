import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import { StatusBar, View, Text, StyleSheet, Image } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/theme/colors';
import { LanguageProvider } from './src/context/LanguageContext';
import { initTTS } from './src/services/tts';
import { initializeFCM, setupForegroundHandler } from './src/services/notifications';

// Error Boundary pour capturer les crashes
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App crash:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Erreur</Text>
          <Text style={styles.errorMessage}>{this.state.error?.message}</Text>
          <Text style={styles.errorStack}>{this.state.error?.stack?.slice(0, 500)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  // Garder la splash native visible pendant 3 secondes
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const prepare = async () => {
      // Initialiser TTS au démarrage
      initTTS();

      // Initialiser FCM pour les notifications push
      await initializeFCM();

      // Attendre 3 secondes pour garder la splash visible
      await new Promise(resolve => setTimeout(resolve, 3000));
      setAppReady(true);
    };

    prepare();
  }, []);

  // Gérer les notifications en foreground
  useEffect(() => {
    const unsubscribe = setupForegroundHandler();
    return unsubscribe;
  }, []);

  // Afficher l'image splash pendant 3 secondes
  if (!appReady) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#5c3a1a" translucent />
        <Image
          source={require('./src/assets/splash.png')}
          style={styles.splashImage}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <SafeAreaProvider>
          <StatusBar barStyle="light-content" backgroundColor={colors.background} />
          <AppNavigator />
        </SafeAreaProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  // Splash Screen styles
  splashContainer: {
    flex: 1,
    backgroundColor: '#5c3a1a',
  },
  splashImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  // Error styles
  errorContainer: {
    flex: 1,
    backgroundColor: '#7f4f24',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  errorMessage: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorStack: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'left',
  },
});

export default App;
