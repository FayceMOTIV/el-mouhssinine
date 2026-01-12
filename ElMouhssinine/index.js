/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// Ignore specific warnings
LogBox.ignoreLogs([
  'Firebase',
  'AsyncStorage',
  'Require cycle',
]);

// IMPORTANT: Gestionnaire de notifications en arrière-plan
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
