import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
