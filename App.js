import React, { useContext, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  Platform,
  ActivityIndicator,
} from 'react-native';

import { StatusBar } from 'expo-status-bar';

import {
  NavigationContainer,
} from '@react-navigation/native';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import {
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

import {
  AuthProvider,
  AuthContext,
} from './context/AuthContext';

import { RemindersProvider } from './context/RemindersContext';

import {
  configureNotifications,
  setupNotificationChannels,
} from './services/notifications';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';

import HomeScreen from './screens/HomeScreen';
import ChatScreen from './screens/ChatScreen';
import MonitorScreen from './screens/MonitorScreen';
import RemindersScreen from './screens/RemindersScreen';

import InAppNotifications from './components/InAppNotifications';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Inicio: { focused: 'home', unfocused: 'home-outline' },
  'Chat IA': { focused: 'chatbubble-ellipses', unfocused: 'chatbubble-ellipses-outline' },
  Recordatorios: { focused: 'notifications', unfocused: 'notifications-outline' },
  'Monitor IA': { focused: 'hardware-chip', unfocused: 'hardware-chip-outline' },
};

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 12);
  const tabHeight = 58 + bottomPadding;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: tabHeight,
            paddingBottom: bottomPadding,
          },
        ],
        tabBarActiveTintColor: '#b75cff',
        tabBarInactiveTintColor: '#6f6480',
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarIcon: ({ focused, color }) => {
          const config = TAB_ICONS[route.name] || {
            focused: 'ellipse',
            unfocused: 'ellipse-outline',
          };
          const iconName = focused ? config.focused : config.unfocused;

          return (
            <View
              style={[
                styles.iconWrapper,
                focused && styles.iconWrapperActive,
              ]}
            >
              <Ionicons name={iconName} size={20} color={color} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Inicio" component={HomeScreen} options={{ tabBarLabel: 'Inicio' }} />

      <Tab.Screen name="Chat IA" component={ChatScreen} options={{ tabBarLabel: 'Chat IA' }} />

      <Tab.Screen
        name="Recordatorios"
        component={RemindersScreen}
        options={{ tabBarLabel: 'Recordatorios' }}
      />

      <Tab.Screen
        name="Monitor IA"
        component={MonitorScreen}
        options={{ tabBarLabel: 'Monitor IA' }}
      />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#b75cff" />
        <Text style={styles.loadingText}>Iniciando NEXUS...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

function NotificationSetup() {
  useEffect(() => {
    configureNotifications();
    setupNotificationChannels();
  }, []);

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RemindersProvider>
          <View style={styles.root}>
            <StatusBar style="light" />
            <NotificationSetup />
            <AppNavigator />
            <InAppNotifications />
          </View>
        </RemindersProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#05030b',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#05030b',
  },

  loadingText: {
    color: '#d8cce0',
    marginTop: 15,
    fontSize: 15,
  },

  tabBar: {
    backgroundColor: '#0b0715',
    borderTopColor: '#3c1854',
    borderTopWidth: 1,
    paddingTop: 8,
    elevation: 10,
    shadowColor: '#b75cff',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },

  tabItem: {
    paddingVertical: 2,
  },

  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 2,
  },

  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  iconWrapperActive: {
    backgroundColor: 'rgba(183, 92, 255, 0.18)',
  },
});
