import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TextInput,
  Dimensions,
  SafeAreaView,
  TouchableOpacity,
  Modal,
} from 'react-native';

import { doc, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

import { auth, db } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';
import { RemindersContext } from '../context/RemindersContext';
import { formatearHora, describirFecha } from '../services/assistant';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [mensaje, setMensaje] = useState('');
  const [perfil, setPerfil] = useState(null);
  const [perfilVisible, setPerfilVisible] = useState(false);

  const { user, logout } = useContext(AuthContext);
  const { proximos, recordatorios, alternarCompletado } = useContext(RemindersContext);

  useEffect(() => {
    const uid = user?.uid || auth.currentUser?.uid;
    if (!uid) return undefined;

    const unsubscribe = onSnapshot(
      doc(db, 'usuarios', uid),
      (snap) => setPerfil(snap.exists() ? snap.data() : null),
      () => setPerfil(null)
    );

    return unsubscribe;
  }, [user]);

  const abrirChat = (textoInicial) => {
    const texto = typeof textoInicial === 'string' ? textoInicial : mensaje;
    if (texto && texto.trim()) {
      setMensaje('');
      navigation.navigate('Chat IA', { textoInicial: texto.trim() });
    } else {
      navigation.navigate('Chat IA');
    }
  };

  const nombre =
    perfil?.nombrePreferido ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Usuario';
  const inicial = nombre.charAt(0).toUpperCase();
  const correo = user?.email || perfil?.email || 'Sin correo';
  const uid = user?.uid || auth.currentUser?.uid || '';
  const miembroDesde = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;
  const completados = recordatorios.filter((r) => r.completado);

  const etiquetaDia = (fecha) => {
    if (!fecha) return '';
    const hoy = new Date();
    const a = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const f = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const diff = Math.round((f.getTime() - a.getTime()) / 86400000);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Manana';
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {/* Espaciador izquierdo que equilibra el botón de perfil y mantiene el logo centrado */}
          <View style={styles.headerSpacer} />

          <View style={styles.brand}>
            <Text style={styles.logoText}>NEXUS</Text>
            <Text style={styles.subtitleBrand}>
              ASISTENTE PERSONAL INTELIGENTE
            </Text>
          </View>

          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => setPerfilVisible(true)}
            activeOpacity={0.8}
          >
            <Image
              source={require('../assets/profile_icon.png')}
              style={styles.profileIcon}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <Image
            source={require('../assets/nexus_logo.png')}
            style={styles.nexusLogo}
          />

          <Text style={styles.greeting}>Hola, {nombre}</Text>

          <Text style={styles.question}>¿Qué quieres que hagamos hoy?</Text>

          <TouchableOpacity style={styles.inputLike} onPress={abrirChat} activeOpacity={0.8}>
            <Text style={styles.inputLikeTexto}>Escribe o habla con NEXUS...</Text>
            <Ionicons name="mic" size={20} color="#b75cff" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRÓXIMOS EVENTOS</Text>

          {proximos.length === 0 ? (
            <Text style={styles.vacio}>
              No tienes eventos proximos. Pideselos a NEXUS por voz o crealos
              manualmente.
            </Text>
          ) : (
            <View style={styles.eventList}>
              {proximos.slice(0, 4).map((evento) => (
                <View key={evento.id} style={styles.eventRow}>
                  {/* Botón interactivo para marcar la tarea como completada */}
                  <TouchableOpacity
                    style={styles.completeBtn}
                    onPress={() => alternarCompletado(evento)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={26}
                      color="#b75cff"
                    />
                  </TouchableOpacity>

                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTime}>{formatearHora(evento.fecha)}</Text>
                    <Text style={styles.eventName}>{evento.titulo}</Text>
                  </View>

                  <View style={styles.eventMeta}>
                    <Text style={styles.today}>{etiquetaDia(evento.fecha)}</Text>
                    <Ionicons
                      name={evento.tipo === 'alarma' ? 'alarm-outline' : 'notifications-outline'}
                      size={15}
                      color="#8f879d"
                      style={styles.eventMetaIcon}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TAREAS COMPLETADAS</Text>

          <View style={styles.taskList}>
            {completados.length === 0 ? (
              <Text style={styles.vacio}>Aun no has completado recordatorios.</Text>
            ) : (
              completados.slice(0, 4).map((tarea) => (
                <View key={tarea.id} style={styles.completedTaskRow}>
                  <TouchableOpacity
                    style={styles.completedCheckBtn}
                    onPress={() => alternarCompletado(tarea)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#7cff8b" />
                  </TouchableOpacity>
                  <Text style={styles.completedTaskText}>{tarea.titulo}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCESOS RÁPIDOS</Text>

          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickItem} onPress={abrirChat} activeOpacity={0.7}>
              <View style={styles.quickIconCircle}>
                <Ionicons name="chatbubbles" size={22} color="#b75cff" />
              </View>
              <Text style={styles.quickText}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => navigation.navigate('Recordatorios')}
              activeOpacity={0.7}
            >
              <View style={styles.quickIconCircle}>
                <Ionicons name="notifications" size={22} color="#b75cff" />
              </View>
              <Text style={styles.quickText}>Recordatorios</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => navigation.navigate('Monitor IA')}
              activeOpacity={0.7}
            >
              <View style={styles.quickIconCircle}>
                <Ionicons name="hardware-chip" size={22} color="#b75cff" />
              </View>
              <Text style={styles.quickText}>Monitor</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomInputBox}>
          <TextInput
            style={styles.bottomInput}
            placeholder="Escribe algo para NEXUS..."
            placeholderTextColor="#8f879d"
            value={mensaje}
            onChangeText={setMensaje}
            onSubmitEditing={abrirChat}
          />
          <TouchableOpacity onPress={abrirChat} style={styles.micButton} activeOpacity={0.7}>
            <Ionicons name="mic" size={22} color="#d16cff" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={perfilVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPerfilVisible(false)}
      >
        <View style={styles.modalFondo}>
          <View style={styles.perfilCard}>
            <TouchableOpacity
              style={styles.modalCerrar}
              onPress={() => setPerfilVisible(false)}
            >
              <Text style={styles.modalCerrarTexto}>✕</Text>
            </TouchableOpacity>

            <View style={styles.perfilAvatar}>
              <Text style={styles.perfilAvatarTexto}>{inicial}</Text>
            </View>

            <Text style={styles.perfilNombre}>{nombre}</Text>
            <Text style={styles.perfilCorreo}>{correo}</Text>

            <View style={styles.perfilDatos}>
              <View style={styles.perfilFila}>
                <Text style={styles.perfilEtiqueta}>Recordatorios</Text>
                <Text style={styles.perfilValor}>{recordatorios.length}</Text>
              </View>
              <View style={styles.perfilFila}>
                <Text style={styles.perfilEtiqueta}>Completados</Text>
                <Text style={styles.perfilValor}>{completados.length}</Text>
              </View>
              <View style={styles.perfilFila}>
                <Text style={styles.perfilEtiqueta}>Pendientes</Text>
                <Text style={styles.perfilValor}>{proximos.length}</Text>
              </View>
              {miembroDesde ? (
                <View style={styles.perfilFila}>
                  <Text style={styles.perfilEtiqueta}>Miembro desde</Text>
                  <Text style={styles.perfilValor}>{miembroDesde}</Text>
                </View>
              ) : null}
              <View style={styles.perfilFila}>
                <Text style={styles.perfilEtiqueta}>ID</Text>
                <Text style={styles.perfilValor} numberOfLines={1}>
                  {uid ? `${uid.slice(0, 10)}...` : '—'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.perfilSalir}
              onPress={() => {
                setPerfilVisible(false);
                logout();
              }}
            >
              <Text style={styles.perfilSalirTexto}>Cerrar sesion</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  headerSpacer: {
    width: 46,
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

  profileButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },

  profileIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },

  modalFondo: {
    flex: 1,
    backgroundColor: 'rgba(3, 1, 8, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  perfilCard: {
    width: '100%',
    backgroundColor: '#0b0715',
    borderWidth: 1,
    borderColor: '#5b267c',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
  },

  modalCerrar: {
    alignSelf: 'flex-end',
    padding: 4,
  },

  modalCerrarTexto: {
    color: '#c9b6d8',
    fontSize: 16,
  },

  perfilAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#b75cff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -6,
  },

  perfilAvatarTexto: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: 'bold',
  },

  perfilNombre: {
    color: '#f5f0f7',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 14,
  },

  perfilCorreo: {
    color: '#b9a9c7',
    fontSize: 14,
    marginTop: 4,
  },

  perfilDatos: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#241536',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginTop: 18,
  },

  perfilFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#1b1029',
  },

  perfilEtiqueta: {
    color: '#a191b0',
    fontSize: 13,
  },

  perfilValor: {
    color: '#e7e0ea',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
    flexShrink: 1,
  },

  perfilSalir: {
    width: '100%',
    backgroundColor: '#3a1150',
    borderWidth: 1,
    borderColor: '#8d3ec2',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 18,
  },

  perfilSalirTexto: {
    color: '#f0d9ff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
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

  inputLike: {
    width: '95%',
    minHeight: 55,
    borderWidth: 1,
    borderColor: '#6c328e',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#090612',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  inputLikeTexto: {
    color: '#8f879d',
    fontSize: 15,
  },

  inputLikeMic: {
    fontSize: 20,
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
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#241536',
  },

  completeBtn: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eventInfo: {
    flex: 1,
  },

  eventTime: {
    color: '#ddd5e1',
    fontSize: 14,
    fontWeight: '500',
  },

  eventName: {
    color: '#f3edf5',
    fontSize: 15,
    marginTop: 2,
    fontWeight: '600',
  },

  eventMeta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },

  eventMetaIcon: {
    marginTop: 4,
  },

  today: {
    color: '#bd6cff',
    fontSize: 13,
    fontWeight: '600',
  },

  taskList: {
    borderWidth: 1,
    borderColor: '#241536',
    borderRadius: 10,
    padding: 10,
  },

  completedTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },

  completedCheckBtn: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  completedTaskText: {
    color: '#9b90a6',
    fontSize: 14,
    textDecorationLine: 'line-through',
    flex: 1,
  },

  vacio: {
    color: '#8f879d',
    fontSize: 13,
    lineHeight: 19,
  },

  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#241536',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 6,
  },

  quickItem: {
    flex: 1,
    alignItems: 'center',
  },

  quickIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(183, 92, 255, 0.12)',
    borderWidth: 1,
    borderColor: '#5b267c',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },

  quickText: {
    color: '#ded5e2',
    fontSize: 12,
    fontWeight: '500',
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

  micButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
