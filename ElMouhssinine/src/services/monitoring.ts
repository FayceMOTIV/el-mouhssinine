/**
 * monitoring.ts — Service centralise de monitoring El Mouhssinine
 * Crashlytics + Analytics + Performance
 *
 * EN DEV : tout est logue dans la console, rien n'est envoye a Firebase
 * EN PROD : tout est envoye silencieusement a Firebase
 */

import crashlytics from '@react-native-firebase/crashlytics';
import analytics from '@react-native-firebase/analytics';
import perf from '@react-native-firebase/perf';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// ─── Crashlytics ──────────────────────────────────────────────────────────────

/**
 * Enregistre l'utilisateur courant dans Crashlytics.
 * A appeler apres login. Passer null au logout.
 * N'utilise que l'uid — jamais d'email ou de nom.
 */
export function setUserForCrashlytics(uid: string | null): void {
  if (__DEV__) return;
  crashlytics().setUserId(uid ?? '');
}

/**
 * Log un message de fil d'Ariane pour reconstituer le parcours avant un crash.
 */
export function logBreadcrumb(message: string): void {
  if (__DEV__) {
    console.log('[breadcrumb]', message);
    return;
  }
  crashlytics().log(message);
}

/**
 * Enregistre une erreur dans Crashlytics avec contexte.
 * A utiliser dans tous les blocs catch{} des operations critiques.
 * Ne jamais passer de donnees sensibles (carte, mot de passe, etc.)
 */
export function logError(
  error: Error,
  context?: Record<string, string>,
): void {
  if (__DEV__) {
    console.error('[logError]', error.message, context);
    return;
  }
  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      crashlytics().setAttribute(key, String(value));
    });
  }
  crashlytics().recordError(error);
}

/**
 * Enregistre une erreur dans Crashlytics ET dans Firestore errors_log.
 * Pour les operations critiques (paiement, auth) qui doivent etre visibles
 * cote serveur dans le monitoring toutes les 10 minutes.
 */
export const logErrorToServer = async (
  error: Error,
  context: string,
  screen?: string,
): Promise<void> => {
  // 1. Toujours logger dans Crashlytics
  try {
    crashlytics().recordError(error);
  } catch (_) {}

  // 2. Ecrire dans Firestore errors_log pour monitoring serveur
  try {
    const uid = auth().currentUser?.uid ?? 'anonymous';
    await firestore().collection('errors_log').add({
      message: error.message ?? 'Erreur inconnue',
      stack: error.stack?.slice(0, 500) ?? '',
      context,
      screen: screen ?? 'unknown',
      uid,
      alerted: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
  } catch (_) {
    // Ne jamais throw — l'erreur de logging ne doit pas faire planter l'app
  }
};

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * Liste des events metier El Mouhssinine.
 * Utiliser ces constantes — ne jamais ecrire les strings en dur ailleurs.
 */
export const Events = {
  PAYMENT_STARTED: 'payment_started',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  DONATION_SUCCESS: 'donation_success',
  QURAN_PLAY: 'quran_play',
  JANAZA_VIEW: 'janaza_view',
} as const;

/**
 * Envoie un event analytics.
 */
export async function trackEvent(
  eventName: string,
  params?: Record<string, string | number>,
): Promise<void> {
  if (__DEV__) {
    console.log('[analytics]', eventName, params ?? '');
    return;
  }
  try {
    await analytics().logEvent(eventName, params);
  } catch {
    // Ne jamais laisser l'analytics crasher l'app
  }
}

/**
 * Declare l'ecran courant a Analytics.
 */
export async function trackScreen(screenName: string): Promise<void> {
  if (__DEV__) return;
  try {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
  } catch {
    // silencieux
  }
}

// ─── Performance ──────────────────────────────────────────────────────────────

/**
 * Demarre une mesure de performance.
 * Retourne un objet avec .stop() a appeler a la fin de l'operation.
 */
export async function startTrace(traceName: string) {
  if (__DEV__) {
    const start = Date.now();
    return {
      stop: async () =>
        console.log(`[perf] ${traceName} : ${Date.now() - start}ms`),
      putAttribute: (_k: string, _v: string) => {},
    };
  }
  try {
    const trace = await perf().startTrace(traceName);
    return trace;
  } catch {
    return {
      stop: async () => {},
      putAttribute: (_k: string, _v: string) => {},
    };
  }
}
