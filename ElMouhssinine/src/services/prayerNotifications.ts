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
import { logger } from '../utils';
import { addNotificationToHistory } from './notificationHistory';

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
    logger.error('[PrayerNotif] Erreur lecture settings:', error);
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
    logger.error('[PrayerNotif] Erreur sauvegarde settings:', error);
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
    logger.log('[PrayerNotif] Notifications annulees');
  } catch (error) {
    logger.error('[PrayerNotif] Erreur annulation:', error);
  }
};

/**
 * Récupérer les notifications schedulées avec leurs timestamps
 * Retourne un Map: notificationId -> timestamp
 */
const getScheduledNotificationsMap = async (): Promise<Map<string, number>> => {
  const map = new Map<string, number>();
  try {
    const notifications = await notifee.getTriggerNotifications();
    for (const notif of notifications) {
      if (notif.notification.id && notif.trigger.type === TriggerType.TIMESTAMP) {
        const trigger = notif.trigger as TimestampTrigger;
        map.set(notif.notification.id, trigger.timestamp);
      }
    }
  } catch (error) {
    logger.error('[PrayerNotif] Erreur récupération map:', error);
  }
  return map;
};

/**
 * Annuler uniquement les notifications obsolètes (passées ou jours trop anciens)
 * Garde les notifications futures valides
 */
const cleanupObsoleteNotifications = async (validIds: Set<string>): Promise<void> => {
  try {
    const triggers = await notifee.getTriggerNotificationIds();
    const now = Date.now();
    const existingMap = await getScheduledNotificationsMap();

    for (const id of triggers) {
      if (!id.startsWith('prayer-')) continue;

      // Supprimer si:
      // 1. L'ID n'est pas dans la liste des IDs valides pour cette session
      // 2. OU le timestamp est déjà passé
      const timestamp = existingMap.get(id);
      const isObsolete = !validIds.has(id) || (timestamp && timestamp <= now);

      if (isObsolete) {
        await notifee.cancelTriggerNotification(id);
        logger.log(`[PrayerNotif] Removed obsolete: ${id}`);
      }
    }
  } catch (error) {
    logger.error('[PrayerNotif] Erreur cleanup:', error);
  }
};

/**
 * Scheduler les notifications de priere pour aujourd'hui ET demain
 * 2 notifications par prière :
 * 1. RAPPEL : X minutes avant (configurable)
 * 2. À L'HEURE : pile à l'heure de la prière
 *
 * IMPORTANT: Utilise une approche de réconciliation intelligente
 * pour ne pas supprimer les notifications encore valides quand l'utilisateur
 * ouvre l'app fréquemment.
 */
