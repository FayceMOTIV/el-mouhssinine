import notifee, {
  TriggerType,
  RepeatFrequency,
  AndroidImportance,
  TimestampTrigger,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
