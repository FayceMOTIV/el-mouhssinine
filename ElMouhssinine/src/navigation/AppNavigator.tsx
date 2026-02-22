import React, { useRef, useEffect, useState } from 'react';
import { Text, I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingConsentScreen from '../screens/OnboardingConsentScreen';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import { setupNotificationOpenedHandler } from '../services/notifications';

// Forcer LTR pour que les onglets restent dans le même ordre
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

// Main Screens
import HomeScreen from '../screens/HomeScreen';
import DonationsScreen from '../screens/DonationsScreen';
import MemberScreen from '../screens/MemberScreen';
import SpiritualScreen from '../screens/SpiritualScreen';
import MoreScreen from '../screens/MoreScreen';

// Quran Screens
import QuranScreen from '../screens/QuranScreen';
import SurahScreen from '../screens/SurahScreen';
import QuranHomeScreen from '../screens/QuranHomeScreen';
import QuranReadScreen from '../screens/QuranReadScreen';

// Adhkar Screens
import AdhkarScreen from '../screens/AdhkarScreen';
import AdhkarDetailScreen from '../screens/AdhkarDetailScreen';

// Learn Arabic Screens
import LearnArabicScreen from '../screens/LearnArabicScreen';
import AlphabetScreen from '../screens/AlphabetScreen';
import LetterDetailScreen from '../screens/LetterDetailScreen';
import LessonsListScreen from '../screens/LessonsListScreen';
import LessonScreen from '../screens/LessonScreen';

// Quiz Screen
import QuizScreen from '../screens/QuizScreen';

// Messages Screens
import MessagesScreen from '../screens/MessagesScreen';
import ConversationScreen from '../screens/ConversationScreen';

// Membership Screen
import MyMembershipsScreen from '../screens/MyMembershipsScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';

// Privacy Policy Screen
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';

// Prayer Calendar Screen
import PrayerCalendarScreen from '../screens/PrayerCalendarScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

// Spiritual Stack Navigator
const SpiritualStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.accent,
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '600',
        },
        headerBackTitle: '',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="SpiritualHome"
        component={SpiritualScreen}
        options={{ headerShown: false }}
      />
      {/* Quran */}
      <Stack.Screen
        name="QuranHome"
        component={QuranHomeScreen}
        options={{ title: 'Coran' }}
      />
      <Stack.Screen
        name="Quran"
        component={QuranScreen}
        options={{ title: 'Écouter le Coran' }}
      />
      <Stack.Screen
        name="QuranRead"
        component={QuranReadScreen}
        options={{ title: 'Lire le Coran', headerShown: false }}
      />
      <Stack.Screen
        name="Surah"
        component={SurahScreen}
        options={{ title: 'Sourate' }}
      />
      {/* Adhkar */}
      <Stack.Screen
        name="Adhkar"
        component={AdhkarScreen}
        options={{ title: 'Invocations' }}
      />
      <Stack.Screen
        name="AdhkarDetail"
        component={AdhkarDetailScreen}
        options={{ title: 'Détails' }}
      />
      {/* Quiz */}
      <Stack.Screen
        name="Quiz"
        component={QuizScreen}
        options={{ title: 'Quiz Islam' }}
      />
      {/* Learn Arabic */}
      <Stack.Screen
        name="LearnArabic"
        component={LearnArabicScreen}
        options={{ title: 'Apprendre l\'Arabe' }}
      />
      <Stack.Screen
        name="Alphabet"
        component={AlphabetScreen}
        options={{ title: 'Alphabet' }}
      />
      <Stack.Screen
        name="LetterDetail"
        component={LetterDetailScreen}
        options={{ title: 'Lettre' }}
      />
      <Stack.Screen
        name="LessonsList"
        component={LessonsListScreen}
        options={{ title: 'Leçons' }}
      />
      <Stack.Screen
        name="Lesson"
        component={LessonScreen}
        options={{ title: 'Leçon' }}
      />
    </Stack.Navigator>
  );
};

// Tab Navigator Component
const TabNavigatorComponent = () => {
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.accentDark,
          height: 90,
          paddingBottom: 25,
          paddingTop: 10,
          borderTopWidth: 0,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: 'row', // Forcer LTR
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarActiveTintColor: '#c9a227',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.6)',
        tabBarLabelPosition: 'below-icon',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t('home'),
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 24 }}>🕌</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Donations"
        component={DonationsScreen}
        options={{
          tabBarLabel: t('donations'),
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 24 }}>💝</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Member"
        component={MemberScreen}
        options={{
          tabBarLabel: t('member'),
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 24 }}>👤</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Spiritual"
        component={SpiritualStack}
        options={{
          tabBarLabel: t('quran'),
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 24 }}>📖</Text>
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          tabBarLabel: t('more'),
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 24 }}>☰</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Vérifier le consentement RGPD au démarrage
  useEffect(() => {
    AsyncStorage.getItem('rgpd_accepted').then((value) => {
      setConsentAccepted(!!value);
      setConsentChecked(true);
    }).catch(() => {
      setConsentChecked(true);
    });
  }, []);

  // Gérer le clic sur les notifications pour naviguer vers le bon écran
  useEffect(() => {
    setupNotificationOpenedHandler((data) => {
      if (data.type === 'message_reply' && data.messageId) {
        // Naviguer vers la conversation du message
        navigationRef.current?.navigate('Conversation', { messageId: data.messageId });
      }
    });
  }, []);

  if (!consentChecked) return null;

  if (!consentAccepted) {
    return <OnboardingConsentScreen onAccept={() => setConsentAccepted(true)} />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <RootStack.Screen name="MainTabs" component={TabNavigatorComponent} />
        <RootStack.Screen name="Messages" component={MessagesScreen} />
        <RootStack.Screen name="Conversation" component={ConversationScreen} />
        <RootStack.Screen name="MyMemberships" component={MyMembershipsScreen} />
        <RootStack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ title: 'Modifier mon profil' }} />
        <RootStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        <RootStack.Screen name="PrayerCalendar" component={PrayerCalendarScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
