import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TextInput,
  Dimensions,
  SafeAreaView,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const [mensaje, setMensaje] = useState('');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ENCABEZADO */}
        <View style={styles.header}>
          <Text style={styles.menu}>☰</Text>

          <View style={styles.brand}>
            <Text style={styles.logoText}>NEXUS</Text>
            <Text style={styles.subtitleBrand}>
              ASISTENTE PERSONAL INTELIGENTE
            </Text>
          </View>

          <Image
            source={require('../assets/profile_icon.png')}
            style={styles.profileIcon}
          />
        </View>

        {/* PRESENTACIÓN */}
        <View style={styles.heroCard}>
          <Image
            source={require('../assets/nexus_logo.png')}
            style={styles.nexusLogo}
          />

          <Text style={styles.greeting}>Hola, Usuario</Text>

          <Text style={styles.question}>
            ¿Qué quieres que hagamos hoy?
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Escribe o habla..."
            placeholderTextColor="#8f879d"
          />
        </View>

        {/* PRÓXIMOS EVENTOS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRÓXIMOS EVENTOS</Text>

          <View style={styles.eventList}>
            <View style={styles.eventRow}>
              <Text style={styles.eventIcon}>▣</Text>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTime}>09:00 AM</Text>
                <Text style={styles.eventName}>Reunión de proyecto</Text>
              </View>
              <Text style={styles.today}>Hoy</Text>
            </View>

            <View style={styles.eventRow}>
              <Text style={styles.eventIcon}>▣</Text>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTime}>01:00 PM</Text>
                <Text style={styles.eventName}>Almuerzo con Laura</Text>
              </View>
              <Text style={styles.today}>Hoy</Text>
            </View>

            <View style={styles.eventRow}>
              <Text style={styles.eventIcon}>▣</Text>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTime}>03:00 PM</Text>
                <Text style={styles.eventName}>Entrega de informe</Text>
              </View>
              <Text style={styles.today}>Hoy</Text>
            </View>
          </View>
        </View>

        {/* TAREAS PENDIENTES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TAREAS PENDIENTES</Text>

          <View style={styles.taskList}>
            <Text style={styles.task}>○   Enviar informe del proyecto</Text>
            <Text style={styles.task}>○   Comprar regalo para Laura</Text>
            <Text style={styles.task}>○   Reservar mesa para cena</Text>
          </View>
        </View>

        {/* ACCESOS RÁPIDOS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCESOS RÁPIDOS</Text>

          <View style={styles.quickRow}>
            <View style={styles.quickItem}>
              <Text style={styles.quickIcon}>▢</Text>
              <Text style={styles.quickText}>Chat</Text>
            </View>

            <View style={styles.quickItem}>
              <Text style={styles.quickIcon}>✓</Text>
              <Text style={styles.quickText}>Tareas</Text>
            </View>

            <View style={styles.quickItem}>
              <Text style={styles.quickIcon}>□</Text>
              <Text style={styles.quickText}>Calendario</Text>
            </View>

            <View style={styles.quickItem}>
              <Text style={styles.quickIcon}>▱</Text>
              <Text style={styles.quickText}>Archivos</Text>
            </View>
          </View>
        </View>

        {/* CAMPO INFERIOR */}
        <View style={styles.bottomInputBox}>
          <TextInput
            style={styles.bottomInput}
            placeholder="Escribe algo para NEXUS..."
            placeholderTextColor="#8f879d"
            value={mensaje}
            onChangeText={setMensaje}
          />
          <Text style={styles.microphone}>◉</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#05030b',
  },

  scroll: {
    padding: 16,
    paddingBottom: 35,
  },

  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  menu: {
    fontSize: 30,
    color: '#b75cff',
    width: 45,
  },

  brand: {
    alignItems: 'center',
    flex: 1,
  },

  logoText: {
    fontSize: 30,
    letterSpacing: 7,
    color: '#f0d9ff',
    fontWeight: '300',
  },

  subtitleBrand: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#d0c7d7',
    marginTop: 3,
  },

  profileIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },

  heroCard: {
    width: width * 0.92,
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: '#0b0715',
    borderWidth: 1,
    borderColor: '#5b267c',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },

  nexusLogo: {
    width: 145,
    height: 145,
    borderRadius: 72,
    marginBottom: 8,
  },

  greeting: {
    fontSize: 27,
    color: '#f5f0f7',
    fontWeight: '400',
  },

  question: {
    fontSize: 15,
    color: '#c8becf',
    marginTop: 5,
    marginBottom: 18,
  },

  input: {
    width: '95%',
    height: 55,
    borderWidth: 1,
    borderColor: '#6c328e',
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#fff',
    backgroundColor: '#090612',
  },

  section: {
    width: width * 0.92,
    alignSelf: 'center',
    backgroundColor: '#0b0715',
    borderWidth: 1,
    borderColor: '#4c216b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },

  sectionTitle: {
    color: '#b65cff',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 10,
  },

  eventList: {
    borderWidth: 1,
    borderColor: '#241536',
    borderRadius: 10,
    overflow: 'hidden',
  },

  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#241536',
  },

  eventIcon: {
    fontSize: 25,
    color: '#7cff8b',
    width: 45,
    textAlign: 'center',
  },

  eventInfo: {
    flex: 1,
  },

  eventTime: {
    color: '#ddd5e1',
    fontSize: 14,
  },

  eventName: {
    color: '#f3edf5',
    fontSize: 15,
    marginTop: 2,
  },

  today: {
    color: '#bd6cff',
    fontSize: 14,
  },

  taskList: {
    borderWidth: 1,
    borderColor: '#241536',
    borderRadius: 10,
    padding: 10,
  },

  task: {
    color: '#e7e0ea',
    fontSize: 15,
    paddingVertical: 8,
  },

  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#241536',
    borderRadius: 10,
    paddingVertical: 13,
  },

  quickItem: {
    flex: 1,
    alignItems: 'center',
  },

  quickIcon: {
    color: '#c268ff',
    fontSize: 25,
    marginBottom: 5,
  },

  quickText: {
    color: '#ded5e2',
    fontSize: 13,
  },

  bottomInputBox: {
    width: width * 0.92,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5b267c',
    borderRadius: 14,
    backgroundColor: '#0b0715',
    paddingHorizontal: 12,
  },

  bottomInput: {
    flex: 1,
    height: 55,
    color: '#fff',
    paddingHorizontal: 8,
  },

  microphone: {
    color: '#d16cff',
    fontSize: 25,
    paddingHorizontal: 8,
  },
});
