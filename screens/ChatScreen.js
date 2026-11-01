import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RemindersContext } from '../context/RemindersContext';
import { AuthContext } from '../context/AuthContext';
import { MAX_HISTORIAL, PROVEEDORES } from '../services/ai/config';
import { conversar, ejecutarAccion } from '../services/ai/assistant';
import {
  ajustesActuales,
  cargarAjustes,
  proveedoresListos,
  suscribirAjustes,
} from '../services/ai/settings';
import { escucharUnaOrden, detenerVoz, hablar, vozDisponible } from '../services/voice';
import AISettingsModal from '../components/AISettingsModal';

const { width } = Dimensions.get('window');

function horaActual() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function nuevoId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mensajeBienvenida() {
  return {
    id: nuevoId(),
    emisor: 'nexus',
    texto:
      'Hola, soy NEXUS. Puedo responder cualquier pregunta y tambien actuar en tu telefono: recordatorios, llamadas, mensajes, musica, apps, clima y mas.\n\nYa estoy listo: no tienes que configurar nada. Prueba con "llama a mama", "pon musica" o "que clima hace en Madrid".',
    hora: horaActual(),
    acciones: [],
  };
}

const SUGERENCIAS = [
  '¿Que puedes hacer?',
  'Recuerdame llamar al banco manana a las 10',
  'Llama a mama',
  'Pon musica',
  '¿Que clima hace en Madrid?',
  'Cuentame un chiste',
];

