/**
 * Background Location Service — Geofencing natif iOS + Android
 *
 * iOS : CLCircularRegion via MosqueGeofencing.swift (Core Location natif)
 *   → iOS gère la zone au niveau OS, relance l'app même si fermée
 * Android : GeofencingClient via MosqueGeofencingModule.kt + BroadcastReceiver statique
 *   → Android déclenche le BroadcastReceiver même si l'app est tuée
 *
 * Les notifications sont envoyées NATIVEMENT (Swift/Kotlin), pas via JS.
 * Seuls start() et stop() passent par le pont NativeModules.
 */

import Geolocation from '@react-native-community/geolocation';
import { NativeModules, Platform, PermissionsAndroid } from 'react-native';
import {
  checkMosqueProximity,
  getMosqueProximitySettings,
} from './prayerNotifications';

// Configurer Geolocation pour le foreground check (checkMosqueProximityForeground)
Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'always',
  enableBackgroundLocationUpdates: true,
  locationProvider: 'auto',
});

// Translations pour la notification de proximité (utilisé par checkMosqueProximityForeground)
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

/**
 * Démarre le geofencing natif (iOS CLCircularRegion / Android GeofencingClient).
 * Sur Android 10+, demande ACCESS_BACKGROUND_LOCATION avant.
 */
export const initBackgroundLocation = async (): Promise<void> => {
  try {
    const settings = await getMosqueProximitySettings();
    if (!settings.enabled) {
      console.log('[MosqueGeofencing] Désactivé dans les paramètres');
      return;
    }

    // Android 10+ : permission ACCESS_BACKGROUND_LOCATION nécessaire
    if (Platform.OS === 'android' && Platform.Version >= 29) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        {
          title: 'Localisation en arrière-plan',
          message:
            'Nécessaire pour vous rappeler de mettre votre téléphone en silencieux à la mosquée',
          buttonPositive: 'Autoriser',
        },
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('[MosqueGeofencing] Permission background refusée');
        return;
      }
    }

    NativeModules.MosqueGeofencing.start();
    console.log('[MosqueGeofencing] Geofencing natif démarré');
  } catch (error) {
    console.log('[MosqueGeofencing] initBackgroundLocation error:', error);
  }
};

/**
 * Arrête le geofencing natif.
 */
export const stopBackgroundLocation = async (): Promise<void> => {
  try {
    NativeModules.MosqueGeofencing.stop();
    console.log('[MosqueGeofencing] Geofencing natif arrêté');
  } catch (error) {
    console.log('[MosqueGeofencing] stopBackgroundLocation error:', error);
  }
};

/**
 * Vérification immédiate de proximité (appelée quand l'app passe au premier plan).
 * Utilise Geolocation.getCurrentPosition avec haute précision.
 * INCHANGÉ — HomeScreen l'utilise pour le foreground check.
 */
export const checkMosqueProximityForeground = async (
  language: 'fr' | 'ar' = 'fr',
): Promise<boolean> => {
  try {
    const settings = await getMosqueProximitySettings();
    if (!settings.enabled) {
      console.log('[BackgroundLocation] Mode silencieux mosquée désactivé');
      return false;
    }

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
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000,
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
