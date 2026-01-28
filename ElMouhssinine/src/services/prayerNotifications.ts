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

// ==================== BOOST TYPES (Feature optionnelle) ====================

export interface PrayerBoostSettings {
  enabled: boolean;                    // Feature activée ou non
  reminders: {
    atAdhan: boolean;                  // Rappel à l'Adhan (déjà géré par l'existant)
    after30min: boolean;               // Rappel 30 min après Adhan
    atMidTime: boolean;                // Rappel à mi-temps
    before15minEnd: boolean;           // Rappel urgent 15 min avant fin
  };
  prayers: {
    fajr: boolean;
    dhuhr: boolean;
    asr: boolean;
    maghrib: boolean;
    isha: boolean;
  };
}

export const DEFAULT_PRAYER_BOOST_SETTINGS: PrayerBoostSettings = {
  enabled: false,  // DÉSACTIVÉ par défaut
  reminders: {
    atAdhan: true,
    after30min: true,
    atMidTime: true,
    before15minEnd: true,
  },
  prayers: {
    fajr: true,
    dhuhr: true,
    asr: true,
    maghrib: true,
    isha: true,
  },
};

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

    // Scheduler pour les prochains jours
    // IMPORTANT: iOS limite à 64 notifications locales planifiées par app
    // Si boost est activé, on réduit à 3 jours (30 notifs) pour laisser place au boost (~30 notifs)
    // Si boost désactivé, on utilise 6 jours (60 notifs)
    const boostSettings = await getBoostSettings();
    const MAX_DAYS = boostSettings.enabled ? 3 : 6;
    console.log(`[PrayerNotif] MAX_DAYS: ${MAX_DAYS} (boost ${boostSettings.enabled ? 'enabled' : 'disabled'})`);
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

// ==================== BOOST PRIÈRE (Feature optionnelle) ====================
// Cette section est 100% indépendante du système de notifications classique
// Elle utilise ses propres préfixes, channel et clé de stockage

// Ordre des prières pour calculer les fins
const PRAYER_ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

// Clé AsyncStorage pour les settings boost (séparée des settings classiques)
const BOOST_SETTINGS_KEY = 'prayer_boost_settings';

/**
 * Calcule la fin d'une prière selon le madhab Malikite
 */
export const getPrayerEndTime = (
  prayerName: string,
  prayerTimings: PrayerTimings | Record<string, string>
): string | null => {
  const timings = prayerTimings as Record<string, string>;
  const prayerLower = prayerName.toLowerCase();
  const currentIndex = PRAYER_ORDER.indexOf(prayerLower);
  if (currentIndex === -1) return null;

  // Cas spéciaux
  if (prayerLower === 'fajr') {
    // Fajr se termine au lever du soleil
    return timings.Sunrise || timings.sunrise || null;
  }

  if (prayerLower === 'maghrib') {
    // MALIKITES: Maghrib a une fenêtre TRÈS COURTE (~20 min après le coucher du soleil)
    const maghribTime = timings.Maghrib || timings.maghrib;
    if (!maghribTime) return null;
    const [h, m] = maghribTime.split(':').map(Number);
    const endMinutes = h * 60 + m + 20; // +20 minutes
    const endH = Math.floor(endMinutes / 60) % 24;
    const endM = endMinutes % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  }

  if (prayerLower === 'isha') {
    // Isha: on utilise juste 1h après pour le calcul (mais on n'enverra qu'une notif)
    const ishaTime = timings.Isha || timings.isha;
    if (!ishaTime) return null;
    const [h, m] = ishaTime.split(':').map(Number);
    const endMinutes = h * 60 + m + 60; // +60 minutes pour le calcul
    const endH = Math.floor(endMinutes / 60) % 24;
    const endM = endMinutes % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  }

  // Dhuhr et Asr: fin = début de la prière suivante
  const nextPrayer = PRAYER_ORDER[currentIndex + 1];
  const nextKey = nextPrayer.charAt(0).toUpperCase() + nextPrayer.slice(1);
  return timings[nextKey] || timings[nextPrayer] || null;
};

