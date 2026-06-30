/**
 * Jest Setup - Mocks pour El Mouhssinine
 */

// Mock __DEV__ global
global.__DEV__ = true;

// Mock Firebase App
jest.mock('@react-native-firebase/app', () => ({
  firebase: {
    app: jest.fn(),
  },
}));

// Mock Firebase Auth
jest.mock('@react-native-firebase/auth', () => {
  const mockUser = {
    uid: 'test-uid-12345',
    email: 'test@example.com',
    displayName: 'Test User',
  };

  return () => ({
    signInWithEmailAndPassword: jest.fn().mockResolvedValue({ user: mockUser }),
    createUserWithEmailAndPassword: jest
      .fn()
      .mockResolvedValue({ user: mockUser }),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    signOut: jest.fn().mockResolvedValue(undefined),
    onAuthStateChanged: jest.fn(callback => {
      callback(null);
      return jest.fn(); // unsubscribe
    }),
    currentUser: null,
  });
});

// Mock Firebase Firestore
jest.mock('@react-native-firebase/firestore', () => {
  const mockCollection = {
    doc: jest.fn(() => mockDoc),
    get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
    where: jest.fn(() => mockCollection),
    orderBy: jest.fn(() => mockCollection),
    limit: jest.fn(() => mockCollection),
    onSnapshot: jest.fn(callback => {
      callback({ docs: [], empty: true });
      return jest.fn(); // unsubscribe
    }),
  };

  const mockDoc = {
    get: jest.fn().mockResolvedValue({ exists: () => false, data: () => null }),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  return () => ({
    collection: jest.fn(() => mockCollection),
    doc: jest.fn(() => mockDoc),
    FieldValue: {
      serverTimestamp: jest.fn(() => new Date()),
      increment: jest.fn(n => n),
    },
  });
});

// Mock Firebase Functions
jest.mock('@react-native-firebase/functions', () => () => ({
  httpsCallable: jest.fn(() => jest.fn().mockResolvedValue({ data: {} })),
}));

// Mock Firebase Messaging
jest.mock('@react-native-firebase/messaging', () => () => ({
  requestPermission: jest.fn().mockResolvedValue(1),
  getToken: jest.fn().mockResolvedValue('mock-fcm-token'),
  subscribeToTopic: jest.fn().mockResolvedValue(undefined),
  unsubscribeFromTopic: jest.fn().mockResolvedValue(undefined),
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  setBackgroundMessageHandler: jest.fn(),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  multiSet: jest.fn().mockResolvedValue(undefined),
}));

// Mock Stripe
jest.mock('@stripe/stripe-react-native', () => ({
  useStripe: () => ({
    initPaymentSheet: jest.fn().mockResolvedValue({ error: null }),
    presentPaymentSheet: jest.fn().mockResolvedValue({ error: null }),
  }),
  StripeProvider: ({ children }) => children,
  initPaymentSheet: jest.fn().mockResolvedValue({ error: null }),
  presentPaymentSheet: jest.fn().mockResolvedValue({ error: null }),
}));

// Mock Notifee
jest.mock('@notifee/react-native', () => ({
  createChannel: jest.fn().mockResolvedValue('channel-id'),
  displayNotification: jest.fn().mockResolvedValue(undefined),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
  cancelAllNotifications: jest.fn().mockResolvedValue(undefined),
  createTriggerNotification: jest.fn().mockResolvedValue('notif-id'),
  getTriggerNotificationIds: jest.fn().mockResolvedValue([]),
  requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
  onForegroundEvent: jest.fn(() => jest.fn()),
  TriggerType: { TIMESTAMP: 0 },
  RepeatFrequency: { NONE: -1, HOURLY: 0, DAILY: 1, WEEKLY: 2 },
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  AuthorizationStatus: { AUTHORIZED: 1, DENIED: 0 },
  EventType: { DELIVERED: 0, PRESS: 1, DISMISSED: 2 },
}));

// Mock Geolocation
jest.mock('@react-native-community/geolocation', () => ({
  default: {
    setRNConfiguration: jest.fn(),
    getCurrentPosition: jest.fn(success =>
      success({
        coords: { latitude: 48.8566, longitude: 2.3522, accuracy: 10 },
      }),
    ),
    watchPosition: jest.fn(() => 1),
    clearWatch: jest.fn(),
    requestAuthorization: jest.fn(),
    stopObserving: jest.fn(),
  },
  setRNConfiguration: jest.fn(),
  getCurrentPosition: jest.fn(success =>
    success({
      coords: { latitude: 48.8566, longitude: 2.3522, accuracy: 10 },
    }),
  ),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
  requestAuthorization: jest.fn(),
  stopObserving: jest.fn(),
}));

// Mock NetInfo - via moduleNameMapper dans jest.config.js

// Mock react-native-track-player
jest.mock('react-native-track-player', () => {
  const mock = {
    setupPlayer: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(undefined),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
    getActiveTrackIndex: jest.fn().mockResolvedValue(null),
    getPlaybackState: jest.fn().mockResolvedValue({ state: 'none' }),
    getPosition: jest.fn().mockResolvedValue(0),
    getDuration: jest.fn().mockResolvedValue(0),
    setRate: jest.fn().mockResolvedValue(undefined),
    seekTo: jest.fn().mockResolvedValue(undefined),
    skipToNext: jest.fn().mockResolvedValue(undefined),
    skipToPrevious: jest.fn().mockResolvedValue(undefined),
    updateOptions: jest.fn().mockResolvedValue(undefined),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    registerPlaybackService: jest.fn(),
    Capability: {
      Play: 'play',
      Pause: 'pause',
      Stop: 'stop',
      SeekTo: 'seekTo',
      SkipToNext: 'skipToNext',
      SkipToPrevious: 'skipToPrevious',
    },
    State: {
      Playing: 'playing',
      Paused: 'paused',
      Stopped: 'stopped',
      None: 'none',
      Ended: 'ended',
      Buffering: 'buffering',
      Loading: 'loading',
      Ready: 'ready',
      Error: 'error',
    },
    Event: {
      PlaybackQueueEnded: 'playback-queue-ended',
      PlaybackState: 'playback-state',
      PlaybackError: 'playback-error',
    },
    AppKilledPlaybackBehavior: {
      ContinuePlayback: 'continue',
      StopPlaybackAndRemoveNotification: 'stop',
    },
    IOSCategory: { Playback: 'playback' },
    IOSCategoryMode: { SpokenAudio: 'spokenAudio' },
    IOSCategoryOptions: { AllowAirPlay: 'allowAirPlay', AllowBluetooth: 'allowBluetooth' },
  };
  mock.default = mock;
  return mock;
});

// Mock react-native-tts
jest.mock('react-native-tts', () => {
  const mock = {
    setDefaultLanguage: jest.fn().mockResolvedValue(undefined),
    setDefaultRate: jest.fn().mockResolvedValue(undefined),
    setDefaultPitch: jest.fn().mockResolvedValue(undefined),
    speak: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  mock.default = mock;
  return mock;
});

// Mock react-native-linear-gradient
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

// Mock @react-native-clipboard/clipboard
jest.mock('@react-native-clipboard/clipboard', () => ({
  getString: jest.fn().mockResolvedValue(''),
  setString: jest.fn(),
}));

// Mock react-native-compass-heading
jest.mock('react-native-compass-heading', () => ({
  start: jest.fn(),
  stop: jest.fn(),
}));

// Mock react-native-background-fetch
jest.mock('react-native-background-fetch', () => ({
  configure: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  finish: jest.fn(),
  status: jest.fn(),
  BackgroundFetchStatus: { AVAILABLE: 0 },
}));

// Note: Ne pas mock react-native entièrement, utiliser jest.spyOn pour les fonctions spécifiques

// Silence console in tests (optionnel)
if (process.env.JEST_SILENT) {
  global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}
