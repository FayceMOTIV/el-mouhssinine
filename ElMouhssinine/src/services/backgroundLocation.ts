/**
 * Location Service — Foreground only
 *
 * Checks mosque proximity when the app is in the foreground.
 * No background location is used.
 */

import Geolocation from '@react-native-community/geolocation';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  checkMosqueProximity,
  getMosqueProximitySettings,
} from './prayerNotifications';

let geolocationConfigured = false;

const ensureGeolocationConfigured = () => {
  if (geolocationConfigured) return;
  try {
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: 'whenInUse',
      enableBackgroundLocationUpdates: false,
      locationProvider: 'auto',
    });
    geolocationConfigured = true;
  } catch (e) {
    console.warn('[Location] setRNConfiguration failed:', e);
  }
};

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

export const initBackgroundLocation = async (): Promise<void> => {
  // No-op: foreground-only location checks.
  // This function exists to satisfy the import in App.tsx.
};

export const stopBackgroundLocation = async (): Promise<void> => {};

/**
 * Foreground-only proximity check — called when the app comes to foreground.
 */
export const checkMosqueProximityForeground = async (
  language: 'fr' | 'ar' = 'fr',
): Promise<boolean> => {
  try {
    const disclosureChoice = await AsyncStorage.getItem('@el_mouhssinine/prominent_disclosure_v1');
    if (disclosureChoice !== 'accepted') {
      return false;
    }

    ensureGeolocationConfigured();
    const settings = await getMosqueProximitySettings();
    if (!settings.enabled) {
      return false;
    }

    if (Platform.OS === 'android') {
      try {
        const { PermissionsAndroid } = require('react-native');
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          return false;
        }
      } catch {
        // Permission API unavailable, try anyway
      }
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
            console.log('[Location] Foreground geoloc error:', error.message);
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
              console.log('[Location] Foreground auth error:', err);
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
    console.error('[Location] Foreground check error:', error);
    return false;
  }
};
