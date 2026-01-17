/**
 * Service de notifications locales pour les prieres
 * Utilise @notifee/react-native pour des rappels precis
 */

import notifee, {
  TriggerType,
  TimestampTrigger,
  AndroidImportance,
  AuthorizationStatus,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PrayerTimings } from './prayerApi';

// ==================== TYPES ====================

export interface PrayerNotificationSettings {
  enabled: boolean;
  minutesBefore: number; // 5, 10, 15, 30
  prayers: {
    fajr: boolean;
    dhuhr: boolean;
    asr: boolean;
    maghrib: boolean;
    isha: boolean;
  };
}

type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

// ==================== CONSTANTES ====================

const SETTINGS_KEY = '@prayer_notification_settings';

const DEFAULT_SETTINGS: PrayerNotificationSettings = {
  enabled: true,
  minutesBefore: 15,
  prayers: {
    fajr: true,
    dhuhr: true,
    asr: true,
    maghrib: true,
    isha: true,
  },
};

// Noms des prières pour les notifications
const PRAYER_NAMES: Record<PrayerKey, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

// Mapping des noms Aladhan vers nos keys
const PRAYER_KEY_MAP: Record<string, PrayerKey> = {
  Fajr: 'fajr',
  Dhuhr: 'dhuhr',
  Asr: 'asr',
  Maghrib: 'maghrib',
  Isha: 'isha',
};

// ==================== SETTINGS ====================

/**
 * Recuperer les settings de notifications
 */
export const getPrayerNotificationSettings = async (): Promise<PrayerNotificationSettings> => {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge avec defaults pour les nouvelles proprietes
      return { ...DEFAULT_SETTINGS, ...parsed, prayers: { ...DEFAULT_SETTINGS.prayers, ...parsed.prayers } };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('[PrayerNotif] Erreur lecture settings:', error);
    return DEFAULT_SETTINGS;
  }
};

/**
 * Sauvegarder les settings de notifications
 */
export const savePrayerNotificationSettings = async (settings: PrayerNotificationSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('[PrayerNotif] Erreur sauvegarde settings:', error);
  }
};

// ==================== NOTIFICATIONS ====================

/**
 * Creer le channel Android (requis)
 */
