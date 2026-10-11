import React, { useState, useRef, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { RemindersContext } from '../context/RemindersContext';
import { AuthContext } from '../context/AuthContext';
import { procesarOrden, describirFecha } from '../services/assistant';
import {
  escucharUnaOrden,
  detenerVoz,
  hablar,
  vozDisponible,
} from '../services/voice';

const { width } = Dimensions.get('window');

function horaActual() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen() {
  const { user } = useContext(AuthContext);
  const {
    proximos,
    agregarRecordatorio,
    eliminarRecordatorio,
    eliminarTodas,
  } = useContext(RemindersContext);

  const [prompt, setPrompt] = useState('');
  const [pensando, setPensando] = useState(false);
  const [reconociendo, setReconociendo] = useState(false);
  const [vozActivada, setVozActivada] = useState(true);

  const sesionVoz = useRef(null);

  const [mensajes, setMensajes] = useState([
    {
      id: '1',
      emisor: 'nexus',
      texto:
        'Hola, soy NEXUS. Puedo crear recordatorios y alarmas por ti. Escribe o pulsa el microfono y dime por ejemplo: "recuerdame llamar a mama manana a las 3 de la tarde".',
      hora: horaActual(),
    },
  ]);

  const agregarMensaje = (emisor, texto) => {
    setMensajes((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length}`, emisor, texto, hora: horaActual() },
    ]);
  };

  const responderNexus = (texto) => {
    agregarMensaje('nexus', texto);
    if (vozActivada) hablar(texto);
  };

  const enviarOrden = async (textoEntrada) => {
    const consulta = (textoEntrada ?? prompt).trim();
    if (!consulta || pensando) return;

    agregarMensaje('usuario', consulta);
    setPrompt('');
    setPensando(true);

    const orden = procesarOrden(consulta);
    let respuesta = '';

    try {
      if (orden.intent === 'saludo') {
        respuesta =
          'Hola. Dime que quieres recordar o que alarma programar. Por ejemplo: "pon una alarma a las 7 de la manana".';
      } else if (orden.intent === 'ayuda') {
        respuesta =
          'Puedo crear recordatorios y alarmas, listarlos y eliminarlos. Prueba: "recuerdame tomar agua en 20 minutos" o "mis recordatorios".';
      } else if (orden.intent === 'hora') {
        respuesta = `Son las ${orden.horaActual}.`;
      } else if (orden.intent === 'listar') {
        if (proximos.length === 0) {
          respuesta = 'No tienes recordatorios ni alarmas pendientes.';
        } else {
          respuesta =
            'Tus proximos compromisos:\n' +
            proximos
              .slice(0, 6)
              .map((r) => `• ${r.titulo} — ${describirFecha(r.fecha)}`)
              .join('\n');
        }
      } else if (orden.intent === 'eliminar') {
        if (orden.todas) {
          await eliminarTodas();
          respuesta = 'Listo, elimine todos tus recordatorios y alarmas.';
        } else {
          const objetivo =
            proximos.find((r) => (orden.tipo ? r.tipo === orden.tipo : true)) ||
            proximos[0];
          if (!objetivo) {
            respuesta = 'No encontre recordatorios para eliminar.';
          } else {
            await eliminarRecordatorio(objetivo);
            respuesta = `Elimine "${objetivo.titulo}".`;
          }
        }
      } else if (orden.intent === 'crear') {
        if (orden.error || !orden.fecha) {
          respuesta = orden.error || 'No pude entender la fecha y la hora.';
        } else {
          await agregarRecordatorio({
            titulo: orden.titulo,
            fecha: orden.fecha,
            tipo: orden.tipo,
          });
          const etiqueta = orden.tipo === 'alarma' ? 'alarma' : 'recordatorio';
          respuesta = `Listo. Programe tu ${etiqueta} "${orden.titulo}" ${describirFecha(
            orden.fecha
          )}.`;
        }
      } else {
        respuesta =
          'No estoy seguro de que quieres hacer. Intenta: "recuerdame comprar pan en 30 minutos".';
      }
    } catch (err) {
      respuesta = err?.message || 'Ocurrio un error al procesar tu orden.';
    }

    setPensando(false);
    responderNexus(respuesta);
  };

  const alternarMicrofono = async () => {
    if (reconociendo) {
      sesionVoz.current?.detener?.();
      setReconociendo(false);
      return;
    }

    if (!vozDisponible()) {
      Alert.alert(
        'Voz no disponible',
        'El reconocimiento de voz necesita un development build y no funciona en Expo Go. Puedes escribir tu orden.'
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
          Alert.alert('No te escuche', 'Intenta de nuevo o escribe tu orden.');
        }
      },
    });

    sesionVoz.current = sesion;
    if (!sesion) setReconociendo(false);
  };

  const sugerencias = [
    'Recuerdame llamar a mama manana a las 3 de la tarde',
    'Pon una alarma a las 7 de la manana',
    'Mis recordatorios',
  ];

  const nombre = user?.nombrePreferido || user?.email?.split('@')[0] || 'Usuario';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>CONSOLA DE CHAT IA</Text>
            <TouchableOpacity
              style={styles.vozToggle}
              onPress={() => {
                if (vozActivada) detenerVoz();
                setVozActivada((v) => !v);
              }}
            >
              <Text style={styles.vozToggleTexto}>
                {vozActivada ? '🔊 Voz' : '🔇 Voz'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>
            COMUNICACION DIRECTA CON NEXUS
          </Text>
        </View>

        <ScrollView
          style={styles.chatList}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {mensajes.map((m) => (
            <View
              key={m.id}
              style={[
                styles.burbuja,
                m.emisor === 'usuario' ? styles.burbujaUsuario : styles.burbujaNexus,
              ]}
            >
              <View style={styles.emisorRow}>
                <Text
                  style={[
                    styles.emisorTag,
                    m.emisor === 'usuario' ? styles.tagUsuario : styles.tagNexus,
                  ]}
                >
                  {m.emisor === 'usuario' ? 'TU' : 'NEXUS IA'}
                </Text>
                <Text style={styles.hora}>{m.hora}</Text>
              </View>
              <Text style={styles.textoMensaje}>{m.texto}</Text>
            </View>
          ))}

          {pensando && (
            <View style={[styles.burbuja, styles.burbujaNexus]}>
              <Text style={styles.tagNexus}>NEXUS IA</Text>
              <Text style={styles.textoPensando}>Procesando orden...</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.sugerenciasContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {sugerencias.map((sug, index) => (
              <TouchableOpacity
                key={index}
                style={styles.chip}
                onPress={() => enviarOrden(sug)}
              >
                <Text style={styles.chipText}>{sug}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={
              reconociendo ? 'Escuchando...' : `Escribe una orden para NEXUS, ${nombre}`
            }
            placeholderTextColor="#8f879d"
            value={prompt}
            onChangeText={setPrompt}
            onSubmitEditing={() => enviarOrden()}
            returnKeyType="send"
          />

          <TouchableOpacity
            style={[styles.micButton, reconociendo && styles.micButtonActivo]}
            onPress={alternarMicrofono}
          >
            {reconociendo ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.micButtonTexto}>🎤</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sendButton,
              prompt.trim() === '' ? styles.sendButtonDisabled : styles.sendButtonActive,
            ]}
            onPress={() => enviarOrden()}
            disabled={prompt.trim() === ''}
          >
            <Text style={styles.sendButtonText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#241536',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerTitle: {
    fontSize: 18,
    letterSpacing: 3,
    color: '#f0d9ff',
    fontWeight: 'bold',
    flex: 1,
  },
  vozToggle: {
    borderWidth: 1,
    borderColor: '#4c216b',
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#120b22',
  },
  vozToggleTexto: {
    color: '#d0c7d7',
    fontSize: 12,
  },
  headerSubtitle: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#b75cff',
    marginTop: 3,
  },
  chatList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  chatContent: {
    paddingVertical: 12,
    gap: 12,
  },
  burbuja: {
    maxWidth: width * 0.82,
    borderRadius: 14,
    padding: 12,
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
  emisorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  emisorTag: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  tagNexus: {
    color: '#b75cff',
  },
  tagUsuario: {
    color: '#7cff8b',
  },
  hora: {
    fontSize: 10,
    color: '#8f879d',
    marginLeft: 8,
  },
  textoMensaje: {
    color: '#f5f0f7',
    fontSize: 14,
    lineHeight: 20,
  },
  textoPensando: {
    color: '#c8becf',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 3,
  },
  sugerenciasContainer: {
    paddingHorizontal: 14,
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
    fontSize: 12,
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
    marginBottom: 12,
  },
  input: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 6,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  micButtonTexto: {
    fontSize: 17,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
