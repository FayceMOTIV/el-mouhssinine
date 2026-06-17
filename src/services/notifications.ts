import notifee, {
  TriggerType,
  RepeatFrequency,
  AndroidImportance,
  AndroidStyle,
  AndroidStyle,
  TimestampTrigger,
  EventType,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils';
import { getParisDate } from './prayerApi';
import {
  addNotificationToHistory,
  detectNotificationType,
} from './notificationHistory';

// ==================== FCM TOPICS ====================

// Liste des topics disponibles
export const FCM_TOPICS = {
  ANNOUNCEMENTS: 'announcements',
  EVENTS: 'events',
  JANAZA: 'janaza',
  JUMUA: 'jumua',
  FAJR_REMINDERS: 'fajr_reminders',
  GENERAL: 'general',
  MEMBERS: 'members', // Topic pour les membres uniquement
} as const;

export type FCMTopic = (typeof FCM_TOPICS)[keyof typeof FCM_TOPICS];

// Créer les channels Android pour les différents types de notifications
export const createNotificationChannels = async () => {
  // Channel général
  await notifee.createChannel({
    id: 'general',
    name: 'Notifications générales',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
  });

  // Channel annonces
  await notifee.createChannel({
    id: 'announcements',
    name: 'Annonces',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });

  // Channel événements
  await notifee.createChannel({
    id: 'events',
    name: 'Événements',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
  });

  // Channel Janaza (urgent)
  await notifee.createChannel({
    id: 'janaza_channel',
    name: 'Salat Janaza',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });

  // Channel Jumu'a
  await notifee.createChannel({
    id: 'jumua',
    name: "Rappel Jumu'a",
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });

  // Channel Fajr
  await notifee.createChannel({
    id: 'fajr',
    name: 'Rappel Fajr',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });

  logger.log('Notification channels created');
};

// S'abonner à tous les topics par défaut
export const subscribeToAllTopics = async () => {
  const topics = [
    'general',
    'announcements',
    'events',
    'janaza',
    'jumua',
    'fajr_reminders',
  ];
  let successCount = 0;

  for (const topic of topics) {
    try {
      await messaging().subscribeToTopic(topic);
      successCount++;
    } catch (error) {
      const err = error as Error;
      logger.error(`Erreur souscription topic ${topic}:`, err?.message);
    }
  }

  if (successCount === topics.length) {
    await AsyncStorage.setItem('fcm_topics_subscribed', 'true');
    return true;
  }
  return false;
};

// S'abonner à un topic spécifique
export const subscribeToTopic = async (topic: FCMTopic) => {
  try {
    await messaging().subscribeToTopic(topic);
    await AsyncStorage.setItem(`fcm_topic_${topic}`, 'true');
    logger.log(`Subscribed to topic: ${topic}`);
    return true;
  } catch (error) {
    logger.error(`Error subscribing to topic ${topic}:`, error);
    return false;
  }
};

// Se désabonner d'un topic spécifique
export const unsubscribeFromTopic = async (topic: FCMTopic) => {
  try {
    await messaging().unsubscribeFromTopic(topic);
    await AsyncStorage.setItem(`fcm_topic_${topic}`, 'false');
    logger.log(`Unsubscribed from topic: ${topic}`);
    return true;
  } catch (error) {
    logger.error(`Error unsubscribing from topic ${topic}:`, error);
    return false;
  }
};

// Vérifier si abonné à un topic
export const isSubscribedToTopic = async (
  topic: FCMTopic,
): Promise<boolean> => {
  const value = await AsyncStorage.getItem(`fcm_topic_${topic}`);
  return value !== 'false'; // Par défaut, on est abonné
};

// Récupérer le token FCM
export const getFCMToken = async (): Promise<string | null> => {
  try {
    const token = await messaging().getToken();
    logger.log('FCM Token:', token);
    return token;
  } catch (error) {
    logger.error('Error getting FCM token:', error);
    return null;
  }
};

// Sauvegarder le token FCM dans Firestore pour notifications personnelles
export const saveFCMTokenToFirestore = async (
  userId: string,
): Promise<boolean> => {
  try {
    const token = await messaging().getToken();
    if (!token || !userId) {
      logger.log('[FCM] Pas de token ou userId pour sauvegarde');
      return false;
    }

    // Mettre à jour le document membre avec le token FCM (multi-device: arrayUnion)
    await firestore().collection('members').doc(userId).set(
      {
        fcmTokens: firestore.FieldValue.arrayUnion(token),
        fcmTokenUpdatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    logger.log('[FCM] Token sauvegardé pour userId:', userId);
    return true;
  } catch (error) {
    logger.error('[FCM] Erreur sauvegarde token:', error);
    return false;
  }
};

// Supprimer le token FCM de Firestore lors de la déconnexion
export const removeFCMTokenFromFirestore = async (
  userId: string,
): Promise<boolean> => {
  try {
    if (!userId) return false;
    // Multi-device: retirer uniquement le token actuel de l'array
    const currentToken = await messaging().getToken();
    if (currentToken) {
      await firestore().collection('members').doc(userId).set(
        {
          fcmTokens: firestore.FieldValue.arrayRemove(currentToken),
          fcmTokenUpdatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
    logger.log('[FCM] Token supprimé pour userId:', userId);
    return true;
  } catch (error) {
    logger.error('[FCM] Erreur suppression token:', error);
    return false;
  }
};

// Callback pour afficher les notifications en modal dans l'app
let inAppNotificationCallback:
  | ((notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    }) => void)
  | null = null;

export const setInAppNotificationCallback = (
  callback:
    | ((notification: {
        title: string;
        body: string;
        data?: Record<string, string>;
      }) => void)
    | null,
) => {
  inAppNotificationCallback = callback;
};

// Gérer les messages FCM en foreground
export const setupForegroundHandler = () => {
  return messaging().onMessage(async remoteMessage => {
    logger.log('FCM Message received in foreground:', remoteMessage);

    const { notification, data } = remoteMessage;

    if (notification) {
      const title = notification.title || 'El Mohsinine';
      const body = notification.body || '';

      // Sur iOS, FCM affiche déjà la notification système en foreground.
      // Ne PAS créer une 2e notification via notifee (cause doublon).
      // Sur Android, FCM n'affiche pas en foreground → notifee nécessaire.
      if (Platform.OS === 'android') {
        let channelId = 'general';
        if (data?.type === 'announcement') channelId = 'announcements';
        else if (data?.type === 'event') channelId = 'events';
        else if (data?.type === 'janaza') channelId = 'janaza_channel';
        else if (data?.type === 'jumua_reminder') channelId = 'jumua';
        else if (data?.type === 'fajr_reminder') channelId = 'fajr';

        const fullBody = (data?.fullBody as string) || body;
        await notifee.displayNotification({
          title,
          body: fullBody,
          android: {
            channelId,
            importance:
              data?.type === 'janaza'
                ? AndroidImportance.HIGH
                : AndroidImportance.DEFAULT,
            pressAction: { id: 'default' },
            style: { type: AndroidStyle.BIGTEXT, text: fullBody },
          },
          data: data as Record<string, string>,
        });
      }

      // Stocker dans l'historique (notifications push du backoffice)
      const notifType = detectNotificationType(title, body);
      await addNotificationToHistory(title, body, notifType);
      logger.log("[Notifications] Push notification ajoutée à l'historique");

      // Appeler le callback pour afficher en modal dans l'app
      if (inAppNotificationCallback) {
        inAppNotificationCallback({
          title,
          body,
          data: data as Record<string, string>,
        });
      }
    }
  });
};

// Gérer l'ouverture de l'app depuis une notification
export const setupNotificationOpenedHandler = (
  onNotificationOpened: (data: Record<string, string>) => void,
) => {
  // Notification ouverte quand l'app était en background
  messaging().onNotificationOpenedApp(remoteMessage => {
    logger.log('Notification opened app from background:', remoteMessage);
    if (remoteMessage.data) {
      onNotificationOpened(remoteMessage.data as Record<string, string>);
    }
  });

  // Vérifier si l'app a été ouverte depuis une notification (quit state)
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        logger.log(
          'App opened from quit state by notification:',
          remoteMessage,
        );
        if (remoteMessage.data) {
          onNotificationOpened(remoteMessage.data as Record<string, string>);
        }
      }
    });

  // Gérer le clic sur les notifications créées par notifee (Android foreground)
  // et aussi les notifications iOS quand l'app est en foreground
  notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS) {
      logger.log('[Notifee] Notification pressed:', detail.notification?.data);
      const data = detail.notification?.data as
        | Record<string, string>
        | undefined;
      if (data) {
        onNotificationOpened(data);
      } else {
        // Pas de data spécifique → ouvrir l'historique notifications par défaut
        onNotificationOpened({});
      }
    }
  });
};

