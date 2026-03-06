/**
 * Background Location Service — Geofencing via watchPosition
 *
 * Utilise Geolocation.watchPosition avec distanceFilter pour détecter
 * quand l'utilisateur s'approche de la mosquée, même en arrière-plan.
 * Remplace l'ancien système BackgroundFetch (polling toutes les ~15min,
 * iOS throttlait agressivement → notifications jamais reçues).
 */

import Geolocation, {
  GeolocationError,
} from '@react-native-community/geolocation';
import { Platform } from 'react-native';
import {
  checkMosqueProximity,
  getMosqueProximitySettings,
} from './prayerNotifications';

// Configurer Geolocation pour demander "Always" sur iOS (nécessaire pour background)
Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'always',
  enableBackgroundLocationUpdates: true,
  locationProvider: 'auto',
});

// Translations pour la notification de proximité
const PROXIMITY_TRANSLATIONS = {
  fr: {
    title: '🕌 Vous êtes à la mosquée',
    body: "N'oubliez pas de mettre votre téléphone en mode silencieux 🔕",
  },
  ar: {
    title: '🕌 أنت في المسجد',
    body: 'لا تنسَ وضع هاتفك على الصامت 🔕',
  },
};

// ID du watcher actif (null = pas de watch en cours)
let activeWatchId: number | null = null;

/**
 * Callback appelé à chaque mise à jour de position par watchPosition.
 * Vérifie la proximité de la mosquée et envoie la notification si nécessaire.
 */
const onPositionUpdate = async (position: {
  coords: { latitude: number; longitude: number };
}): Promise<void> => {
  try {
    const settings = await getMosqueProximitySettings();
    if (!settings.enabled) {
      return;
    }

    await checkMosqueProximity(
      position.coords.latitude,
      position.coords.longitude,
      PROXIMITY_TRANSLATIONS.fr,
    );
  } catch (error) {
    if (__DEV__) console.error('[BackgroundLocation] onPositionUpdate error:', error);
  }
};

/**
 * Callback appelé quand watchPosition échoue (GPS off, permission refusée, etc.)
 */
const onPositionError = (error: GeolocationError): void => {
  // Codes d'erreur courants :
  // 1 = PERMISSION_DENIED
  // 2 = POSITION_UNAVAILABLE
  // 3 = TIMEOUT
  console.log(
    `[BackgroundLocation] watchPosition error: code=${error.code}, message=${error.message}`,
  );
};

/**
 * Démarre le watchPosition pour surveiller la proximité de la mosquée.
 * Utilise distanceFilter: 100m — le GPS ne se réveille que si l'utilisateur
 * se déplace de 100m+, ce qui économise la batterie.
 */
export const initBackgroundLocation = async (): Promise<void> => {
  try {
    // Vérifier si la feature est activée
    const settings = await getMosqueProximitySettings();
    if (!settings.enabled) {
      console.log('[BackgroundLocation] Mode silencieux mosquée désactivé, skip watchPosition');
      return;
    }

    // Arrêter un éventuel watch précédent
    if (activeWatchId !== null) {
      Geolocation.clearWatch(activeWatchId);
      activeWatchId = null;
    }

    // Demander la permission sur iOS avant de démarrer le watch
    if (Platform.OS === 'ios') {
      await new Promise<void>((resolve) => {
        Geolocation.requestAuthorization(
          () => resolve(),
          (err) => {
            console.log('[BackgroundLocation] Authorization error:', err);
            resolve(); // On continue quand même, watchPosition renverra une erreur si refusé
          },
        );
      });
    }

    // Démarrer le watch
    activeWatchId = Geolocation.watchPosition(
      onPositionUpdate,
      onPositionError,
      {
        enableHighAccuracy: false,   // Low power — GPS approximatif suffit pour 200m
        distanceFilter: 100,         // Se réveille uniquement si déplacement de 100m+
        interval: 60000,             // Android : intervalle souhaité 60s
        fastestInterval: 30000,      // Android : intervalle minimum 30s
        maximumAge: 120000,          // Position peut avoir jusqu'à 2 minutes
        timeout: 30000,              // Timeout 30s par position
      },
    );

    console.log(`[BackgroundLocation] watchPosition démarré (watchId: ${activeWatchId})`);
  } catch (error) {
    console.log('[BackgroundLocation] initBackgroundLocation error:', error);
  }
};

/**
 * Arrête le watchPosition
 */
export const stopBackgroundLocation = async (): Promise<void> => {
  try {
    if (activeWatchId !== null) {
      Geolocation.clearWatch(activeWatchId);
      console.log(`[BackgroundLocation] watchPosition arrêté (watchId: ${activeWatchId})`);
      activeWatchId = null;
    }
  } catch (error) {
    if (__DEV__) console.error('[BackgroundLocation] Stop error:', error);
  }
};

/**
 * Vérification immédiate de proximité (appelée quand l'app passe au premier plan)
 * Utilise une précision GPS plus élevée car on est au premier plan
 */
export const checkMosqueProximityForeground = async (
  language: 'fr' | 'ar' = 'fr',
): Promise<boolean> => {
  try {
    // Vérifier si la feature est activée
    const settings = await getMosqueProximitySettings();
    if (!settings.enabled) {
      console.log('[BackgroundLocation] Mode silencieux mosquée désactivé');
      return false;
    }

    // Obtenir la position avec haute précision (on est au premier plan)
    const position = await new Promise<{
      latitude: number;
      longitude: number;
    } | null>((resolve) => {
      const getPos = () => {
        Geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          },
          (error) => {
            console.log(
              '[BackgroundLocation] Foreground geoloc error:',
              error.message,
            );
            resolve(null);
          },
          {
            enableHighAccuracy: true, // Haute précision au premier plan
            timeout: 10000,
            maximumAge: 30000, // Position plus fraîche
          },
        );
      };

      if (Platform.OS === 'ios') {
        Geolocation.requestAuthorization(
          () => getPos(),
          (err) => {
            if (__DEV__)
              console.log('[BackgroundLocation] Foreground auth error:', err);
            resolve(null);
          },
        );
      } else {
        getPos();
      }
    });

    if (!position) {
      return false;
    }

    // Vérifier la proximité
    const translations = PROXIMITY_TRANSLATIONS[language];
    const sent = await checkMosqueProximity(
      position.latitude,
      position.longitude,
      translations,
    );

    return sent;
  } catch (error) {
    console.error('[BackgroundLocation] Foreground check error:', error);
    return false;
  }
};
