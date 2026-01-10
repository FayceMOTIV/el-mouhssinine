import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors, fontSize, spacing } from '../theme/colors';

// Screens
import HomeScreen from '../screens/HomeScreen';
import DonationsScreen from '../screens/DonationsScreen';
import MemberScreen from '../screens/MemberScreen';
import SpiritualScreen from '../screens/SpiritualScreen';
import MoreScreen from '../screens/MoreScreen';

const Tab = createBottomTabNavigator();

type TabBarIconProps = {
  focused: boolean;
  icon: string;
  label: string;
};

const TabBarIcon = ({ focused, icon, label }: TabBarIconProps) => (
  <View style={styles.tabItem}>
    <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{icon}</Text>
    <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
  </View>
);

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarShowLabel: false,
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabBarIcon focused={focused} icon="🕌" label="Accueil" />
            ),
          }}
        />
        <Tab.Screen
          name="Donations"
          component={DonationsScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabBarIcon focused={focused} icon="💝" label="Dons" />
            ),
          }}
        />
        <Tab.Screen
          name="Member"
          component={MemberScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabBarIcon focused={focused} icon="👤" label="Adhérent" />
            ),
          }}
        />
        <Tab.Screen
          name="Spiritual"
          component={SpiritualScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabBarIcon focused={focused} icon="📖" label="Spirituel" />
            ),
          }}
        />
        <Tab.Screen
          name="More"
          component={MoreScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabBarIcon focused={focused} icon="☰" label="Plus" />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(92,58,26,0.98)',
    borderTopWidth: 0,
    height: 85,
    paddingBottom: 25,
    paddingTop: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  tabIconActive: {},
  tabLabel: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.5)',
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: '600',
  },
});

export default AppNavigator;
