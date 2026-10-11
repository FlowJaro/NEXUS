import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAa1r175TUVnOplShRDLlF4i8rr_weEm0U',
  authDomain: 'nexus-14d96.firebaseapp.com',
  projectId: 'nexus-14d96',
  storageBucket: 'nexus-14d96.firebasestorage.app',
  messagingSenderId: '83612255715',
  appId: '1:83612255715:web:2f6c7e48440133fb224cd6',
  measurementId: 'G-BG4M9ENR76',
};

const app = initializeApp(firebaseConfig);

function crearAuth() {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }

  try {
    // eslint-disable-next-line global-require
    const { initializeAuth, getReactNativePersistence } = require('firebase/auth');
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    return getAuth(app);
  }
}

export const auth = crearAuth();
export const db = getFirestore(app);

export default app;