const ensureChannel = async (): Promise<string> => {
  const channelId = await notifee.createChannel({
    id: 'prayer_reminders',
    name: 'Rappels de priere',
    description: 'Notifications avant les heures de priere',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
  return channelId;
};

/**
 * Demander les permissions de notification
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
};

/**
 * Parser une heure "HH:MM" en Date pour un jour donné
 */
const parsePrayerTime = (timeStr: string, baseDate: Date = new Date()): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

/**
 * Ajouter X jours à une date
 */
const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Soustraire des minutes d'une date
 */
const subMinutes = (date: Date, minutes: number): Date => {
  return new Date(date.getTime() - minutes * 60 * 1000);
};

/**
 * Annuler toutes les notifications de priere schedulees
 */
export const cancelAllPrayerNotifications = async (): Promise<void> => {
  try {
    // Recuperer toutes les notifs schedulees
    const triggers = await notifee.getTriggerNotificationIds();

    // Annuler celles qui commencent par 'prayer-'
    for (const id of triggers) {
      if (id.startsWith('prayer-')) {
        await notifee.cancelTriggerNotification(id);
      }
    }
    console.log('[PrayerNotif] Notifications annulees');
  } catch (error) {
    console.error('[PrayerNotif] Erreur annulation:', error);
  }
};

/**
 * Scheduler les notifications de priere pour aujourd'hui ET demain
 * 2 notifications par prière :
 * 1. RAPPEL : X minutes avant (configurable)
 * 2. À L'HEURE : pile à l'heure de la prière
 */
export const schedulePrayerNotifications = async (
  prayerTimes: PrayerTimings,
  settings: PrayerNotificationSettings
): Promise<void> => {
  try {
    // DEBUG: Afficher les settings reçus
    console.log('[PrayerNotif] ======== SCHEDULING START ========');
    console.log('[PrayerNotif] Settings received:', JSON.stringify(settings, null, 2));
    console.log('[PrayerNotif] minutesBefore:', settings.minutesBefore, typeof settings.minutesBefore);

    // Verifier si active
    if (!settings.enabled) {
      console.log('[PrayerNotif] Notifications desactivees');
      await cancelAllPrayerNotifications();
      return;
    }

    // Verifier les permissions
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('[PrayerNotif] Permissions refusees');
      return;
    }

    // Creer le channel Android
    const channelId = await ensureChannel();

    // Annuler les anciennes notifs
    await cancelAllPrayerNotifications();

    const now = new Date();
    const today = new Date();
    const tomorrow = addDays(today, 1);

    console.log('[PrayerNotif] Current time:', now.toLocaleString('fr-FR'));
    const scheduledPrayers: string[] = [];

    // Scheduler pour les 6 prochains jours maximum
    // IMPORTANT: iOS limite à 64 notifications locales planifiées par app
    // 5 prières × 2 notifs × 6 jours = 60 notifications (sous la limite)
    const MAX_DAYS = 6;
    const daysToSchedule: { date: Date; suffix: string }[] = [];
    for (let i = 0; i < MAX_DAYS; i++) {
      daysToSchedule.push({
        date: addDays(today, i),
        suffix: `day${i}`,
      });
    }

    for (const { date: baseDate, suffix: daySuffix } of daysToSchedule) {
      // Pour chaque priere
      for (const [aladhanKey, prayerKey] of Object.entries(PRAYER_KEY_MAP)) {
        // Verifier si cette priere est activee
        if (!settings.prayers[prayerKey]) {
          continue;
        }

        // Recuperer l'heure de priere
        const prayerTimeStr = prayerTimes[aladhanKey as keyof PrayerTimings];
        if (!prayerTimeStr) continue;

        // Parser l'heure (enlever timezone si present)
        const cleanTime = prayerTimeStr.split(' ')[0];
        const prayerTime = parsePrayerTime(cleanTime, baseDate);
        const prayerName = PRAYER_NAMES[prayerKey];

        // ========== NOTIFICATION 1 : RAPPEL (X minutes avant) ==========
        if (settings.minutesBefore > 0) {
          const reminderTime = subMinutes(prayerTime, settings.minutesBefore);

          // Ne scheduler que si pas encore passé
          if (reminderTime > now) {
            const reminderTrigger: TimestampTrigger = {
              type: TriggerType.TIMESTAMP,
              timestamp: reminderTime.getTime(),
            };

            await notifee.createTriggerNotification(
              {
                id: `prayer-${prayerKey}-reminder-${daySuffix}`,
                title: prayerName,
                body: `${prayerName} dans ${settings.minutesBefore} mn`,
                android: {
                  channelId,
                  importance: AndroidImportance.HIGH,
                  pressAction: { id: 'default' },
                },
                ios: {
                  sound: 'default',
                },
              },
              reminderTrigger
            );

            console.log(`[PrayerNotif] ✅ Scheduled REMINDER for ${prayerKey} (${daySuffix}) at ${reminderTime.toLocaleString('fr-FR')}`);
            scheduledPrayers.push(`${prayerKey}-rappel-${daySuffix}`);
          }
        }

        // ========== NOTIFICATION 2 : À L'HEURE (pile à l'heure) ==========
        // Ne scheduler que si pas encore passé
        if (prayerTime > now) {
          const exactTrigger: TimestampTrigger = {
            type: TriggerType.TIMESTAMP,
            timestamp: prayerTime.getTime(),
          };

          await notifee.createTriggerNotification(
            {
              id: `prayer-${prayerKey}-now-${daySuffix}`,
              title: `${prayerName} maintenant`,
              body: `Prière ${prayerName} maintenant`,
              android: {
                channelId,
                importance: AndroidImportance.HIGH,
                pressAction: { id: 'default' },
              },
              ios: {
                sound: 'default',
              },
            },
            exactTrigger
          );

          scheduledPrayers.push(`${prayerKey}-maintenant-${daySuffix}`);
        }
      }
    }

    // ========== NOTIFICATION DE RAPPEL : Ouvrir l'app (jour 5) ==========
    // Rappel au jour 5 (dernier jour planifié) pour que l'utilisateur ouvre l'app
    // et re-planifie les notifications pour les jours suivants
    const reminderDate = addDays(today, MAX_DAYS - 1); // jour 5
    reminderDate.setHours(12, 0, 0, 0); // À midi

    if (reminderDate > now) {
      const appReminderTrigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: reminderDate.getTime(),
      };

      await notifee.createTriggerNotification(
        {
          id: 'prayer-app-reminder',
          title: '🕌 El Mouhssinine',
          body: 'Ouvrez l\'app pour continuer à recevoir les rappels de prière\nافتح التطبيق لمواصلة تلقي تذكيرات الصلاة',
          android: {
            channelId,
            importance: AndroidImportance.DEFAULT,
            pressAction: { id: 'default' },
          },
          ios: {
            sound: 'default',
          },
        },
        appReminderTrigger
      );
      console.log(`[PrayerNotif] ✅ Scheduled APP REMINDER for ${reminderDate.toLocaleString('fr-FR')}`);
      scheduledPrayers.push('app-reminder');
    }

    console.log('[PrayerNotif] ======== SCHEDULING COMPLETE ========');
    console.log('[PrayerNotif] Total scheduled:', scheduledPrayers.length);
    console.log('[PrayerNotif] iOS limit: 64 | Used:', scheduledPrayers.length);

    // Vérifier les notifications réellement schedulées par iOS
    const scheduledIds = await notifee.getTriggerNotificationIds();
    const prayerIds = scheduledIds.filter(id => id.startsWith('prayer-'));
    console.log('[PrayerNotif] Actually scheduled by iOS:', prayerIds.length);

    // Avertir si iOS a drop des notifications
    if (prayerIds.length < scheduledPrayers.length) {
      console.warn(`[PrayerNotif] ⚠️ iOS dropped ${scheduledPrayers.length - prayerIds.length} notifications (limit 64)`);
    }
  } catch (error) {
    console.error('[PrayerNotif] Erreur scheduling:', error);
  }
};

/**
 * Verifier les notifications schedulees (debug)
 */
export const getScheduledPrayerNotifications = async (): Promise<string[]> => {
  try {
    const triggers = await notifee.getTriggerNotificationIds();
    return triggers.filter(id => id.startsWith('prayer-'));
  } catch (error) {
    console.error('[PrayerNotif] Erreur getTriggers:', error);
    return [];
  }
};