/**
 * Calcule les moments de rappel pour une prière (adapté Malikites)
 */
export const calculateBoostReminders = (
  prayerName: string,
  startTime: string,  // "13:15"
  endTime: string,    // "16:30"
  settings: PrayerBoostSettings
): { time: string; type: 'after30min' | 'midTime' | 'before15min' }[] => {
  const reminders: { time: string; type: 'after30min' | 'midTime' | 'before15min' }[] = [];
  const prayerLower = prayerName.toLowerCase();

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  // Gestion du passage à minuit
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  const totalMinutes = endMinutes - startMinutes;

  // ============ CAS SPÉCIAUX ============

  // ISHA: Une seule notification 30 min après (pas de mi-temps ni urgence)
  if (prayerLower === 'isha') {
    if (settings.reminders.after30min) {
      const reminderMinutes = startMinutes + 30;
      const h = Math.floor(reminderMinutes / 60) % 24;
      const m = reminderMinutes % 60;
      reminders.push({
        time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
        type: 'after30min'
      });
    }
    return reminders; // Retourne uniquement cette notif pour Isha
  }

  // MAGHRIB (Malikites): Fenêtre très courte (~20 min)
  // Juste une notif 5 min après l'adhan pour rappeler de prier rapidement
  if (prayerLower === 'maghrib') {
    if (settings.reminders.after30min) { // On réutilise le toggle after30min
      const reminderMinutes = startMinutes + 5; // 5 min après Maghrib
      const h = Math.floor(reminderMinutes / 60) % 24;
      const m = reminderMinutes % 60;
      reminders.push({
        time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
        type: 'after30min'
      });
    }
    return reminders; // Retourne uniquement cette notif pour Maghrib
  }

  // ============ CAS NORMAUX (Fajr, Dhuhr, Asr) ============

  // Rappel 30 min après Adhan
  if (settings.reminders.after30min && totalMinutes > 30) {
    const reminderMinutes = startMinutes + 30;
    const h = Math.floor(reminderMinutes / 60) % 24;
    const m = reminderMinutes % 60;
    reminders.push({
      time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
      type: 'after30min'
    });
  }

  // Rappel à mi-temps
  if (settings.reminders.atMidTime && totalMinutes > 60) {
    const midMinutes = startMinutes + Math.floor(totalMinutes / 2);
    const h = Math.floor(midMinutes / 60) % 24;
    const m = midMinutes % 60;
    reminders.push({
      time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
      type: 'midTime'
    });
  }

  // Rappel 15 min avant la fin
  if (settings.reminders.before15minEnd && totalMinutes > 20) {
    const urgentMinutes = endMinutes - 15;
    const h = Math.floor(urgentMinutes / 60) % 24;
    const m = urgentMinutes % 60;
    reminders.push({
      time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
      type: 'before15min'
    });
  }

  return reminders;
};

/**
 * Créer le channel Android pour les notifications boost
 */