export const schedulePrayerNotifications = async (
  prayerTimes: PrayerTimings,
  settings: PrayerNotificationSettings
): Promise<void> => {
  try {
    // DEBUG: Afficher les settings reçus
    logger.log('[PrayerNotif] ======== SCHEDULING START ========');
    logger.log('[PrayerNotif] Settings received:', JSON.stringify(settings, null, 2));
    logger.log('[PrayerNotif] minutesBefore:', settings.minutesBefore, typeof settings.minutesBefore);

    // Verifier si active
    if (!settings.enabled) {
      logger.log('[PrayerNotif] Notifications desactivees');
      await cancelAllPrayerNotifications();
      return;
    }

    // Verifier les permissions
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      logger.log('[PrayerNotif] Permissions refusees');
      return;
    }

    // Creer le channel Android
    const channelId = await ensureChannel();

    // NOUVEAU: Récupérer les notifications existantes pour comparaison
    // On ne supprime plus aveuglément, on fait une réconciliation intelligente
    const existingNotifs = await getScheduledNotificationsMap();
    logger.log(`[PrayerNotif] Existing notifications: ${existingNotifs.size}`);

    const now = new Date();
    const today = new Date();

    logger.log('[PrayerNotif] Current time:', now.toLocaleString('fr-FR'));
    const scheduledPrayers: string[] = [];
    const validNotificationIds = new Set<string>(); // IDs qui doivent rester

    // Scheduler pour les prochains jours
    // IMPORTANT: iOS limite à 64 notifications locales planifiées par app
    // Calcul: 2 notifs/prière × 5 prières × jours + app reminder + marge boost
    // Si boost activé: 3 jours (30 notifs prière + ~20 boost = 50, marge pour app reminder)
    // Si boost désactivé: 4 jours (40 notifs prière + 1 app reminder = 41, large marge)
    const boostSettings = await getBoostSettings();
    const MAX_DAYS = boostSettings.enabled ? 3 : 4;
    logger.log(`[PrayerNotif] MAX_DAYS: ${MAX_DAYS} (boost ${boostSettings.enabled ? 'enabled' : 'disabled'})`);
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
          // Vendredi + Dhuhr = Jumu'a : notification spéciale à 13h00
          const isFriday = baseDate.getDay() === 5;
          const isJumua = isFriday && prayerKey === 'dhuhr';

          // Pour Jumua : notification 30 min avant le sermon (13h30)
          // Pour les autres prières : notification X min avant l'adhan
          const jumuaSermonTime = parsePrayerTime('13:30', baseDate);
          const reminderTime = isJumua
            ? subMinutes(jumuaSermonTime, 30) // 13:00
            : subMinutes(prayerTime, settings.minutesBefore);
          const reminderId = `prayer-${prayerKey}-reminder-${daySuffix}`;
          const reminderTimestamp = reminderTime.getTime();

          // Ne scheduler que si pas encore passé
          if (reminderTime > now) {
            validNotificationIds.add(reminderId);

            // Vérifier si déjà schedulée avec le bon timestamp
            const existingTimestamp = existingNotifs.get(reminderId);
            const alreadyScheduled = existingTimestamp && Math.abs(existingTimestamp - reminderTimestamp) < 60000; // 1 min tolerance

            if (!alreadyScheduled) {
              // Supprimer l'ancienne si elle existe avec un mauvais timestamp
              if (existingTimestamp) {
                await notifee.cancelTriggerNotification(reminderId);
              }

              const reminderTrigger: TimestampTrigger = {
                type: TriggerType.TIMESTAMP,
                timestamp: reminderTimestamp,
              };

              const notifTitle = isJumua ? "🕌 Jumu'a" : prayerName;
              const notifBody = isJumua
                ? 'Le sermon commence à 13h30'
                : `${prayerName} dans ${settings.minutesBefore} mn`;

              await notifee.createTriggerNotification(
                {
                  id: reminderId,
                  title: notifTitle,
                  body: notifBody,
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

              logger.log(`[PrayerNotif] ✅ Scheduled REMINDER for ${prayerKey} (${daySuffix}) at ${reminderTime.toLocaleString('fr-FR')}${isJumua ? ' [JUMUA]' : ''}`);
            } else {
              logger.log(`[PrayerNotif] ⏭️ REMINDER already scheduled for ${prayerKey} (${daySuffix})`);
            }
            scheduledPrayers.push(`${prayerKey}-rappel-${daySuffix}`);
          }
        }

        // ========== NOTIFICATION 2 : À L'HEURE (pile à l'heure) ==========
        const nowId = `prayer-${prayerKey}-now-${daySuffix}`;
        const nowTimestamp = prayerTime.getTime();

        // Ne scheduler que si pas encore passé
        if (prayerTime > now) {
          validNotificationIds.add(nowId);

          // Vérifier si déjà schedulée avec le bon timestamp
          const existingTimestamp = existingNotifs.get(nowId);
          const alreadyScheduled = existingTimestamp && Math.abs(existingTimestamp - nowTimestamp) < 60000; // 1 min tolerance

          if (!alreadyScheduled) {
            // Supprimer l'ancienne si elle existe avec un mauvais timestamp
            if (existingTimestamp) {
              await notifee.cancelTriggerNotification(nowId);
            }

            const exactTrigger: TimestampTrigger = {
              type: TriggerType.TIMESTAMP,
              timestamp: nowTimestamp,
            };

            // Vendredi + Dhuhr = Jumu'a
            const isFriday = baseDate.getDay() === 5;
            const isJumua = isFriday && prayerKey === 'dhuhr';
            const nowTitle = isJumua ? "🕌 Jumu'a maintenant" : `${prayerName} maintenant`;
            const nowBody = isJumua
              ? 'Sermon en cours - Prière collective ~14h'
              : `Prière ${prayerName} maintenant`;

            await notifee.createTriggerNotification(
              {
                id: nowId,
                title: nowTitle,
                body: nowBody,
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

            logger.log(`[PrayerNotif] ✅ Scheduled NOW for ${prayerKey} (${daySuffix}) at ${prayerTime.toLocaleString('fr-FR')}${isJumua ? ' [JUMUA]' : ''}`);
          } else {
            logger.log(`[PrayerNotif] ⏭️ NOW already scheduled for ${prayerKey} (${daySuffix})`);
          }
          scheduledPrayers.push(`${prayerKey}-maintenant-${daySuffix}`);
        }
      }
    }

    // ========== NOTIFICATION DE RAPPEL : Ouvrir l'app (dernier jour) ==========
    // Rappel à l'avant-dernier jour planifié pour que l'utilisateur ouvre l'app
    // et re-planifie les notifications pour les jours suivants
    // Si boost activé: jour 2 | Si boost désactivé: jour 5
    const reminderDate = addDays(today, MAX_DAYS - 1);
    reminderDate.setHours(12, 0, 0, 0); // À midi
    const appReminderId = 'prayer-app-reminder';

    if (reminderDate > now) {
      validNotificationIds.add(appReminderId);
      const appReminderTimestamp = reminderDate.getTime();
      const existingTimestamp = existingNotifs.get(appReminderId);
      const alreadyScheduled = existingTimestamp && Math.abs(existingTimestamp - appReminderTimestamp) < 60000;

      if (!alreadyScheduled) {
        if (existingTimestamp) {
          await notifee.cancelTriggerNotification(appReminderId);
        }

        const appReminderTrigger: TimestampTrigger = {
          type: TriggerType.TIMESTAMP,
          timestamp: appReminderTimestamp,
        };

        await notifee.createTriggerNotification(
          {
            id: appReminderId,
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
        logger.log(`[PrayerNotif] ✅ Scheduled APP REMINDER for ${reminderDate.toLocaleString('fr-FR')}`);
      } else {
        logger.log('[PrayerNotif] ⏭️ APP REMINDER already scheduled');
      }
      scheduledPrayers.push('app-reminder');
    }

    // NOUVEAU: Nettoyer uniquement les notifications obsolètes
    // (celles qui ne sont plus dans la liste des IDs valides)
    await cleanupObsoleteNotifications(validNotificationIds);

    logger.log('[PrayerNotif] ======== SCHEDULING COMPLETE ========');
    logger.log('[PrayerNotif] Total scheduled:', scheduledPrayers.length);
    logger.log('[PrayerNotif] iOS limit: 64 | Used:', scheduledPrayers.length);

    // Vérifier les notifications réellement schedulées par iOS
    const scheduledIds = await notifee.getTriggerNotificationIds();
    const prayerIds = scheduledIds.filter(id => id.startsWith('prayer-'));
    logger.log('[PrayerNotif] Actually scheduled by iOS:', prayerIds.length);

    // Avertir si iOS a drop des notifications
    if (prayerIds.length < scheduledPrayers.length) {
      logger.warn(`[PrayerNotif] ⚠️ iOS dropped ${scheduledPrayers.length - prayerIds.length} notifications (limit 64)`);
    }
  } catch (error) {
    logger.error('[PrayerNotif] Erreur scheduling:', error);
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
    logger.error('[PrayerNotif] Erreur getTriggers:', error);
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
    logger.log('[PrayerBoost] Notifications boost annulées');
  } catch (error) {
    logger.error('[PrayerBoost] Erreur annulation:', error);
  }
};

/**
 * Nettoyer les notifications boost obsolètes (garde celles valides)
 */
const cleanupObsoleteBoostNotifications = async (validIds: Set<string>): Promise<void> => {
  try {
    const triggers = await notifee.getTriggerNotificationIds();
    const now = Date.now();
    const existingMap = await getScheduledNotificationsMap();

    for (const id of triggers) {
      if (!id.startsWith('boost_')) continue;

      const timestamp = existingMap.get(id);
      const isObsolete = !validIds.has(id) || (timestamp && timestamp <= now);

      if (isObsolete) {
        await notifee.cancelTriggerNotification(id);
        logger.log(`[PrayerBoost] Removed obsolete: ${id}`);
      }
    }
  } catch (error) {
    logger.error('[PrayerBoost] Erreur cleanup:', error);
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
    logger.log(`[PrayerBoost] ${cancelledCount} notifications annulées pour ${prayerKey}`);
  } catch (error) {
    logger.error('[PrayerBoost] Erreur annulation prière:', error);
  }
};

/**
 * Programme les notifications boost pour les prières
 * Fonction SÉPARÉE qui n'affecte pas les notifications classiques
 *
 * IMPORTANT: Utilise une approche de réconciliation intelligente
 * pour ne pas supprimer les notifications encore valides
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
      logger.log('[PrayerBoost] Feature désactivée');
      return;
    }

    logger.log('[PrayerBoost] ======== SCHEDULING START ========');

    // Vérifier les permissions
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      logger.log('[PrayerBoost] Permissions refusées');
      return;
    }

    // Créer le channel Android
    const channelId = await ensureBoostChannel();

    // NOUVEAU: Réconciliation intelligente au lieu de tout annuler
    const existingNotifs = await getScheduledNotificationsMap();
    const validNotificationIds = new Set<string>();

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
          logger.log(`[PrayerBoost] Temps manquant pour ${prayer.name}`);
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

          const boostId = `boost_${prayer.key}_${reminder.type}_${daySuffix}`;
          const boostTimestamp = notifDate.getTime();
          validNotificationIds.add(boostId);

          // Vérifier si déjà schedulée avec le bon timestamp
          const existingTimestamp = existingNotifs.get(boostId);
          const alreadyScheduled = existingTimestamp && Math.abs(existingTimestamp - boostTimestamp) < 60000;

          if (alreadyScheduled) {
            logger.log(`[PrayerBoost] ⏭️ Already scheduled ${prayer.name} ${reminder.type} (${daySuffix})`);
            scheduledCount++;
            continue;
          }

          // Supprimer l'ancienne si elle existe avec un mauvais timestamp
          if (existingTimestamp) {
            await notifee.cancelTriggerNotification(boostId);
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
            timestamp: boostTimestamp,
          };

          await notifee.createTriggerNotification(
            {
              id: boostId,
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
          logger.log(`[PrayerBoost] ✅ ${prayer.name} ${reminder.type} (${daySuffix}) at ${notifDate.toLocaleString('fr-FR')}`);
        }
      }
    }

    // NOUVEAU: Nettoyer uniquement les notifications boost obsolètes
    await cleanupObsoleteBoostNotifications(validNotificationIds);

    logger.log('[PrayerBoost] ======== SCHEDULING COMPLETE ========');
    logger.log(`[PrayerBoost] Total scheduled: ${scheduledCount}`);
  } catch (error) {
    logger.error('[PrayerBoost] Erreur scheduling:', error);
  }
};

/**
 * Sauvegarder les settings boost
 */
export const saveBoostSettings = async (settings: PrayerBoostSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(BOOST_SETTINGS_KEY, JSON.stringify(settings));
    logger.log('[PrayerBoost] Settings sauvegardés');
  } catch (error) {
    logger.error('[PrayerBoost] Erreur sauvegarde settings:', error);
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
    logger.error('[PrayerBoost] Erreur lecture settings:', error);
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
    logger.error('[PrayerBoost] Erreur getTriggers:', error);
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
    logger.log('[QuranReminder] Notifications annulées');
  } catch (error) {
    logger.error('[QuranReminder] Erreur annulation:', error);
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
      logger.log('[QuranReminder] Feature désactivée');
      return;
    }

    logger.log('[QuranReminder] ======== SCHEDULING START ========');

    // Vérifier les permissions
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      logger.log('[QuranReminder] Permissions refusées');
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
      logger.log(`[QuranReminder] ✅ Scheduled for ${notifDate.toLocaleString('fr-FR')}`);
    }

    logger.log('[QuranReminder] ======== SCHEDULING COMPLETE ========');
    logger.log(`[QuranReminder] Total scheduled: ${scheduledCount}`);
  } catch (error) {
    logger.error('[QuranReminder] Erreur scheduling:', error);
  }
};

