import React, {
  Component,
  ErrorInfo,
  ReactNode,
  useEffect,
  useState,
} from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SystemBars } from 'react-native-edge-to-edge';
import { StripeProvider } from '@stripe/stripe-react-native';
import notifee, { EventType } from '@notifee/react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/theme/colors';
import { LanguageProvider } from './src/context/LanguageContext';
import { initTTS } from './src/services/tts';
import {
  initializeFCM,
  setupForegroundHandler,
  clearBadgeCount,
} from './src/services/notifications';
import {
  subscribeToGeneralSettings,
  MaintenanceSettings,
} from './src/services/firebase';
import { initBackgroundLocation } from './src/services/backgroundLocation';
import {
  addNotificationToHistory,
  detectNotificationType,
} from './src/services/notificationHistory';
import { initSentry, captureError } from './src/services/sentry';
import { checkForOTAUpdate } from './src/utils/checkForUpdates';

// =============================================================================
// STRIPE CONFIGURATION
// =============================================================================
// Clé publique Stripe - À CONFIGURER avec votre vraie clé
// 1. Allez sur https://dashboard.stripe.com/apikeys
// 2. Copiez la "Publishable key" (commence par pk_live_ ou pk_test_)
// 3. Remplacez la valeur ci-dessous
//
// NOTE: Les clés publishable sont conçues pour être dans le code client.
// La clé secrète (sk_) est dans Firebase Functions config (ne jamais la mettre ici!)
// =============================================================================
const STRIPE_PUBLISHABLE_KEY =
  'pk_live_51SzXh73gslOPb7CbYOlhID74OLIqS8OSJUuSAbrQKzi5iftBbKM1LxnpOISC2iA86pFL7vSyW2z4cxh8fnysIxC3009Tc5PF80';

// Error Boundary pour capturer les crashes
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // TOUJOURS logger le crash (visible dans Xcode console / Console.app)
    // Sans ça on ne sait jamais quelle erreur cause l'écran marron
    console.error(
      '[ErrorBoundary] CRASH:',
      error?.message,
      error?.stack?.slice(0, 300),
    );
    console.error(
      '[ErrorBoundary] Component:',
      errorInfo?.componentStack?.slice(0, 300),
    );
    // Envoyer à Sentry en production
    captureError(error, { componentStack: errorInfo.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Erreur</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message ||
              "Une erreur est survenue. Veuillez redémarrer l'application."}
          </Text>
          <Text style={styles.errorStack}>
            {this.state.error?.stack?.slice(0, 500)}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  // Garder la splash native visible pendant 2 secondes
  const [appReady, setAppReady] = useState(false);
  const [maintenance, setMaintenance] = useState<MaintenanceSettings>({
    enabled: false,
    message: '',
  });

  useEffect(() => {
    const prepare = async () => {
      // Initialiser Sentry pour le monitoring des erreurs (production uniquement)
      initSentry();

      // Bug 14 Fix: try/catch individuel pour éviter splash infinie si un service échoue
      try {
        await initTTS();
      } catch (e) {
        console.warn('[App] TTS init failed:', e);
      }
      try {
        await initializeFCM();
      } catch (e) {
        console.warn('[App] FCM init failed:', e);
      }
      try {
        await initBackgroundLocation();
      } catch (e) {
        console.warn('[App] BackgroundLocation init failed:', e);
      }
      try {
        await clearBadgeCount();
      } catch (e) {
        console.warn('[App] clearBadge failed:', e);
      }

      // Vérifier les mises à jour OTA (silencieux, non-bloquant)
      checkForOTAUpdate();

      // Attendre 2 secondes pour garder la splash visible
      await new Promise<void>(resolve => setTimeout(resolve, 2000));
      setAppReady(true);
    };

    prepare().catch(e => {
      console.error('[App] prepare() failed:', e);
      setAppReady(true); // Montrer l'app même si init échoue
    });
  }, []);

  // Gérer les notifications en foreground (FCM)
  useEffect(() => {
    const unsubscribe = setupForegroundHandler();
    return unsubscribe;
  }, []);

  // Intercepter les notifications locales (notifee) pour l'historique
  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
      // Quand une notification locale est délivrée (prière, etc.)
      if (type === EventType.DELIVERED && detail.notification) {
        const { title, body } = detail.notification;
        if (title && body) {
          const notifType = detectNotificationType(title, body);
          await addNotificationToHistory(title, body, notifType);
          if (__DEV__)
            console.log(
              "[App] Notification locale ajoutée à l'historique:",
              title,
            );
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Écouter le mode maintenance
  useEffect(() => {
    const unsubscribe = subscribeToGeneralSettings(settings => {
      if (settings?.maintenance) {
        setMaintenance(settings.maintenance);
      }
    });
    return unsubscribe;
  }, []);

  // Afficher l'image splash pendant 3 secondes
  if (!appReady) {
    return (
      <View style={styles.splashContainer}>
        <SystemBars style="light" />
        <Image
          source={require('./src/assets/splash.png')}
          style={styles.splashImage}
          resizeMode="cover"
        />
      </View>
    );
  }

  // Mode maintenance activé depuis le backoffice
  if (maintenance.enabled) {
    return (
      <View style={styles.maintenanceContainer}>
        <SystemBars style="light" />
        <Text style={styles.maintenanceIcon}>🛠️</Text>
        <Text style={styles.maintenanceTitle}>Maintenance en cours</Text>
        <Text style={styles.maintenanceMessage}>
          {maintenance.message ||
            "L'application est temporairement indisponible. Veuillez réessayer plus tard."}
        </Text>
        <Text style={styles.maintenanceArabic}>
          التطبيق قيد الصيانة حاليًا. يرجى المحاولة لاحقًا.
        </Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <StripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="merchant.fr.elmouhssinine.mosquee"
        urlScheme="elmouhssinine"
      >
        <LanguageProvider>
          <SafeAreaProvider>
            <SystemBars style="light" />
            <AppNavigator />
          </SafeAreaProvider>
        </LanguageProvider>
      </StripeProvider>
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
  // Maintenance styles
  maintenanceContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  maintenanceIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  maintenanceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  maintenanceMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  maintenanceArabic: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default App;