// Type pour le résultat d'initialisation FCM
export interface FCMInitResult {
  success: boolean;
  token?: string;
  permissionStatus?: number;
  error?: string;
  errorCode?: string;
}

// Initialiser les notifications FCM
export const initializeFCM = async (): Promise<FCMInitResult> => {
  try {
    // Créer les channels (Android)
    await createNotificationChannels();

    // Demander la permission
    const authStatus = await messaging().requestPermission();

    if (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    ) {
      // Obtenir le token FCM
      const token = await messaging().getToken();

      if (!token) {
        return {
          success: false,
          permissionStatus: authStatus,
          error: 'Pas de token FCM obtenu',
        };
      }

      // S'abonner aux topics
      await subscribeToAllTopics();

      return {
        success: true,
        token: token,
        permissionStatus: authStatus,
      };
    } else {
      return {
        success: false,
        permissionStatus: authStatus,
        error: 'Permission notifications refusée',
      };
    }
  } catch (error) {
    const err = error as Error & { code?: string };
    logger.error('FCM initialization error:', err?.message);
    return {
      success: false,
      error: err?.message || 'Erreur inconnue',
      errorCode: err?.code,
    };
  }
};

// Demander la permission
export const requestNotificationPermission = async () => {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= 1;
};

// Programmer la notification Jumu'a (chaque vendredi à 12h30)
// NOTE: Désactivé — prayerNotifications.ts gère déjà la notification Jumu'a
// pour éviter la triple notification (local + prayerNotifications + Cloud Function)
export const scheduleJumuaReminder = async (language: 'fr' | 'ar' = 'fr') => {
  // Annuler l'ancienne notification standalone pour éviter doublon avec prayerNotifications
  await notifee.cancelNotification('jumua-reminder');
  logger.log(
    "[Jumu'a] scheduleJumuaReminder désactivé — géré par prayerNotifications",
  );
  return;

  // Créer le channel Android
  await notifee.createChannel({
    id: 'jumua',
    name: "Rappel Jumu'a",
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });

  // Trouver le prochain vendredi à 12h30 (timezone Europe/Paris)
  const now = new Date();
  const parisNow = getParisDate();
  const daysUntilFriday = (5 - parisNow.getDay() + 7) % 7 || 7; // 5 = vendredi
  const fridayParis = new Date(parisNow);
  fridayParis.setDate(parisNow.getDate() + daysUntilFriday);
  fridayParis.setHours(12, 30, 0, 0);

  // Si on est vendredi et qu'il est avant 12h30 à Paris, c'est aujourd'hui
  if (parisNow.getDay() === 5 && parisNow.getHours() < 12) {
    fridayParis.setDate(parisNow.getDate());
    fridayParis.setHours(12, 30, 0, 0);
  }

  // Convertir l'heure Paris en vrai timestamp UTC
  // fridayParis représente (année, mois, jour, 12, 30) en heure Paris
  const y = fridayParis.getFullYear();
  const mo = fridayParis.getMonth();
  const d = fridayParis.getDate();
  const utcTimestamp = Date.UTC(y, mo, d, 12, 30, 0, 0);
  // Vérifier quel offset Paris a à ce moment
  const testParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcTimestamp));
  const testH = parseInt(
    testParts.find(p => p.type === 'hour')?.value || '0',
    10,
  );
  const testM = parseInt(
    testParts.find(p => p.type === 'minute')?.value || '0',
    10,
  );
  const diffMin = testH * 60 + testM - (12 * 60 + 30);
  const nextFriday = new Date(utcTimestamp - diffMin * 60000);

  // Si c'est passé, prendre le vendredi suivant
  if (nextFriday <= now) {
    nextFriday.setTime(nextFriday.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  const messages = {
    fr: {
      title: "🕌 Jumu'a aujourd'hui à 13h30",
      body: "Pensez à arriver en avance, évitez les stationnements gênants et gardons un bon comportement. Qu'Allah accepte notre prière.",
    },
    ar: {
      title: '🕌 صلاة الجمعة اليوم الساعة 13:30',
      body: 'تذكروا الحضور مبكراً، تجنبوا الوقوف المزعج، وحافظوا على السلوك الحسن. تقبل الله صلاتنا.',
    },
  };

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: nextFriday.getTime(),
    repeatFrequency: RepeatFrequency.WEEKLY,
  };

  await notifee.createTriggerNotification(
    {
      id: 'jumua-reminder',
      title: messages[language].title,
      body: messages[language].body,
      android: {
        channelId: 'jumua',
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
      },
      ios: {
        sound: 'default',
      },
    },
    trigger,
  );

  await AsyncStorage.setItem('jumua_reminder_enabled', 'true');
  logger.log("Jumu'a reminder scheduled for:", nextFriday);
};

