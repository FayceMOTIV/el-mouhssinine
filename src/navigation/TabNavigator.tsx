import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  HomeScreen,
  DonationsScreen,
  MemberScreen,
  EventsScreen,
  MoreScreen,
} from '../screens';
import { colors } from '../theme';
import { useLanguage } from '../context/LanguageContext';
import { TranslationKey } from '../i18n';

const Tab = createBottomTabNavigator();

interface TabIconProps {
  icon: string;
  label: string;
  focused: boolean;
}

const TabIcon: React.FC<TabIconProps> = ({ icon, label, focused }) => (
  <View style={styles.tabIconContainer}>
    <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      {icon}
    </Text>
    <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>
      {label}
    </Text>
  </View>
);

interface TabScreenConfig {
  name: string;
  component: React.ComponentType<any>;
  icon: string;
  labelKey: TranslationKey;
}

const TabNavigator: React.FC = () => {
  const { t } = useLanguage();

  const tabs: TabScreenConfig[] = [
    { name: 'Home', component: HomeScreen, icon: '🕌', labelKey: 'home' },
    { name: 'Donations', component: DonationsScreen, icon: '💝', labelKey: 'donations' },
    { name: 'Member', component: MemberScreen, icon: '👤', labelKey: 'member' },
    { name: 'Events', component: EventsScreen, icon: '📅', labelKey: 'events' },
    { name: 'More', component: MoreScreen, icon: '☰', labelKey: 'more' },
  ];

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}>
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={tab.icon} label={t(tab.labelKey)} focused={focused} />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 20,
    paddingTop: 10,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  tabIconFocused: {
    fontSize: 24,
  },
  tabLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '500',
  },
  tabLabelFocused: {
    color: colors.accent,
    fontWeight: '600',
  },
});

export default TabNavigator;
