/**
 * @format
 */

import { LogBox, Platform } from 'react-native';
import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';

import {
  addNotificationToHistory,
  detectNotificationType,
} from './src/services/notificationHistory';

try {
  const TrackPlayer = require('react-native-track-player').default;
  TrackPlayer.registerPlaybackService(() => require('./service'));
} catch (e) {
  console.warn('[TrackPlayer] init failed (non-fatal):', e);
}

// Ignore specific warnings
LogBox.ignoreLogs(['Firebase', 'AsyncStorage', 'Require cycle']);

// IMPORTANT: Gestionnaire de notifications LOCALES en arrière-plan (notifee)
// Capture les notifications de prière, boost, coran, ramadan quand l'app est en background/killed
notifee.onBackgroundEvent(async ({ type, detail }) => {
  // Quand une notification locale est délivrée en background
  if (type === EventType.DELIVERED && detail.notification) {
    const { title, body } = detail.notification;
    if (title && body) {
      const notifType = detectNotificationType(title, body);
      await addNotificationToHistory(title, body, notifType);
      console.log(
        "[Background] Notification locale ajoutée à l'historique:",
        title,
      );
    }
  }
});

// IMPORTANT: Gestionnaire de notifications FCM en arrière-plan
// Doit être enregistré AVANT AppRegistry.registerComponent
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('🔔 [FCM] Background message received:', remoteMessage);

  const { notification, data } = remoteMessage;

  if (notification) {
    // Sur iOS, APNs affiche DEJA la notification système en background.
    // Ne PAS créer une 2e notification via notifee (cause doublon).
    // Sur Android, il faut afficher via notifee.
    if (Platform.OS === 'android') {
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
      });
    }

    // Ajouter à l'historique des notifications (toutes plateformes)
    const notifType = detectNotificationType(
      notification.title || '',
      notification.body || '',
    );
    await addNotificationToHistory(
      notification.title || 'Notification',
      notification.body || '',
      notifType,
    );
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

registerRootComponent(App);
