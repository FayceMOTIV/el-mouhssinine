/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Ignore specific warnings
LogBox.ignoreLogs([
  'Firebase',
  'AsyncStorage',
  'Require cycle',
]);

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
