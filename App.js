import React, { useContext } from 'react';

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
  AuthProvider,
  AuthContext,
} from './context/AuthContext';

// Pantallas de autenticación
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';

// Pantallas principales
import HomeScreen from './screens/HomeScreen';
import ChatScreen from './screens/ChatScreen';
import MonitorScreen from './screens/MonitorScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();


// =====================================================
// TABS PRINCIPALES
// =====================================================

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarStyle: styles.tabBar,

        tabBarActiveTintColor: '#b75cff',

        tabBarInactiveTintColor: '#6f6480',

        tabBarLabelStyle: styles.tabLabel,

        tabBarItemStyle: styles.tabItem,

        tabBarIcon: ({ focused, color }) => {

          let icon = '⌂';

          if (route.name === 'Inicio') {
            icon = '⌂';
          }

          else if (route.name === 'Chat IA') {
            icon = '💬';
          }

          else if (route.name === 'Monitor IA') {
            icon = '⚡';
          }

          return (
            <View
              style={[
                styles.iconWrapper,
                focused && styles.iconWrapperActive,
              ]}
            >
              <Text
                style={[
                  styles.tabIcon,
                  { color },
                ]}
              >
                {icon}
              </Text>
            </View>
          );
        },
      })}
    >

      <Tab.Screen
        name="Inicio"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Inicio',
        }}
      />

      <Tab.Screen
        name="Chat IA"
        component={ChatScreen}
        options={{
          tabBarLabel: 'Chat IA',
        }}
      />

      <Tab.Screen
        name="Monitor IA"
        component={MonitorScreen}
        options={{
          tabBarLabel: 'Monitor IA',
        }}
      />

    </Tab.Navigator>
  );
}


// =====================================================
// NAVEGADOR PRINCIPAL
// =====================================================

function AppNavigator() {

  const {
    loading,
  } = useContext(AuthContext);


  // Mientras Firebase comprueba si existe
  // una sesión activa
  if (loading) {

    return (
      <View style={styles.loadingContainer}>

        <ActivityIndicator
          size="large"
          color="#b75cff"
        />

        <Text style={styles.loadingText}>
          Iniciando NEXUS...
        </Text>

      </View>
    );
  }


  return (

    <NavigationContainer>

      <Stack.Navigator
        initialRouteName="Main"
        screenOptions={{
          headerShown: false,
        }}
      >

        {/* HOME - SIEMPRE DISPONIBLE */}
        <Stack.Screen
          name="Main"
          component={MainTabs}
        />

        {/* LOGIN */}
        <Stack.Screen
          name="Login"
          component={LoginScreen}
        />

        {/* REGISTRO */}
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
        />

      </Stack.Navigator>

    </NavigationContainer>
  );
}


// =====================================================
// APP
// =====================================================

export default function App() {

  return (

    <AuthProvider>

      <StatusBar style="light" />

      <AppNavigator />

    </AuthProvider>

  );
}


// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({

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

    height:
      Platform.OS === 'ios'
        ? 88
        : 65,

    paddingBottom:
      Platform.OS === 'ios'
        ? 24
        : 8,

    paddingTop: 8,

    elevation: 10,

    shadowColor: '#b75cff',

    shadowOffset: {
      width: 0,
      height: -2,
    },

    shadowOpacity: 0.15,

    shadowRadius: 8,
  },

  tabItem: {
    paddingVertical: 2,
  },

  tabLabel: {
    fontSize: 11,

    fontWeight: '600',

    letterSpacing: 0.5,

    marginTop: 2,
  },

  iconWrapper: {
    alignItems: 'center',

    justifyContent: 'center',

    width: 32,

    height: 32,

    borderRadius: 16,
  },

  iconWrapperActive: {
    backgroundColor:
      'rgba(183, 92, 255, 0.15)',
  },

  tabIcon: {
    fontSize: 18,
  },

});