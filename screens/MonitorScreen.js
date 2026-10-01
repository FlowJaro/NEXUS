import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function MonitorScreen() {
  // =========================================================================
  // ESTADO 2 (Diapositivas 8, 9 y 10): useEffect con temporizador y cleanup
  // Monitor de Tiempo de Sesión en Vivo de NEXUS
  // =========================================================================
  const [segundos, setSegundos] = useState(0);
  const [activo, setActivo] = useState(true);

  // Hook useEffect que gestiona el efecto secundario del temporizador (Slide 10)
  useEffect(() => {
    let id = null;

    if (activo) {
      // 3. Iniciar el temporizador (Slide 10)
      id = setInterval(() => {
        setSegundos((s) => s + 1);
      }, 1000);
    }

    // 4. Limpiar al desmontar o al pausar para evitar fugas de memoria (Slide 9 y 10)
    return () => {
      if (id) clearInterval(id);
    };
  }, [activo]); // Array con dependencias: se re-ejecuta cuando cambia 'activo'

  // Formato para mostrar tiempo hh:mm:ss
  const formatTiempo = (totalSegundos) => {
    const hrs = Math.floor(totalSegundos / 3600);
    const mins = Math.floor((totalSegundos % 3600) / 60);
    const secs = totalSegundos % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // =========================================================================
  // ESTADO COMPLEMENTARIO (Diapositivas 3 y 4): Contador numérico con useState
  // Selector de Nivel de Procesamiento / Potencia de la IA
  // =========================================================================
  const [nivelPotencia, setNivelPotencia] = useState(2); // Valor inicial = 2

  const incrementarNivel = () => {
    setNivelPotencia((prev) => Math.min(prev + 1, 5));
  };

  const decrementarNivel = () => {
    setNivelPotencia((prev) => Math.max(prev - 1, 1));
  };

  const nivelesInfo = {
    1: { nombre: 'Modo Eco / Ahorro', desc: 'Respuestas concisas y de mínimo consumo.' },
    2: { nombre: 'Modo Asistente Estándar', desc: 'Equilibrio óptimo entre velocidad y detalle.' },
    3: { nombre: 'Modo Analítico Avanzado', desc: 'Análisis profundo de tareas y calendario.' },
    4: { nombre: 'Modo Creativo Neuronal', desc: 'Generación extendida y propuestas inteligentes.' },
    5: { nombre: 'Modo Overclock / Máxima Potencia', desc: 'Procesamiento en tiempo real con prioridad total.' },
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ENCABEZADO */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>TELEMETRÍA Y SISTEMA</Text>
          <Text style={styles.headerSubtitle}>
            MONITOR EN VIVO DEL MOTOR NEXUS
          </Text>
        </View>

        {/* TARJETA PEDAGÓGICA */}
        <View style={styles.badgeConcepto}>
          <Text style={styles.badgeTitle}>⚡ Estado 2 · useEffect y Efectos Secundarios</Text>
          <Text style={styles.badgeText}>
            Usa `useEffect` con `setInterval` para actualizar el tiempo de sesión en vivo y función de retorno `clearInterval` para evitar fugas de memoria al desmontar.
          </Text>
        </View>

        {/* SECCIÓN 1: MONITOR DE SESIÓN (useEffect) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>TIEMPO DE SESIÓN ACTIVA</Text>
            <View style={[styles.statusDot, activo ? styles.dotActive : styles.dotPaused]}>
              <Text style={styles.statusDotText}>{activo ? 'EN LÍNEA' : 'PAUSADO'}</Text>
            </View>
          </View>

          {/* DISPLAY DEL TIEMPO (Slide 10: <Text>{seconds}s</Text>) */}
          <View style={styles.timerDisplay}>
            <Text style={styles.timerText}>{formatTiempo(segundos)}</Text>
            <Text style={styles.timerSecondsSub}>{segundos} segundos transcurridos</Text>
          </View>

          {/* BOTONES DE CONTROL DE EFECTO */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, activo ? styles.btnPause : styles.btnResume]}
              onPress={() => setActivo(!activo)}
            >
              <Text style={styles.btnText}>{activo ? '⏸ Pausar' : '▶ Reanudar'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnReset]}
              onPress={() => setSegundos(0)}
            >
              <Text style={styles.btnText}>↺ Reiniciar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECCIÓN 2: MÉTRICAS EN VIVO */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>MÉTRICAS DEL SISTEMA</Text>

          <View style={styles.metricGrid}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Latencia</Text>
              <Text style={styles.metricValue}>14 ms</Text>
            </View>

            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Memoria RAM</Text>
              <Text style={styles.metricValue}>128 MB</Text>
            </View>

            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Peticiones</Text>
              <Text style={styles.metricValue}>{Math.floor(segundos / 3) + 5}</Text>
            </View>

            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Estado Red</Text>
              <Text style={[styles.metricValue, { color: '#7cff8b' }]}>Estable</Text>
            </View>
          </View>
        </View>

        {/* SECCIÓN 3: CONTADOR DE NIVEL DE POTENCIA (Diapositivas 3 y 4: useState) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>NIVEL DE PROCESAMIENTO IA</Text>
            <Text style={styles.counterBadge}>Slide 4: useState</Text>
          </View>

          <Text style={styles.infoText}>
            Demostración del contador numérico paso a paso aplicado a la potencia de la IA.
          </Text>

          {/* DISPLAY DEL CONTADOR (Slide 4: <Text>{count}</Text>) */}
          <View style={styles.counterRow}>
            <TouchableOpacity
              style={[styles.counterBtn, nivelPotencia <= 1 && styles.counterBtnDisabled]}
              onPress={decrementarNivel}
              disabled={nivelPotencia <= 1}
            >
              <Text style={styles.counterBtnText}>−</Text>
            </TouchableOpacity>

            <View style={styles.counterDisplay}>
              <Text style={styles.counterNumber}>{nivelPotencia}</Text>
              <Text style={styles.counterMax}>/ 5</Text>
            </View>

            <TouchableOpacity
              style={[styles.counterBtn, nivelPotencia >= 5 && styles.counterBtnDisabled]}
              onPress={incrementarNivel}
              disabled={nivelPotencia >= 5}
            >
              <Text style={styles.counterBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* DESCRIPCIÓN DINÁMICA SEGÚN EL ESTADO */}
          <View style={styles.modoDescBox}>
            <Text style={styles.modoNombre}>{nivelesInfo[nivelPotencia].nombre}</Text>
            <Text style={styles.modoDesc}>{nivelesInfo[nivelPotencia].desc}</Text>
          </View>
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
    alignItems: 'center',
    marginBottom: 14,
    paddingTop: 8,
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
    backgroundColor: '#120b22',
    borderWidth: 1,
    borderColor: '#4c216b',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
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
  card: {
    width: '100%',
    backgroundColor: '#0b0715',
    borderWidth: 1,
    borderColor: '#4c216b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    color: '#b65cff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  statusDot: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  dotActive: {
    backgroundColor: 'rgba(124, 255, 139, 0.2)',
    borderColor: '#7cff8b',
    borderWidth: 1,
  },
  dotPaused: {
    backgroundColor: 'rgba(255, 124, 124, 0.2)',
    borderColor: '#ff7c7c',
    borderWidth: 1,
  },
  statusDotText: {
    fontSize: 10,
    color: '#7cff8b',
    fontWeight: 'bold',
  },
  timerDisplay: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#07040e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#241536',
    marginBottom: 14,
  },
  timerText: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#f0d9ff',
    letterSpacing: 3,
    fontVariant: ['tabular-nums'],
  },
  timerSecondsSub: {
    fontSize: 12,
    color: '#8f879d',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPause: {
    backgroundColor: '#5b267c',
  },
  btnResume: {
    backgroundColor: '#7cff8b',
  },
  btnReset: {
    backgroundColor: '#1b1228',
    borderWidth: 1,
    borderColor: '#4c216b',
  },
  btnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#07040e',
    borderWidth: 1,
    borderColor: '#241536',
    borderRadius: 10,
    padding: 12,
  },
  metricLabel: {
    fontSize: 11,
    color: '#8f879d',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    color: '#f0d9ff',
    fontWeight: 'bold',
  },
  counterBadge: {
    fontSize: 10,
    color: '#bd6cff',
    borderWidth: 1,
    borderColor: '#4c216b',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#c8becf',
    marginBottom: 14,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 14,
  },
  counterBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#5b267c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnDisabled: {
    backgroundColor: '#1a0e24',
    opacity: 0.5,
  },
  counterBtnText: {
    fontSize: 26,
    color: '#fff',
    fontWeight: 'bold',
  },
  counterDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  counterNumber: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#7cff8b',
  },
  counterMax: {
    fontSize: 20,
    color: '#8f879d',
    marginLeft: 4,
  },
  modoDescBox: {
    backgroundColor: '#07040e',
    borderWidth: 1,
    borderColor: '#241536',
    borderRadius: 10,
    padding: 12,
  },
  modoNombre: {
    fontSize: 13,
    color: '#f0d9ff',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modoDesc: {
    fontSize: 12,
    color: '#8f879d',
    lineHeight: 16,
  },
});