/**
 * Sauvegarder les settings de rappel Coran
 */
export const saveQuranReminderSettings = async (settings: QuranReminderSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(QURAN_REMINDER_SETTINGS_KEY, JSON.stringify(settings));
    logger.log('[QuranReminder] Settings sauvegardés');
  } catch (error) {
    logger.error('[QuranReminder] Erreur sauvegarde settings:', error);
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
    logger.error('[QuranReminder] Erreur lecture settings:', error);
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

    logger.log(`[MosqueProximity] Distance: ${Math.round(distance)}m`);

    // Vérifier si dans le rayon
    if (distance > PROXIMITY_RADIUS_METERS) {
      return false;
    }

    // Vérifier le délai depuis la dernière notification
    const lastNotifTime = await AsyncStorage.getItem(LAST_MOSQUE_NOTIF_KEY);
    if (lastNotifTime) {
      const elapsed = Date.now() - parseInt(lastNotifTime, 10);
      if (elapsed < MIN_NOTIF_INTERVAL_MS) {
        logger.log('[MosqueProximity] Notification récente, skip');
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

    // Ajouter à l'historique des notifications
    await addNotificationToHistory(translations.title, translations.body, 'other');

    // Enregistrer le timestamp
    await AsyncStorage.setItem(LAST_MOSQUE_NOTIF_KEY, Date.now().toString());
    logger.log('[MosqueProximity] ✅ Notification envoyée !');

    return true;
  } catch (error) {
    logger.error('[MosqueProximity] Erreur:', error);
    return false;
  }
};

/**
 * Sauvegarder les settings de proximité mosquée
 */
export const saveMosqueProximitySettings = async (settings: MosqueProximitySettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(MOSQUE_PROXIMITY_SETTINGS_KEY, JSON.stringify(settings));
    logger.log('[MosqueProximity] Settings sauvegardés');
  } catch (error) {
    logger.error('[MosqueProximity] Erreur sauvegarde settings:', error);
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
    logger.error('[MosqueProximity] Erreur lecture settings:', error);
    return DEFAULT_MOSQUE_PROXIMITY_SETTINGS;
  }
};

