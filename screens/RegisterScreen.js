import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { auth, db } from '../firebaseConfig';

export default function RegisterScreen({ navigation }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombrePreferido, setNombrePreferido] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    // Validar campos
    if (!nombre.trim() || !email.trim() || !password || !nombrePreferido.trim()) {
      setError('Completa todos los campos.');
      return;
    }

    // Validar contraseña
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // 1. Crear usuario en Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const user = userCredential.user;

      // 2. Crear documento del usuario en Firestore
      await setDoc(doc(db, 'usuarios', user.uid), {
        nombre: nombre.trim(),
        email: email.trim(),
        nombrePreferido: nombrePreferido.trim(),
        fechaCreacion: serverTimestamp(),
      });

      console.log('Usuario registrado correctamente:', user.uid);

      // El AuthContext detecta la sesion y App.js cambia solo al area principal.

    } catch (err) {
      console.log('Error al registrar:', err);

      if (err.code === 'auth/email-already-in-use') {
        setError('Ese correo ya tiene una cuenta.');
      } else if (err.code === 'auth/invalid-email') {
        setError('El correo electrónico no es válido.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña es demasiado débil.');
      } else if (err.code === 'permission-denied') {
        setError('No tienes permisos para guardar los datos en Firestore.');
      } else {
        setError('No pudimos crear tu cuenta. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Crear cuenta</Text>

        <Text style={styles.subtitle}>
          Crea tu cuenta para comenzar a utilizar NEXUS
        </Text>

        {/* NOMBRE */}
        <TextInput
          style={styles.input}
          placeholder="Nombre completo"
          placeholderTextColor="#888"
          value={nombre}
          onChangeText={setNombre}
          autoCapitalize="words"
        />

        {/* NOMBRE PREFERIDO */}
        <TextInput
          style={styles.input}
          placeholder="¿Cómo quieres que te llame NEXUS?"
          placeholderTextColor="#888"
          value={nombrePreferido}
          onChangeText={setNombrePreferido}
          autoCapitalize="words"
        />

        {/* CORREO */}
        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* CONTRASEÑA */}
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {/* ERROR */}
        {error ? (
          <Text style={styles.error}>
            {error}
          </Text>
        ) : null}

        {/* BOTÓN */}
        <TouchableOpacity
          style={[
            styles.button,
            loading && styles.buttonDisabled,
          ]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </Text>
        </TouchableOpacity>

        {/* IR A LOGIN */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.link}>
            ¿Ya tienes cuenta? Inicia sesión
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05030b',
  },

  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingVertical: 40,
  },

  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    color: '#aaa0b5',
    textAlign: 'center',
    marginBottom: 30,
  },

  input: {
    backgroundColor: '#0b0715',
    borderWidth: 1,
    borderColor: '#4c216b',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 15,
    marginBottom: 15,
  },

  error: {
    color: '#ff6b81',
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 14,
  },

  button: {
    backgroundColor: '#b75cff',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 20,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  link: {
    color: '#b75cff',
    textAlign: 'center',
    fontSize: 14,
  },
});