/**
 * Configuration Sentry pour le monitoring des erreurs
 *
 * INSTALLATION REQUISE:
 * npx @sentry/wizard@latest -i reactNative
 *
 * Ou manuellement:
 * npm install @sentry/react-native
 * cd ios && pod install
 */

// Placeholder - À décommenter après installation de @sentry/react-native
/*
import * as Sentry from '@sentry/react-native';

// Configuration Sentry
const SENTRY_DSN = 'YOUR_SENTRY_DSN_HERE'; // Remplacer par votre DSN Sentry

export const initSentry = () => {
  if (__DEV__) {
    console.log('[Sentry] Mode dev - monitoring désactivé');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,

    // Performance monitoring
    tracesSampleRate: 0.2, // 20% des transactions

    // Release tracking
    release: 'el-mouhssinine@1.0.0', // À mettre à jour avec la version
    dist: '1', // Build number

    // Environment
    environment: __DEV__ ? 'development' : 'production',

    // Options
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,

    // Filtrer les erreurs non pertinentes
    beforeSend(event) {
      // Ignorer certaines erreurs réseau non critiques
      if (event.exception?.values?.[0]?.type === 'NetworkError') {
        return null;
      }
      return event;
    },
  });

  console.log('[Sentry] Monitoring initialisé');
};

// Capture manuelle d'erreur
export const captureError = (error: Error, context?: Record<string, any>) => {
  if (__DEV__) {
    console.error('[Sentry] Error:', error, context);
    return;
  }

  Sentry.captureException(error, {
    extra: context,
  });
};

// Capture de message
export const captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
  if (__DEV__) {
    console.log(`[Sentry] ${level}:`, message);
    return;
  }

  Sentry.captureMessage(message, level);
};

// Ajouter du contexte utilisateur
export const setUserContext = (userId: string, email?: string) => {
  if (__DEV__) return;

  Sentry.setUser({
    id: userId,
    email: email,
  });
};

// Effacer le contexte utilisateur (déconnexion)
export const clearUserContext = () => {
  if (__DEV__) return;

  Sentry.setUser(null);
};

// Wrapper pour les écrans (performance)
export const SentryNavigationContainer = Sentry.wrap;

export default Sentry;
*/

// Version stub (avant installation)
export const initSentry = () => {
  if (__DEV__) {
    console.log('[Sentry] Non installé - npm install @sentry/react-native');
  }
};

export const captureError = (error: Error, context?: Record<string, any>) => {
  if (__DEV__) {
    console.error('[Sentry Stub] Error:', error.message, context);
  }
};

export const captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
  if (__DEV__) {
    console.log(`[Sentry Stub] ${level}:`, message);
  }
};

export const setUserContext = (userId: string, email?: string) => {
  // Stub
};

export const clearUserContext = () => {
  // Stub
};
