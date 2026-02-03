/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import TrackPlayer from 'react-native-track-player';
import BackgroundFetch from 'react-native-background-fetch';
import App from './App';
import { name as appName } from './app.json';
import { addNotificationToHistory, detectNotificationType } from './src/services/notificationHistory';

// IMPORTANT: Enregistrer le service de lecture audio (Coran)
TrackPlayer.registerPlaybackService(() => require('./service'));

// IMPORTANT: Enregistrer le headless task pour le background fetch (Android)
// Permet de vérifier la proximité de la mosquée même si l'app est fermée
BackgroundFetch.registerHeadlessTask(async ({ taskId }) => {
  console.log(`[BackgroundFetch] Headless task ${taskId}`);
  // La logique de proximité est gérée dans backgroundLocation.ts
  // Ce handler est appelé automatiquement par le système
  BackgroundFetch.finish(taskId);
});

// Ignore specific warnings
LogBox.ignoreLogs([
  'Firebase',
  'AsyncStorage',
  'Require cycle',
]);

// IMPORTANT: Gestionnaire de notifications LOCALES en arrière-plan (notifee)
// Capture les notifications de prière, boost, coran, ramadan quand l'app est en background/killed
notifee.onBackgroundEvent(async ({ type, detail }) => {
  // Quand une notification locale est délivrée en background
  if (type === EventType.DELIVERED && detail.notification) {
    const { title, body } = detail.notification;
    if (title && body) {
      const notifType = detectNotificationType(title, body);
      await addNotificationToHistory(title, body, notifType);
      console.log('[Background] Notification locale ajoutée à l\'historique:', title);
    }
  }
});

// IMPORTANT: Gestionnaire de notifications FCM en arrière-plan
// Doit être enregistré AVANT AppRegistry.registerComponent
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('🔔 [FCM] Background message received:', remoteMessage);

  // Afficher la notification avec notifee
  const { notification, data } = remoteMessage;

  if (notification) {
    // Déterminer le channel basé sur le type
    let channelId = 'general';
    if (data?.type === 'announcement') channelId = 'announcements';
    else if (data?.type === 'event') channelId = 'events';
    else if (data?.type === 'janaza') channelId = 'janaza_channel';
    else if (data?.type === 'backoffice_notification') channelId = 'general';

    await notifee.displayNotification({
      title: notification.title || 'Notification',
      body: notification.body || '',
      android: {
        channelId,
        smallIcon: 'ic_notification',
        pressAction: {
          id: 'default',
        },
      },
      ios: {
        sound: 'default',
      },
    });

    // Ajouter à l'historique des notifications
    const notifType = detectNotificationType(notification.title || '', notification.body || '');
    await addNotificationToHistory(notification.title || 'Notification', notification.body || '', notifType);
  }
});

// Global error handler
if (!__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    originalConsoleError(...args);
  };

  // Handle unhandled promise rejections
  const originalHandler = global.ErrorUtils?.getGlobalHandler();
  global.ErrorUtils?.setGlobalHandler((error, isFatal) => {
    console.log('Global error:', error, isFatal);
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

AppRegistry.registerComponent(appName, () => App);
