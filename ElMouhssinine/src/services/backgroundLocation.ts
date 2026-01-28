/**
 * Background Location Service
 * Vérifie périodiquement la position de l'utilisateur en arrière-plan
 * pour envoyer une notification quand il est proche de la mosquée
 */

import BackgroundFetch from 'react-native-background-fetch';
import Geolocation from '@react-native-community/geolocation';
import { Platform } from 'react-native';
import {
  checkMosqueProximity,
  getMosqueProximitySettings,
} from './prayerNotifications';

// Translations pour la notification de proximité
const PROXIMITY_TRANSLATIONS = {
  fr: {
    title: '🕌 Vous êtes à la mosquée',
    body: 'N\'oubliez pas de mettre votre téléphone en mode silencieux 🔕',
  },
  ar: {
    title: '🕌 أنت في المسجد',
    body: 'لا تنسَ وضع هاتفك على الصامت 🔕',
  },
};

/**
 * Récupère la position actuelle de l'utilisateur
 */
const getCurrentPosition = (): Promise<{ latitude: number; longitude: number } | null> => {
  return new Promise((resolve) => {
    // Demander la permission iOS si nécessaire
    if (Platform.OS === 'ios') {
      Geolocation.requestAuthorization('always');
    }

    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.log('[BackgroundLocation] Erreur géolocalisation:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: false, // Low power mode pour background
        timeout: 15000,
        maximumAge: 60000, // Position peut avoir jusqu'à 1 minute
      }
    );
  });
};

/**
 * Tâche de vérification de proximité mosquée
 */
const checkMosqueProximityTask = async (): Promise<void> => {
  try {
    console.log('[BackgroundLocation] Starting proximity check...');

    // Vérifier si la feature est activée
    const settings = await getMosqueProximitySettings();
    if (!settings.enabled) {
      console.log('[BackgroundLocation] Feature disabled, skipping');
      return;
    }

    // Obtenir la position
    const position = await getCurrentPosition();
    if (!position) {
      console.log('[BackgroundLocation] Could not get position');
      return;
    }

    console.log(`[BackgroundLocation] Position: ${position.latitude}, ${position.longitude}`);

    // Vérifier la proximité et envoyer la notification si nécessaire
    // Utiliser les traductions françaises par défaut (la plupart des utilisateurs)
    const sent = await checkMosqueProximity(
      position.latitude,
      position.longitude,
      PROXIMITY_TRANSLATIONS.fr
    );

    if (sent) {
      console.log('[BackgroundLocation] ✅ Notification de proximité envoyée');
    }
  } catch (error) {
    console.error('[BackgroundLocation] Error:', error);
  }
};

/**
 * Configure et démarre le Background Fetch
 */
export const initBackgroundLocation = async (): Promise<void> => {
  try {
    console.log('[BackgroundLocation] Initializing...');

    // Configuration du Background Fetch
    const status = await BackgroundFetch.configure(
      {
        minimumFetchInterval: 15, // Minimum 15 minutes (iOS impose ce minimum)
        stopOnTerminate: false, // Continuer même si l'app est fermée
        startOnBoot: true, // Démarrer au boot (Android)
        enableHeadless: true, // Exécuter même quand l'app n'est pas lancée
        requiredNetworkType: BackgroundFetch.NETWORK_TYPE_NONE, // Pas besoin de réseau
        requiresCharging: false,
        requiresDeviceIdle: false,
        requiresBatteryNotLow: false,
        requiresStorageNotLow: false,
      },
      async (taskId) => {
        // Tâche exécutée en background
        console.log(`[BackgroundLocation] Task ${taskId} started`);

        await checkMosqueProximityTask();

        // IMPORTANT: Signaler que la tâche est terminée
        BackgroundFetch.finish(taskId);
      },
      (taskId) => {
        // Timeout - la tâche a pris trop de temps
        console.warn(`[BackgroundLocation] Task ${taskId} TIMEOUT`);
        BackgroundFetch.finish(taskId);
      }
    );

    console.log(`[BackgroundLocation] Configure status: ${status}`);

    // Vérifier le statut
    switch (status) {
      case BackgroundFetch.STATUS_RESTRICTED:
        console.log('[BackgroundLocation] Status: RESTRICTED');
        break;
      case BackgroundFetch.STATUS_DENIED:
        console.log('[BackgroundLocation] Status: DENIED');
        break;
      case BackgroundFetch.STATUS_AVAILABLE:
        console.log('[BackgroundLocation] Status: AVAILABLE ✅');
        break;
    }

    // Démarrer le scheduling
    await BackgroundFetch.start();
    console.log('[BackgroundLocation] Started successfully');

  } catch (error) {
    console.error('[BackgroundLocation] Init error:', error);
  }
};

/**
 * Arrête le Background Fetch
 */
export const stopBackgroundLocation = async (): Promise<void> => {
  try {
    await BackgroundFetch.stop();
    console.log('[BackgroundLocation] Stopped');
  } catch (error) {
    console.error('[BackgroundLocation] Stop error:', error);
  }
};

/**
 * Vérifie le statut du Background Fetch
 */
export const getBackgroundLocationStatus = async (): Promise<number> => {
  return BackgroundFetch.status();
};

/**
 * Headless task pour Android (exécuté même si l'app n'est pas lancée)
 */
export const registerHeadlessTask = (): void => {
  BackgroundFetch.registerHeadlessTask(async ({ taskId }) => {
    console.log(`[BackgroundLocation] Headless task ${taskId}`);

    await checkMosqueProximityTask();

    BackgroundFetch.finish(taskId);
  });
};