const ensureBoostChannel = async (): Promise<string> => {
  const channelId = await notifee.createChannel({
    id: 'prayer-boost',
    name: 'Boost Prière',
    description: 'Rappels progressifs pour les prières',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
  return channelId;
};

/**
 * Annule uniquement les notifications boost (pas les classiques)
 */
export const cancelBoostNotifications = async (): Promise<void> => {
  try {
    const notifications = await notifee.getTriggerNotificationIds();
    for (const id of notifications) {
      if (id.startsWith('boost_')) {
        await notifee.cancelTriggerNotification(id);
      }
    }
    console.log('[PrayerBoost] Notifications boost annulées');
  } catch (error) {
    console.error('[PrayerBoost] Erreur annulation:', error);
  }
};

/**
 * Annule les notifications boost pour une prière spécifique uniquement
 * Les notifications des autres prières restent actives
 */
export const cancelBoostNotificationsForPrayer = async (prayerKey: string): Promise<void> => {
  try {
    const notifications = await notifee.getTriggerNotificationIds();
    const prefix = `boost_${prayerKey.toLowerCase()}_`;
    let cancelledCount = 0;

    for (const id of notifications) {
      if (id.startsWith(prefix)) {
        await notifee.cancelTriggerNotification(id);
        cancelledCount++;
      }
    }
    console.log(`[PrayerBoost] ${cancelledCount} notifications annulées pour ${prayerKey}`);
  } catch (error) {
    console.error('[PrayerBoost] Erreur annulation prière:', error);
  }
};

/**
 * Programme les notifications boost pour les prières
 * Fonction SÉPARÉE qui n'affecte pas les notifications classiques
 */
export const scheduleBoostNotifications = async (
  prayerTimings: PrayerTimings | Record<string, string>,
  settings: PrayerBoostSettings,
  translations: {
    reminderTitle: string;
    urgentTitle: string;
    after30min: string;
    midTime: string;
    before15min: string;
  }
): Promise<void> => {
  try {
    // Si désactivé, annuler les notifications boost existantes
    if (!settings.enabled) {
      await cancelBoostNotifications();
      console.log('[PrayerBoost] Feature désactivée');
      return;
    }

    console.log('[PrayerBoost] ======== SCHEDULING START ========');

    // Vérifier les permissions
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('[PrayerBoost] Permissions refusées');
      return;
    }

    // Créer le channel Android
    const channelId = await ensureBoostChannel();

    // Annuler les anciennes notifications boost
    await cancelBoostNotifications();

    // Cast pour accès flexible aux propriétés
    const timings = prayerTimings as Record<string, string>;

    const prayers = [
      { key: 'fajr', name: 'Fajr' },
      { key: 'dhuhr', name: 'Dhuhr' },
      { key: 'asr', name: 'Asr' },
      { key: 'maghrib', name: 'Maghrib' },
      { key: 'isha', name: 'Isha' },
    ];

    const now = new Date();
    let scheduledCount = 0;

    // Scheduler pour aujourd'hui et demain
    const daysToSchedule = [
      { date: new Date(), suffix: 'today' },
      { date: addDays(new Date(), 1), suffix: 'tomorrow' },
    ];

    for (const { date: baseDate, suffix: daySuffix } of daysToSchedule) {
      for (const prayer of prayers) {
        // Vérifier si cette prière est activée dans les settings boost
        if (!settings.prayers[prayer.key as keyof typeof settings.prayers]) {
          continue;
        }

        const startTime = timings[prayer.name];
        const endTime = getPrayerEndTime(prayer.key, timings);

        if (!startTime || !endTime) {
          console.log(`[PrayerBoost] Temps manquant pour ${prayer.name}`);
          continue;
        }

        // Nettoyer l'heure (enlever timezone si présent)
        const cleanStartTime = startTime.split(' ')[0];
        const cleanEndTime = endTime.split(' ')[0];

        const reminders = calculateBoostReminders(prayer.key, cleanStartTime, cleanEndTime, settings);

        for (const reminder of reminders) {
          const [h, m] = reminder.time.split(':').map(Number);
          const notifDate = new Date(baseDate);
          notifDate.setHours(h, m, 0, 0);

          // Si l'heure est passée pour aujourd'hui, skip
          if (notifDate <= now) {
            continue;
          }

          // Message selon le type de rappel et la prière
          let title = '';
          let body = '';

          // MAGHRIB (Malikites): Message URGENT car fenêtre très courte
          if (prayer.key === 'maghrib') {
            title = '⚠️ ' + translations.urgentTitle;
            body = translations.before15min.replace('{prayer}', prayer.name); // "Plus que 15 min pour Maghrib !"
          }
          // ISHA: Message simple 30 min après
          else if (prayer.key === 'isha') {
            title = translations.reminderTitle;
            body = translations.after30min.replace('{prayer}', prayer.name);
          }
          // Autres prières (Fajr, Dhuhr, Asr): comportement normal
          else {
            switch (reminder.type) {
              case 'after30min':
                title = translations.reminderTitle;
                body = translations.after30min.replace('{prayer}', prayer.name);
                break;
              case 'midTime':
                title = translations.reminderTitle;
                body = translations.midTime.replace('{prayer}', prayer.name);
                break;
              case 'before15min':
                title = '⚠️ ' + translations.urgentTitle;
                body = translations.before15min.replace('{prayer}', prayer.name);
                break;
            }
          }

          const trigger: TimestampTrigger = {
            type: TriggerType.TIMESTAMP,
            timestamp: notifDate.getTime(),
          };

          await notifee.createTriggerNotification(
            {
              id: `boost_${prayer.key}_${reminder.type}_${daySuffix}`,
              title,
              body,
              android: {
                channelId,
                smallIcon: 'ic_notification',
                importance: AndroidImportance.HIGH,
                pressAction: { id: 'default' },
              },
              ios: {
                sound: 'default',
              },
            },
            trigger
          );

          scheduledCount++;
          console.log(`[PrayerBoost] ✅ ${prayer.name} ${reminder.type} (${daySuffix}) at ${notifDate.toLocaleString('fr-FR')}`);
        }
      }
    }

    console.log('[PrayerBoost] ======== SCHEDULING COMPLETE ========');
    console.log(`[PrayerBoost] Total scheduled: ${scheduledCount}`);
  } catch (error) {
    console.error('[PrayerBoost] Erreur scheduling:', error);
  }
};

/**
 * Sauvegarder les settings boost
 */
export const saveBoostSettings = async (settings: PrayerBoostSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(BOOST_SETTINGS_KEY, JSON.stringify(settings));
    console.log('[PrayerBoost] Settings sauvegardés');
  } catch (error) {
    console.error('[PrayerBoost] Erreur sauvegarde settings:', error);
  }
};