// ==================== NOTIFICATIONS RAMADAN ====================

export interface RamadanUserNotificationSettings {
  suhoor: {
    enabled: boolean;
    minutesBefore: number; // 15, 30, 45
  };
  iftar: {
    enabled: boolean;
    minutesBefore: number; // 5, 10, 15
  };
  tarawih: {
    enabled: boolean;
    minutesBefore: number; // 10, 15, 30
  };
}

export const DEFAULT_RAMADAN_NOTIFICATION_SETTINGS: RamadanUserNotificationSettings = {
  suhoor: {
    enabled: true,
    minutesBefore: 30,
  },
  iftar: {
    enabled: true,
    minutesBefore: 5,
  },
  tarawih: {
    enabled: true,
    minutesBefore: 15,
  },
};

const RAMADAN_NOTIFICATION_SETTINGS_KEY = 'ramadan_notification_settings';

/**
 * Créer le channel Android pour les notifications Ramadan
 */
const ensureRamadanChannel = async (): Promise<string> => {
  const channelId = await notifee.createChannel({
    id: 'ramadan-reminders',
    name: 'Rappels Ramadan',
    description: 'Notifications Suhoor, Iftar et Tarawih',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
  return channelId;
};

/**
 * Annuler les notifications Ramadan
 */
export const cancelRamadanNotifications = async (): Promise<void> => {
  try {
    const notifications = await notifee.getTriggerNotificationIds();
    for (const id of notifications) {
      if (id.startsWith('ramadan_')) {
        await notifee.cancelTriggerNotification(id);
      }
    }
    logger.log('[RamadanNotif] Notifications annulées');
  } catch (error) {
    logger.error('[RamadanNotif] Erreur annulation:', error);
  }
};

/**
 * Programmer les notifications Ramadan (Suhoor, Iftar, Tarawih)
 * @param prayerTimes - Horaires de prière du jour (Fajr = fin Suhoor, Maghrib = Iftar)
 * @param tarawihTime - Heure de Tarawih (ex: "21:30")
 * @param settings - Préférences utilisateur pour les notifications
 * @param translations - Textes traduits FR/AR
 */
export const scheduleRamadanNotifications = async (
  prayerTimes: PrayerTimings | Record<string, string>,
  tarawihTime: string | null,
  settings: RamadanUserNotificationSettings,
  translations: {
    suhoorTitle: string;
    suhoorBody: string;
    iftarTitle: string;
    iftarBody: string;
    tarawihTitle: string;
    tarawihBody: string;
  }
): Promise<void> => {
  try {
    logger.log('[RamadanNotif] ======== SCHEDULING START ========');

    // Vérifier les permissions
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      logger.log('[RamadanNotif] Permissions refusées');
      return;
    }

    // Créer le channel Android
    const channelId = await ensureRamadanChannel();

    // Annuler les anciennes notifications
    await cancelRamadanNotifications();

    const timings = prayerTimes as Record<string, string>;
    const now = new Date();
    let scheduledCount = 0;

    // Scheduler pour les 7 prochains jours
    for (let i = 0; i < 7; i++) {
      const baseDate = addDays(new Date(), i);
      const daySuffix = `day${i}`;

      // ========== SUHOOR (avant Fajr) ==========
      if (settings.suhoor.enabled) {
        const fajrTime = timings.Fajr || timings.fajr;
        if (fajrTime) {
          const cleanFajr = fajrTime.split(' ')[0];
          const fajrDate = parsePrayerTime(cleanFajr, baseDate);
          const suhoorDate = subMinutes(fajrDate, settings.suhoor.minutesBefore);

          if (suhoorDate > now) {
            const suhoorId = `ramadan_suhoor_${daySuffix}`;
            const trigger: TimestampTrigger = {
              type: TriggerType.TIMESTAMP,
              timestamp: suhoorDate.getTime(),
            };

            await notifee.createTriggerNotification(
              {
                id: suhoorId,
                title: translations.suhoorTitle,
                body: translations.suhoorBody.replace('{minutes}', settings.suhoor.minutesBefore.toString()),
                android: {
                  channelId,
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
            logger.log(`[RamadanNotif] ✅ Suhoor (${daySuffix}) at ${suhoorDate.toLocaleString('fr-FR')}`);
          }
        }
      }

      // ========== IFTAR (à Maghrib ou avant) ==========
      if (settings.iftar.enabled) {
        const maghribTime = timings.Maghrib || timings.maghrib;
        if (maghribTime) {
          const cleanMaghrib = maghribTime.split(' ')[0];
          const maghribDate = parsePrayerTime(cleanMaghrib, baseDate);
          const iftarDate = subMinutes(maghribDate, settings.iftar.minutesBefore);

          if (iftarDate > now) {
            const iftarId = `ramadan_iftar_${daySuffix}`;
            const trigger: TimestampTrigger = {
              type: TriggerType.TIMESTAMP,
              timestamp: iftarDate.getTime(),
            };

            const bodyText = settings.iftar.minutesBefore === 0
              ? translations.iftarBody.replace(' dans {minutes} min', '')
              : translations.iftarBody.replace('{minutes}', settings.iftar.minutesBefore.toString());

            await notifee.createTriggerNotification(
              {
                id: iftarId,
                title: translations.iftarTitle,
                body: bodyText,
                android: {
                  channelId,
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
            logger.log(`[RamadanNotif] ✅ Iftar (${daySuffix}) at ${iftarDate.toLocaleString('fr-FR')}`);
          }
        }
      }

      // ========== TARAWIH ==========
      if (settings.tarawih.enabled && tarawihTime) {
        const cleanTarawih = tarawihTime.split(' ')[0];
        const tarawihDate = parsePrayerTime(cleanTarawih, baseDate);
        const reminderDate = subMinutes(tarawihDate, settings.tarawih.minutesBefore);

        if (reminderDate > now) {
          const tarawihId = `ramadan_tarawih_${daySuffix}`;
          const trigger: TimestampTrigger = {
            type: TriggerType.TIMESTAMP,
            timestamp: reminderDate.getTime(),
          };

          await notifee.createTriggerNotification(
            {
              id: tarawihId,
              title: translations.tarawihTitle,
              body: translations.tarawihBody.replace('{minutes}', settings.tarawih.minutesBefore.toString()),
              android: {
                channelId,
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
          logger.log(`[RamadanNotif] ✅ Tarawih (${daySuffix}) at ${reminderDate.toLocaleString('fr-FR')}`);
        }
      }
    }

    logger.log('[RamadanNotif] ======== SCHEDULING COMPLETE ========');
    logger.log(`[RamadanNotif] Total scheduled: ${scheduledCount}`);
  } catch (error) {
    logger.error('[RamadanNotif] Erreur scheduling:', error);
  }
};

/**
 * Sauvegarder les settings de notification Ramadan
 */
export const saveRamadanNotificationSettings = async (settings: RamadanUserNotificationSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(RAMADAN_NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
    logger.log('[RamadanNotif] Settings sauvegardés');
  } catch (error) {
    logger.error('[RamadanNotif] Erreur sauvegarde settings:', error);
  }
};

/**
 * Récupérer les settings de notification Ramadan
 */
export const getRamadanNotificationSettings = async (): Promise<RamadanUserNotificationSettings> => {
  try {
    const stored = await AsyncStorage.getItem(RAMADAN_NOTIFICATION_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_RAMADAN_NOTIFICATION_SETTINGS,
        suhoor: { ...DEFAULT_RAMADAN_NOTIFICATION_SETTINGS.suhoor, ...parsed.suhoor },
        iftar: { ...DEFAULT_RAMADAN_NOTIFICATION_SETTINGS.iftar, ...parsed.iftar },
        tarawih: { ...DEFAULT_RAMADAN_NOTIFICATION_SETTINGS.tarawih, ...parsed.tarawih },
      };
    }
    return DEFAULT_RAMADAN_NOTIFICATION_SETTINGS;
  } catch (error) {
    logger.error('[RamadanNotif] Erreur lecture settings:', error);
    return DEFAULT_RAMADAN_NOTIFICATION_SETTINGS;
  }
};