// Annuler la notification Jumu'a
export const cancelJumuaReminder = async () => {
  await notifee.cancelNotification('jumua-reminder');
  await AsyncStorage.setItem('jumua_reminder_enabled', 'false');
};

// Vérifier si le rappel est activé
export const isJumuaReminderEnabled = async () => {
  const value = await AsyncStorage.getItem('jumua_reminder_enabled');
  return value === 'true';
};

// ==================== MEMBER TOPIC MANAGEMENT ====================

// S'abonner au topic membres (appelé quand l'utilisateur devient membre)
export const subscribeToMembersTopic = async () => {
  try {
    await messaging().subscribeToTopic(FCM_TOPICS.MEMBERS);
    await AsyncStorage.setItem('is_subscribed_members_topic', 'true');
    logger.log('Subscribed to members topic');
    return true;
  } catch (error) {
    logger.error('Error subscribing to members topic:', error);
    return false;
  }
};

// Se désabonner du topic membres
export const unsubscribeFromMembersTopic = async () => {
  try {
    await messaging().unsubscribeFromTopic(FCM_TOPICS.MEMBERS);
    await AsyncStorage.setItem('is_subscribed_members_topic', 'false');
    logger.log('Unsubscribed from members topic');
    return true;
  } catch (error) {
    logger.error('Error unsubscribing from members topic:', error);
    return false;
  }
};

// Vérifier si abonné au topic membres
export const isSubscribedToMembersTopic = async () => {
  const value = await AsyncStorage.getItem('is_subscribed_members_topic');
  return value === 'true';
};

// ==================== BADGE MANAGEMENT ====================

// Effacer le badge de l'icône de l'app
export const clearBadgeCount = async () => {
  try {
    await notifee.setBadgeCount(0);
    logger.log('Badge count cleared');
  } catch (error) {
    logger.error('Error clearing badge count:', error);
  }
};