/**
 * Récupérer les settings boost
 */
export const getBoostSettings = async (): Promise<PrayerBoostSettings> => {
  try {
    const stored = await AsyncStorage.getItem(BOOST_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge avec defaults pour les nouvelles propriétés
      return {
        ...DEFAULT_PRAYER_BOOST_SETTINGS,
        ...parsed,
        reminders: { ...DEFAULT_PRAYER_BOOST_SETTINGS.reminders, ...parsed.reminders },
        prayers: { ...DEFAULT_PRAYER_BOOST_SETTINGS.prayers, ...parsed.prayers },
      };
    }
    return DEFAULT_PRAYER_BOOST_SETTINGS;
  } catch (error) {
    console.error('[PrayerBoost] Erreur lecture settings:', error);
    return DEFAULT_PRAYER_BOOST_SETTINGS;
  }
};

/**
 * Vérifier les notifications boost schedulées (debug)
 */
export const getScheduledBoostNotifications = async (): Promise<string[]> => {
  try {
    const triggers = await notifee.getTriggerNotificationIds();
    return triggers.filter(id => id.startsWith('boost_'));
  } catch (error) {
    console.error('[PrayerBoost] Erreur getTriggers:', error);
    return [];
  }
};

// ==================== RAPPEL CORAN (Quran Reading Reminders) ====================

export interface QuranReminderSettings {
  enabled: boolean;
  hour: number; // 8, 12, 18, 20, 22
  frequency: 'daily' | 'friday';
}

export const DEFAULT_QURAN_REMINDER_SETTINGS: QuranReminderSettings = {
  enabled: false,
  hour: 20,
  frequency: 'daily',
};

const QURAN_REMINDER_SETTINGS_KEY = 'quran_reminder_settings';

/**
 * Créer le channel Android pour les rappels Coran
 */
const ensureQuranChannel = async (): Promise<string> => {
  const channelId = await notifee.createChannel({
    id: 'quran-reminder',
    name: 'Rappels Coran',
    description: 'Rappels quotidiens de lecture du Coran',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
  });
  return channelId;
};

