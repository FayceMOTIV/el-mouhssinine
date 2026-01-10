import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';

// Ignore specific warnings if needed
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

const App = () => {
  useEffect(() => {
    // Initialize Firebase, notifications, etc.
    console.log('App initialized');
  }, []);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#7f4f24" />
      <AppNavigator />
    </>
  );
};

export default App;
