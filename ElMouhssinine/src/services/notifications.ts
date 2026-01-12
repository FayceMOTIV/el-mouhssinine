import notifee, {
  TriggerType,
  RepeatFrequency,
  AndroidImportance,
  TimestampTrigger,
} from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==================== FCM TOPICS ====================

// Liste des topics disponibles
export const FCM_TOPICS = {
  ANNOUNCEMENTS: 'announcements',
  EVENTS: 'events',
  JANAZA: 'janaza',
  JUMUA: 'jumua',
  FAJR_REMINDERS: 'fajr_reminders',
  GENERAL: 'general',
} as const;

export type FCMTopic = typeof FCM_TOPICS[keyof typeof FCM_TOPICS];

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

  console.log('Notification channels created');
};

// S'abonner à tous les topics par défaut
export const subscribeToAllTopics = async () => {
  const topics = ['general', 'announcements', 'events', 'janaza', 'jumua', 'fajr_reminders'];
  let successCount = 0;

  for (const topic of topics) {
    try {
      await messaging().subscribeToTopic(topic);
      successCount++;
    } catch (error: any) {
      console.error(`Erreur souscription topic ${topic}:`, error?.message);
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
    console.log(`Subscribed to topic: ${topic}`);
    return true;
  } catch (error) {
    console.error(`Error subscribing to topic ${topic}:`, error);
    return false;
  }
};

// Se désabonner d'un topic spécifique
export const unsubscribeFromTopic = async (topic: FCMTopic) => {
  try {
    await messaging().unsubscribeFromTopic(topic);
    await AsyncStorage.setItem(`fcm_topic_${topic}`, 'false');
    console.log(`Unsubscribed from topic: ${topic}`);
    return true;
  } catch (error) {
    console.error(`Error unsubscribing from topic ${topic}:`, error);
    return false;
  }
};

// Vérifier si abonné à un topic
export const isSubscribedToTopic = async (topic: FCMTopic): Promise<boolean> => {
  const value = await AsyncStorage.getItem(`fcm_topic_${topic}`);
  return value !== 'false'; // Par défaut, on est abonné
};

// Récupérer le token FCM
export const getFCMToken = async (): Promise<string | null> => {
  try {
    const token = await messaging().getToken();
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

// Gérer les messages FCM en foreground
export const setupForegroundHandler = () => {
  return messaging().onMessage(async (remoteMessage) => {
    console.log('FCM Message received in foreground:', remoteMessage);

    // Afficher la notification avec notifee
    const { notification, data } = remoteMessage;

    if (notification) {
      // Déterminer le channel basé sur le type
      let channelId = 'general';
      if (data?.type === 'announcement') channelId = 'announcements';
      else if (data?.type === 'event') channelId = 'events';
      else if (data?.type === 'janaza') channelId = 'janaza_channel';
      else if (data?.type === 'jumua_reminder') channelId = 'jumua';
      else if (data?.type === 'fajr_reminder') channelId = 'fajr';

      await notifee.displayNotification({
        title: notification.title || 'El Mouhssinine',
        body: notification.body || '',
        android: {
          channelId,
          importance: data?.type === 'janaza' ? AndroidImportance.HIGH : AndroidImportance.DEFAULT,
          pressAction: { id: 'default' },
        },
        ios: {
          sound: 'default',
        },
        data: data as Record<string, string>,
      });
    }
  });
};

// Gérer l'ouverture de l'app depuis une notification
export const setupNotificationOpenedHandler = (
  onNotificationOpened: (data: Record<string, string>) => void
) => {
  // Notification ouverte quand l'app était en background
  messaging().onNotificationOpenedApp((remoteMessage) => {
    console.log('Notification opened app from background:', remoteMessage);
    if (remoteMessage.data) {
      onNotificationOpened(remoteMessage.data as Record<string, string>);
    }
  });

  // Vérifier si l'app a été ouverte depuis une notification (quit state)
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        console.log('App opened from quit state by notification:', remoteMessage);
        if (remoteMessage.data) {
          onNotificationOpened(remoteMessage.data as Record<string, string>);
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

    if (authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL) {

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
  } catch (error: any) {
    console.error('FCM initialization error:', error?.message);
    return {
      success: false,
      error: error?.message || 'Erreur inconnue',
      errorCode: error?.code,
    };
  }
};

// Demander la permission
export const requestNotificationPermission = async () => {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= 1;
};

// Programmer la notification Jumu'a (chaque vendredi à 12h30)
export const scheduleJumuaReminder = async (language: 'fr' | 'ar' = 'fr') => {
  // Annuler l'ancienne si existe
  await notifee.cancelNotification('jumua-reminder');

  // Créer le channel Android
  await notifee.createChannel({
    id: 'jumua',
    name: "Rappel Jumu'a",
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });

  // Trouver le prochain vendredi à 12h30
  const now = new Date();
  const nextFriday = new Date();
  const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7; // 5 = vendredi
  nextFriday.setDate(now.getDate() + daysUntilFriday);
  nextFriday.setHours(12, 30, 0, 0);

  // Si on est vendredi et qu'il est avant 12h30, c'est aujourd'hui
  if (now.getDay() === 5 && now.getHours() < 12) {
    nextFriday.setDate(now.getDate());
  }

  // Si c'est passé, prendre le vendredi suivant
  if (nextFriday <= now) {
    nextFriday.setDate(nextFriday.getDate() + 7);
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
    trigger
  );

  await AsyncStorage.setItem('jumua_reminder_enabled', 'true');
  console.log("Jumu'a reminder scheduled for:", nextFriday);
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