/**
 * Annuler les notifications de rappel Coran
 */
export const cancelQuranReminders = async (): Promise<void> => {
  try {
    const notifications = await notifee.getTriggerNotificationIds();
    for (const id of notifications) {
      if (id.startsWith('quran_reminder_')) {
        await notifee.cancelTriggerNotification(id);
      }
    }
    console.log('[QuranReminder] Notifications annulées');
  } catch (error) {
    console.error('[QuranReminder] Erreur annulation:', error);
  }
};

/**
 * Programmer les rappels de lecture du Coran
 */
export const scheduleQuranReminders = async (
  settings: QuranReminderSettings,
  translations: {
    title: string;
    body: string;
  }
): Promise<void> => {
  try {
    // Si désactivé, annuler les notifications existantes
    if (!settings.enabled) {
      await cancelQuranReminders();
      console.log('[QuranReminder] Feature désactivée');
      return;
    }

    console.log('[QuranReminder] ======== SCHEDULING START ========');

    // Vérifier les permissions
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('[QuranReminder] Permissions refusées');
      return;
    }

    // Créer le channel Android
    const channelId = await ensureQuranChannel();

    // Annuler les anciennes notifications
    await cancelQuranReminders();

    const now = new Date();
    let scheduledCount = 0;

    // Scheduler pour les 7 prochains jours
    for (let i = 0; i < 7; i++) {
      const notifDate = new Date();
      notifDate.setDate(notifDate.getDate() + i);
      notifDate.setHours(settings.hour, 0, 0, 0);

      // Skip si déjà passé
      if (notifDate <= now) continue;

      // Si frequency = friday, vérifier que c'est un vendredi
      if (settings.frequency === 'friday' && notifDate.getDay() !== 5) {
        continue;
      }

      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: notifDate.getTime(),
      };

      await notifee.createTriggerNotification(
        {
          id: `quran_reminder_day${i}`,
          title: translations.title,
          body: translations.body,
          android: {
            channelId,
            importance: AndroidImportance.DEFAULT,
            pressAction: { id: 'default' },
          },
          ios: {
            sound: 'default',
          },
        },
        trigger
      );

      scheduledCount++;
      console.log(`[QuranReminder] ✅ Scheduled for ${notifDate.toLocaleString('fr-FR')}`);
    }

    console.log('[QuranReminder] ======== SCHEDULING COMPLETE ========');
    console.log(`[QuranReminder] Total scheduled: ${scheduledCount}`);
  } catch (error) {
    console.error('[QuranReminder] Erreur scheduling:', error);
  }
};

/**
 * Sauvegarder les settings de rappel Coran
 */
export const saveQuranReminderSettings = async (settings: QuranReminderSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(QURAN_REMINDER_SETTINGS_KEY, JSON.stringify(settings));
    console.log('[QuranReminder] Settings sauvegardés');
  } catch (error) {
    console.error('[QuranReminder] Erreur sauvegarde settings:', error);
  }
};

/**
 * Récupérer les settings de rappel Coran
 */
export const getQuranReminderSettings = async (): Promise<QuranReminderSettings> => {
  try {
    const stored = await AsyncStorage.getItem(QURAN_REMINDER_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_QURAN_REMINDER_SETTINGS, ...parsed };
    }
    return DEFAULT_QURAN_REMINDER_SETTINGS;
  } catch (error) {
    console.error('[QuranReminder] Erreur lecture settings:', error);
    return DEFAULT_QURAN_REMINDER_SETTINGS;
  }
};

// ==================== MODE SILENCIEUX MOSQUÉE (Proximity Detection) ====================

export interface MosqueProximitySettings {
  enabled: boolean;
}

export const DEFAULT_MOSQUE_PROXIMITY_SETTINGS: MosqueProximitySettings = {
  enabled: true, // Activé par défaut
};

