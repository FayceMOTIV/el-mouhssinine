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
      (Geolocation.requestAuthorization as any)('always');
    }

    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        if (__DEV__) console.log('[BackgroundLocation] Erreur géolocalisation:', error.message);
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
    // Vérifier si la feature est activée
    const settings = await getMosqueProximitySettings();
    if (!settings.enabled) {
      return;
    }

    // Obtenir la position
    const position = await getCurrentPosition();
    if (!position) {
      return;
    }

    // Note: On ne log JAMAIS les coordonnées GPS (vie privée)

    // Vérifier la proximité et envoyer la notification si nécessaire
    // Utiliser les traductions françaises par défaut (la plupart des utilisateurs)
    const sent = await checkMosqueProximity(
      position.latitude,
      position.longitude,
      PROXIMITY_TRANSLATIONS.fr
    );

    // Notification envoyée si sent === true
  } catch (error) {
    // Erreur silencieuse en production
    if (__DEV__) console.error('[BackgroundLocation] Error:', error);
  }
};

/**
 * Configure et démarre le Background Fetch
 */
export const initBackgroundLocation = async (): Promise<void> => {
  try {
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
        await checkMosqueProximityTask();
        // IMPORTANT: Signaler que la tâche est terminée
        BackgroundFetch.finish(taskId);
      },
      (taskId) => {
        // Timeout - la tâche a pris trop de temps
        BackgroundFetch.finish(taskId);
      }
    );

    // Démarrer le scheduling
    await BackgroundFetch.start();

  } catch (error) {
    if (__DEV__) console.error('[BackgroundLocation] Init error:', error);
  }
};

/**
 * Arrête le Background Fetch
 */
export const stopBackgroundLocation = async (): Promise<void> => {
  try {
    await BackgroundFetch.stop();
  } catch (error) {
    if (__DEV__) console.error('[BackgroundLocation] Stop error:', error);
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
    await checkMosqueProximityTask();
    BackgroundFetch.finish(taskId);
  });
};

/**
 * Vérification immédiate de proximité (appelée quand l'app passe au premier plan)
 * Utilise une précision GPS plus élevée car on est au premier plan
 */
export const checkMosqueProximityForeground = async (language: 'fr' | 'ar' = 'fr'): Promise<boolean> => {
  try {
    // Vérifier si la feature est activée
    const settings = await getMosqueProximitySettings();
    if (!settings.enabled) {
      console.log('[BackgroundLocation] Mode silencieux mosquée désactivé');
      return false;
    }

    // Obtenir la position avec haute précision (on est au premier plan)
    const position = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
      if (Platform.OS === 'ios') {
        (Geolocation.requestAuthorization as any)('whenInUse');
      }

      Geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (error) => {
          console.log('[BackgroundLocation] Foreground geoloc error:', error.message);
          resolve(null);
        },
        {
          enableHighAccuracy: true, // Haute précision au premier plan
          timeout: 10000,
          maximumAge: 30000, // Position plus fraîche
        }
      );
    });

    if (!position) {
      return false;
    }

    // Vérifier la proximité
    const translations = PROXIMITY_TRANSLATIONS[language];
    const sent = await checkMosqueProximity(
      position.latitude,
      position.longitude,
      translations
    );

    return sent;
  } catch (error) {
    console.error('[BackgroundLocation] Foreground check error:', error);
    return false;
  }
};