export default function ChatScreen() {
  const { user } = useContext(AuthContext);
  const {
    recordatorios,
    proximos,
    agregarRecordatorio,
    eliminarRecordatorio,
    eliminarTodas,
    alternarCompletado,
  } = useContext(RemindersContext);

  const [prompt, setPrompt] = useState('');
  const [pensando, setPensando] = useState(false);
  const [reconociendo, setReconociendo] = useState(false);
  const [vozActivada, setVozActivada] = useState(true);
  const [mensajes, setMensajes] = useState([mensajeBienvenida()]);
  const [hidratado, setHidratado] = useState(false);
  const [ajustes, setAjustes] = useState(ajustesActuales());
  const [ajustesVisible, setAjustesVisible] = useState(false);
  const [pendientes, setPendientes] = useState([]);
  const [ejecutandoAccion, setEjecutandoAccion] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [estadoIA, setEstadoIA] = useState('');
  const [ultimoEnvio, setUltimoEnvio] = useState('');

  const sesionVoz = useRef(null);
  const scrollRef = useRef(null);

  const nombre = user?.nombrePreferido || user?.email?.split('@')[0] || 'Usuario';
  const claveChat = `nexus.ai.chat.${user?.uid || 'anonimo'}`;

  const contexto = useMemo(
    () => ({
      nombreUsuario: nombre,
      recordatorios,
      proximos,
      agregarRecordatorio,
      eliminarRecordatorio,
      eliminarTodas,
      alternarCompletado,
    }),
    [
      nombre,
      recordatorios,
      proximos,
      agregarRecordatorio,
      eliminarRecordatorio,
      eliminarTodas,
      alternarCompletado,
    ]
  );

  // -------------------------------------------------------------------------
  // Ajustes de IA
  // -------------------------------------------------------------------------
  useEffect(() => {
    let activo = true;

    cargarAjustes().then((valor) => {
      if (!activo) return;
      setAjustes(valor);
      setVozActivada(valor.voz !== false);
    });

    const desuscribir = suscribirAjustes((valor) => {
      setAjustes(valor);
      setVozActivada(valor.voz !== false);
    });

    return () => {
      activo = false;
      desuscribir();
    };
  }, []);

  // -------------------------------------------------------------------------
  // Historial persistente
  // -------------------------------------------------------------------------
  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const crudo = await AsyncStorage.getItem(claveChat);
        const guardados = crudo ? JSON.parse(crudo) : null;

        if (activo) {
          if (Array.isArray(guardados) && guardados.length > 0) {
            setMensajes(guardados);
          } else {
            setMensajes([mensajeBienvenida()]);
          }
        }
      } catch (error) {
        if (activo) setMensajes([mensajeBienvenida()]);
      } finally {
        if (activo) setHidratado(true);
      }
    })();

    return () => {
      activo = false;
    };
  }, [claveChat]);

  useEffect(() => {
    if (!hidratado) return;
    AsyncStorage.setItem(claveChat, JSON.stringify(mensajes.slice(-60))).catch(() => {});
  }, [mensajes, hidratado, claveChat]);

  const agregarMensaje = useCallback((emisor, texto, acciones = [], meta = {}) => {
    setMensajes((prev) => [
      ...prev,
      { id: nuevoId(), emisor, texto, hora: horaActual(), acciones, ...meta },
    ]);
  }, []);

  // -------------------------------------------------------------------------
  // Envio de mensajes
  // -------------------------------------------------------------------------
  const enviarOrden = async (textoEntrada) => {
    const consulta = String(textoEntrada ?? prompt).trim();
    if (!consulta || pensando) return;

    const historial = mensajes
      .filter((m) => m.emisor === 'usuario' || m.emisor === 'nexus')
      .map((m) => ({ rol: m.emisor, texto: m.texto }))
      .slice(-MAX_HISTORIAL);

    agregarMensaje('usuario', consulta);
    setPrompt('');
    setUltimoEnvio(consulta);
    setPensando(true);
    setEstadoIA('Conectando...');

    try {
      const resultado = await conversar({
        mensaje: consulta,
        historial,
        contexto,
        onEstado: (evento) => {
          if (evento.fase === 'probando') {
            const nombreMotor =
              PROVEEDORES[evento.proveedor]?.nombre || evento.proveedor;
            setEstadoIA(`Conectando con ${nombreMotor}...`);
          } else if (evento.fase === 'fallo') {
            setEstadoIA('Ese proveedor no respondio. Probando otro...');
          }
        },
      });

      agregarMensaje('nexus', resultado.respuesta, resultado.resultados || [], {
        proveedor: resultado.proveedor,
        ms: resultado.ms,
      });

      if (resultado.pendientes?.length) {
        setPendientes((prev) => [...prev, ...resultado.pendientes]);
      }

      setAviso(resultado.aviso || null);

      if (vozActivada && resultado.respuesta) {
        hablar(resultado.respuesta);
      }
    } catch (error) {
      agregarMensaje(
        'nexus',
        error?.message || 'Ocurrio un error al procesar tu mensaje. Intenta de nuevo.'
      );
    } finally {
      setPensando(false);
      setEstadoIA('');
    }
  };

  // -------------------------------------------------------------------------
  // Confirmacion de acciones sensibles
  // -------------------------------------------------------------------------
  const accionPendiente = pendientes[0] || null;

  const confirmarAccion = async () => {
    if (!accionPendiente || ejecutandoAccion) return;

    setEjecutandoAccion(true);
    try {
      const resultado = await ejecutarAccion(accionPendiente, contexto);
      agregarMensaje('sistema', resultado.mensaje, [
        { ...accionPendiente, ...resultado },
      ]);
      if (vozActivada) hablar(resultado.mensaje);
    } catch (error) {
      agregarMensaje('sistema', error?.message || 'No pude completar la accion.');
    } finally {
      setEjecutandoAccion(false);
      setPendientes((prev) => prev.slice(1));
    }
  };

  const cancelarAccion = () => {
    if (!accionPendiente) return;
    agregarMensaje('sistema', `Cancelaste: ${accionPendiente.descripcion}.`);
    setPendientes((prev) => prev.slice(1));
  };

  // -------------------------------------------------------------------------
  // Voz
  // -------------------------------------------------------------------------
  const alternarMicrofono = async () => {
    if (reconociendo) {
      sesionVoz.current?.detener?.();
      setReconociendo(false);
      return;
    }

    if (!vozDisponible()) {
      Alert.alert(
        'Voz no disponible',
        'El reconocimiento de voz necesita un development build y no funciona en Expo Go. Puedes escribir tu mensaje.'
      );
      return;
    }

    setReconociendo(true);

    const sesion = await escucharUnaOrden({
      onResultado: (texto) => setPrompt(texto),
      onFinal: (texto) => {
        setReconociendo(false);
        sesionVoz.current = null;
        enviarOrden(texto);
      },
      onError: (codigo) => {
        setReconociendo(false);
        sesionVoz.current = null;

        if (codigo === 'PERMISO_DENEGADO') {
          Alert.alert('Permiso denegado', 'Necesito acceso al microfono.');
        } else if (codigo === 'VOZ_NO_DISPONIBLE') {
          Alert.alert('Voz no disponible', 'Necesitas un development build.');
        } else {
          Alert.alert('No te escuche', 'Intenta de nuevo o escribe tu mensaje.');
        }
      },
    });

    sesionVoz.current = sesion;
    if (!sesion) setReconociendo(false);
  };

  const limpiarChat = () => {
    Alert.alert('Borrar conversacion', '¿Quieres borrar todo el historial del chat?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          detenerVoz();
          setPendientes([]);
          setAviso(null);
          setUltimoEnvio('');
          setEstadoIA('');
          setMensajes([mensajeBienvenida()]);
        },
      },
    ]);
  };

  const alternarVoz = () => {
    if (vozActivada) detenerVoz();
    setVozActivada((valor) => !valor);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const proveedorNombre = PROVEEDORES[ajustes.proveedor]?.nombre || 'IA';
  const hayMotor = proveedoresListos(ajustes).length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerTituloZona}>
              <Text style={styles.headerTitle}>CONSOLA DE CHAT IA</Text>
              <TouchableOpacity
                style={styles.estado}
                onPress={() => setAjustesVisible(true)}
              >
                <View style={[styles.punto, hayMotor ? styles.puntoOk : styles.puntoAlerta]} />
                <Text style={styles.estadoTexto} numberOfLines={1}>
                  {proveedorNombre.toUpperCase()}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.headerAcciones}>
              <TouchableOpacity style={styles.iconoBoton} onPress={alternarVoz}>
                <Ionicons
                  name={vozActivada ? 'volume-high' : 'volume-mute'}
                  size={17}
                  color="#d0c7d7"
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconoBoton} onPress={limpiarChat}>
                <Ionicons name="trash-outline" size={17} color="#d0c7d7" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.iconoBoton, styles.iconoBotonAcento]}
                onPress={() => setAjustesVisible(true)}
              >
                <Ionicons name="settings-outline" size={17} color="#b75cff" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.headerSubtitle}>ASISTENTE PERSONAL CON ACCIONES REALES</Text>
        </View>

        {aviso && (
          <View style={styles.aviso}>
            <Ionicons name="cloud-offline-outline" size={14} color="#ffb86b" />
            <Text style={styles.avisoTexto} numberOfLines={2}>
              {aviso}
            </Text>
            {Boolean(ultimoEnvio) && (
              <TouchableOpacity
                onPress={() => enviarOrden(ultimoEnvio)}
                disabled={pensando}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.avisoAccion}>Reintentar</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <ScrollView
          ref={scrollRef}
          style={styles.chatList}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {mensajes.map((m) => (
            <View
              key={m.id}
              style={[
                styles.burbuja,
                m.emisor === 'usuario'
                  ? styles.burbujaUsuario
                  : m.emisor === 'sistema'
                    ? styles.burbujaSistema
                    : styles.burbujaNexus,
              ]}
            >
              <View style={styles.emisorRow}>
                <Text
                  style={[
                    styles.emisorTag,
                    m.emisor === 'usuario'
                      ? styles.tagUsuario
                      : m.emisor === 'sistema'
                        ? styles.tagSistema
                        : styles.tagNexus,
                  ]}
                >
                  {m.emisor === 'usuario' ? 'TU' : m.emisor === 'sistema' ? 'ACCION' : 'NEXUS IA'}
                </Text>
                <Text style={styles.hora}>{m.hora}</Text>
              </View>

              <Text style={styles.textoMensaje}>{m.texto}</Text>

              {m.emisor === 'nexus' && Boolean(m.proveedor) && (
                <Text style={styles.motorTag}>
                  {PROVEEDORES[m.proveedor]?.nombre ||
                    (m.proveedor === 'local' ? 'Modo local' : m.proveedor)}
                  {typeof m.ms === 'number' && m.ms > 0
                    ? ` · ${(m.ms / 1000).toFixed(1)} s`
                    : ''}
                </Text>
              )}

              {Array.isArray(m.acciones) &&
                m.acciones.map((accion, indice) => (
                  <View key={`${m.id}-${indice}`} style={styles.accionFila}>
                    <Ionicons
                      name={accion.ok === false ? 'alert-circle' : 'checkmark-circle'}
                      size={12}
                      color={accion.ok === false ? '#ff8a8a' : '#7cff8b'}
                    />
                    <Text style={styles.accionTexto}>{accion.mensaje}</Text>
                  </View>
                ))}
            </View>
          ))}

          {pensando && (
            <View style={[styles.burbuja, styles.burbujaNexus]}>
              <Text style={styles.tagNexus}>NEXUS IA</Text>
              <View style={styles.pensandoFila}>
                <ActivityIndicator size="small" color="#b75cff" />
                <Text style={styles.textoPensando}>{estadoIA || 'Pensando...'}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.sugerenciasContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {SUGERENCIAS.map((sugerencia) => (
              <TouchableOpacity
                key={sugerencia}
                style={styles.chip}
                onPress={() => enviarOrden(sugerencia)}
                disabled={pensando}
              >
                <Text style={styles.chipText}>{sugerencia}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={
              reconociendo ? 'Escuchando...' : `Escribe o pide algo, ${nombre}`
            }
            placeholderTextColor="#8f879d"
            value={prompt}
            onChangeText={setPrompt}
            onSubmitEditing={() => enviarOrden()}
            returnKeyType="send"
            multiline={false}
          />

          <TouchableOpacity
            style={[styles.micButton, reconociendo && styles.micButtonActivo]}
            onPress={alternarMicrofono}
          >
            {reconociendo ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="mic" size={17} color="#d0c7d7" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sendButton,
              prompt.trim() === '' || pensando
                ? styles.sendButtonDisabled
                : styles.sendButtonActive,
            ]}
            onPress={() => enviarOrden()}
            disabled={prompt.trim() === '' || pensando}
          >
            {pensando ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Confirmacion de acciones sensibles */}
      <Modal
        visible={Boolean(accionPendiente)}
        transparent
        animationType="fade"
        onRequestClose={cancelarAccion}
      >
        <View style={styles.modalFondo}>
          <View style={styles.modalCaja}>
            <View style={styles.modalIcono}>
              <Ionicons name="shield-checkmark" size={26} color="#b75cff" />
            </View>

            <Text style={styles.modalTitulo}>CONFIRMAR ACCION</Text>
            <Text style={styles.modalTexto}>{accionPendiente?.descripcion}</Text>

            {Boolean(accionPendiente?.args?.mensaje) && (
              <View style={styles.modalDetalle}>
                <Text style={styles.modalDetalleTexto}>
                  “{accionPendiente.args.mensaje}”
                </Text>
              </View>
            )}

            <Text style={styles.modalNota}>
              NEXUS nunca llama ni envia mensajes sin tu permiso.
            </Text>

            <View style={styles.modalBotones}>
              <TouchableOpacity
                style={[styles.modalBoton, styles.modalBotonCancelar]}
                onPress={cancelarAccion}
                disabled={ejecutandoAccion}
              >
                <Text style={styles.modalBotonCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBoton, styles.modalBotonAceptar]}
                onPress={confirmarAccion}
                disabled={ejecutandoAccion}
              >
                {ejecutandoAccion ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBotonAceptarTexto}>Permitir</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AISettingsModal
        visible={ajustesVisible}
        onClose={() => setAjustesVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#05030b',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#241536',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerTituloZona: {
    flex: 1,
    paddingRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    letterSpacing: 2.4,
    color: '#f0d9ff',
    fontWeight: 'bold',
  },
  estado: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#120b22',
    borderWidth: 1,
    borderColor: '#2b193d',
    maxWidth: 190,
  },
  punto: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  puntoOk: {
    backgroundColor: '#7cff8b',
  },
  puntoAlerta: {
    backgroundColor: '#ffb86b',
  },
  estadoTexto: {
    color: '#b9a9c9',
    fontSize: 8,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  headerAcciones: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconoBoton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#120b22',
    borderWidth: 1,
    borderColor: '#2b193d',
  },
  iconoBotonAcento: {
    borderColor: '#5b267c',
  },
  headerSubtitle: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: '#b75cff',
    marginTop: 6,
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: 14,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 107, 0.3)',
    backgroundColor: 'rgba(255, 184, 107, 0.08)',
  },
  avisoTexto: {
    flex: 1,
    color: '#f0c79b',
    fontSize: 10,
    lineHeight: 14,
  },
  avisoAccion: {
    color: '#ffb86b',
    fontSize: 10,
    fontWeight: 'bold',
  },
  chatList: {
    flex: 1,
    paddingHorizontal: 14,
  },
  chatContent: {
    paddingVertical: 12,
    gap: 10,
  },
  burbuja: {
    maxWidth: width * 0.84,
    borderRadius: 14,
    padding: 11,
    borderWidth: 1,
  },
  burbujaNexus: {
    alignSelf: 'flex-start',
    backgroundColor: '#0b0715',
    borderColor: '#5b267c',
  },
  burbujaUsuario: {
    alignSelf: 'flex-end',
    backgroundColor: '#260f38',
    borderColor: '#8d3ec2',
  },
  burbujaSistema: {
    alignSelf: 'center',
    backgroundColor: '#0d1118',
    borderColor: '#2a3a4a',
    maxWidth: width * 0.9,
  },
  emisorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  emisorTag: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  tagNexus: {
    color: '#b75cff',
  },
  tagUsuario: {
    color: '#7cff8b',
  },
  tagSistema: {
    color: '#7fb8e8',
  },
  hora: {
    fontSize: 9,
    color: '#8f879d',
    marginLeft: 8,
  },
  textoMensaje: {
    color: '#f5f0f7',
    fontSize: 14,
    lineHeight: 20,
  },
  motorTag: {
    color: '#6f6480',
    fontSize: 9,
    marginTop: 6,
    letterSpacing: 0.3,
  },
  accionFila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 7,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#241536',
  },
  accionTexto: {
    flex: 1,
    color: '#b9a9c9',
    fontSize: 11,
    lineHeight: 15,
  },
  pensandoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  textoPensando: {
    color: '#c8becf',
    fontSize: 12,
    fontStyle: 'italic',
  },
  sugerenciasContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chip: {
    backgroundColor: '#120b22',
    borderWidth: 1,
    borderColor: '#5b267c',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  chipText: {
    color: '#d0c7d7',
    fontSize: 11,
  },
  inputContainer: {
    width: width * 0.92,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5b267c',
    borderRadius: 14,
    backgroundColor: '#0b0715',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    height: 46,
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 6,
  },
  micButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1b1228',
    borderWidth: 1,
    borderColor: '#4c216b',
  },
  micButtonActivo: {
    backgroundColor: '#b75cff',
    borderColor: '#b75cff',
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  sendButtonActive: {
    backgroundColor: '#b75cff',
  },
  sendButtonDisabled: {
    backgroundColor: '#2b193d',
  },
  modalFondo: {
    flex: 1,
    backgroundColor: 'rgba(3, 1, 8, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCaja: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0b0715',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#5b267c',
    padding: 20,
    alignItems: 'center',
  },
  modalIcono: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1b1228',
    borderWidth: 1,
    borderColor: '#5b267c',
    marginBottom: 12,
  },
  modalTitulo: {
    color: '#f0d9ff',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1.6,
  },
  modalTexto: {
    color: '#e6dcf0',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
  modalDetalle: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#150d22',
    borderWidth: 1,
    borderColor: '#2b193d',
    width: '100%',
  },
  modalDetalleTexto: {
    color: '#c8becf',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  modalNota: {
    color: '#6f6480',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 15,
  },
  modalBotones: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    width: '100%',
  },
  modalBoton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBotonCancelar: {
    borderWidth: 1,
    borderColor: '#3c1854',
    backgroundColor: '#120b22',
  },
  modalBotonCancelarTexto: {
    color: '#c8becf',
    fontSize: 13,
    fontWeight: '600',
  },
  modalBotonAceptar: {
    backgroundColor: '#b75cff',
  },
  modalBotonAceptarTexto: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