const MOSQUE_PROXIMITY_SETTINGS_KEY = 'mosque_proximity_settings';
const LAST_MOSQUE_NOTIF_KEY = 'last_mosque_proximity_notif';

// Coordonnées de la Mosquée El Mouhssinine
const MOSQUE_COORDS = {
  latitude: 46.2055668,
  longitude: 5.2477947,
};

// Rayon de détection en mètres
const PROXIMITY_RADIUS_METERS = 100;

// Intervalle minimum entre 2 notifications (30 minutes)
const MIN_NOTIF_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Calcule la distance entre deux points GPS (formule Haversine)
 */
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000; // Rayon de la Terre en mètres
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance en mètres
};

/**
 * Créer le channel Android pour les notifications mosquée
 */
const ensureMosqueChannel = async (): Promise<string> => {
  const channelId = await notifee.createChannel({
    id: 'mosque-proximity',
    name: 'Mode Silencieux Mosquée',
    description: 'Rappels quand vous êtes proche de la mosquée',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
  return channelId;
};

/**
 * Vérifie si l'utilisateur est proche de la mosquée et envoie une notification
 */
export const checkMosqueProximity = async (
  latitude: number,
  longitude: number,
  translations: {
    title: string;
    body: string;
  }
): Promise<boolean> => {
  try {
    // Vérifier si la feature est activée
    const settings = await getMosqueProximitySettings();
    if (!settings.enabled) {
      return false;
    }

    // Calculer la distance
    const distance = calculateDistance(
      latitude,
      longitude,
      MOSQUE_COORDS.latitude,
      MOSQUE_COORDS.longitude
    );

    console.log(`[MosqueProximity] Distance: ${Math.round(distance)}m`);

    // Vérifier si dans le rayon
    if (distance > PROXIMITY_RADIUS_METERS) {
      return false;
    }

    // Vérifier le délai depuis la dernière notification
    const lastNotifTime = await AsyncStorage.getItem(LAST_MOSQUE_NOTIF_KEY);
    if (lastNotifTime) {
      const elapsed = Date.now() - parseInt(lastNotifTime, 10);
      if (elapsed < MIN_NOTIF_INTERVAL_MS) {
        console.log('[MosqueProximity] Notification récente, skip');
        return false;
      }
    }

    // Créer le channel et envoyer la notification
    const channelId = await ensureMosqueChannel();

    await notifee.displayNotification({
      title: translations.title,
      body: translations.body,
      android: {
        channelId,
        smallIcon: 'ic_notification',
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
      },
      ios: {
        sound: 'default',
      },
    });

    // Enregistrer le timestamp
    await AsyncStorage.setItem(LAST_MOSQUE_NOTIF_KEY, Date.now().toString());
    console.log('[MosqueProximity] ✅ Notification envoyée !');

    return true;
  } catch (error) {
    console.error('[MosqueProximity] Erreur:', error);
    return false;
  }
};

/**
 * Sauvegarder les settings de proximité mosquée
 */
export const saveMosqueProximitySettings = async (settings: MosqueProximitySettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(MOSQUE_PROXIMITY_SETTINGS_KEY, JSON.stringify(settings));
    console.log('[MosqueProximity] Settings sauvegardés');
  } catch (error) {
    console.error('[MosqueProximity] Erreur sauvegarde settings:', error);
  }
};

/**
 * Récupérer les settings de proximité mosquée
 */
export const getMosqueProximitySettings = async (): Promise<MosqueProximitySettings> => {
  try {
    const stored = await AsyncStorage.getItem(MOSQUE_PROXIMITY_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_MOSQUE_PROXIMITY_SETTINGS, ...parsed };
    }
    return DEFAULT_MOSQUE_PROXIMITY_SETTINGS;
  } catch (error) {
    console.error('[MosqueProximity] Erreur lecture settings:', error);
    return DEFAULT_MOSQUE_PROXIMITY_SETTINGS;
  }
};
