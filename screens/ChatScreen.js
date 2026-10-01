import React, { useState } from 'react';
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
} from 'react-native';

const { width } = Dimensions.get('window');

export default function ChatScreen() {
  // ESTADO 1 (Diapositiva 6 y 7): Input controlado para el prompt del usuario
  const [prompt, setPrompt] = useState('');

  // Estado reactivo para la conversación con NEXUS AI
  const [mensajes, setMensajes] = useState([
    {
      id: '1',
      emisor: 'nexus',
      texto: 'Hola, soy NEXUS. He sincronizado tu agenda y tareas. ¿Qué consulta o acción deseas ejecutar?',
      hora: '10:00 AM',
    },
  ]);

  // Estado para indicar cuando la IA está procesando (re-render de estado de carga)
  const [pensando, setPensando] = useState(false);

  // Manejador del evento de envío con validación (Diapositiva 7: if (name.trim() === '') return;)
  const handleEnviar = () => {
    if (prompt.trim() === '') return;

    const nuevoMensajeUsuario = {
      id: Date.now().toString(),
      emisor: 'usuario',
      texto: prompt.trim(),
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Actualiza el estado con el mensaje del usuario y limpia el input
    setMensajes((prev) => [...prev, nuevoMensajeUsuario]);
    const consulta = prompt.trim();
    setPrompt('');
    setPensando(true);

    // Simula procesamiento y respuesta inteligente de NEXUS tras 900ms
    setTimeout(() => {
      let respuestaIA = 'He procesado tu solicitud: ';

      if (consulta.toLowerCase().includes('reunion') || consulta.toLowerCase().includes('evento')) {
        respuestaIA = 'Tienes programada tu próxima reunión a las 09:00 AM: "Reunión de proyecto". ¿Deseas que prepare un resumen?';
      } else if (consulta.toLowerCase().includes('tarea') || consulta.toLowerCase().includes('informe')) {
        respuestaIA = 'Tu tarea prioritaria es "Enviar informe del proyecto". Está agendada para antes de las 03:00 PM.';
      } else if (consulta.toLowerCase().includes('hola') || consulta.toLowerCase().includes('nexus')) {
        respuestaIA = '¡Hola! Tus sistemas neuronales están operando al 100%. ¿En qué más puedo asistirte?';
      } else {
        respuestaIA = `Entendido. Registré en memoria: "${consulta}". Coordinando recursos del sistema.`;
      }

      setMensajes((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          emisor: 'nexus',
          texto: respuestaIA,
          hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setPensando(false);
    }, 900);
  };

  const sugerencias = [
    '¿Cuál es mi próxima reunión?',
    'Resumen de tareas pendientes',
    'Estado del sistema NEXUS',
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ENCABEZADO DE LA CONSOLA */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CONSOLA DE CHAT IA</Text>
          <Text style={styles.headerSubtitle}>
            COMUNICACIÓN DIRECTA CON NEXUS
          </Text>
        </View>

        {/* TARJETA PEDAGÓGICA (Conceptos de la diapositiva) */}
        <View style={styles.badgeConcepto}>
          <Text style={styles.badgeTitle}>⚡ Estado 1 · Formularios Controlados y Eventos</Text>
          <Text style={styles.badgeText}>
            Usa `useState` para el input y la lista de mensajes, validación con `.trim()` y eventos `onChangeText` / `onPress`.
          </Text>
        </View>

        {/* LISTA DE MENSAJES REACTIVOS */}
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
                  {m.emisor === 'usuario' ? 'TÚ' : 'NEXUS IA'}
                </Text>
                <Text style={styles.hora}>{m.hora}</Text>
              </View>
              <Text style={styles.textoMensaje}>{m.texto}</Text>
            </View>
          ))}

          {pensando && (
            <View style={[styles.burbuja, styles.burbujaNexus]}>
              <Text style={styles.tagNexus}>NEXUS IA</Text>
              <Text style={styles.textoPensando}>Procesando respuesta...</Text>
            </View>
          )}
        </ScrollView>

        {/* SUGERENCIAS RÁPIDAS */}
        <View style={styles.sugerenciasContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {sugerencias.map((sug, index) => (
              <TouchableOpacity
                key={index}
                style={styles.chip}
                onPress={() => setPrompt(sug)}
              >
                <Text style={styles.chipText}>{sug}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* CAMPO DE ENTRADA CONTROLADO (Diapositivas 6 y 7) */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Escribe una orden para NEXUS..."
            placeholderTextColor="#8f879d"
            value={prompt}
            onChangeText={setPrompt}
            onSubmitEditing={handleEnviar}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              prompt.trim() === '' ? styles.sendButtonDisabled : styles.sendButtonActive,
            ]}
            onPress={handleEnviar}
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
  headerTitle: {
    fontSize: 20,
    letterSpacing: 4,
    color: '#f0d9ff',
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#b75cff',
    marginTop: 3,
  },
  badgeConcepto: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: '#120b22',
    borderWidth: 1,
    borderColor: '#4c216b',
    borderRadius: 10,
    padding: 10,
  },
  badgeTitle: {
    fontSize: 12,
    color: '#7cff8b',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 11,
    color: '#d0c7d7',
    lineHeight: 15,
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
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
