import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';

import DateTimePicker from '@react-native-community/datetimepicker';

import { RemindersContext } from '../context/RemindersContext';
import { describirFecha } from '../services/assistant';

function fechaInicial() {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 60);
  return d;
}

export default function RemindersScreen() {
  const {
    recordatorios,
    cargando,
    permisosConcedidos,
    solicitarPermisos,
    agregarRecordatorio,
    eliminarRecordatorio,
    alternarCompletado,
  } = useContext(RemindersContext);

  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('recordatorio');
  const [fecha, setFecha] = useState(fechaInicial());
  const [mostrarFecha, setMostrarFecha] = useState(false);
  const [mostrarHora, setMostrarHora] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const handleAgregar = async () => {
    if (!titulo.trim()) {
      setError('Escribe un titulo para el recordatorio.');
      return;
    }
    if (fecha.getTime() <= Date.now()) {
      setError('La fecha debe ser en el futuro.');
      return;
    }

    setError('');
    setGuardando(true);
    try {
      await agregarRecordatorio({ titulo, fecha, tipo });
      setTitulo('');
      setFecha(fechaInicial());
      setTipo('recordatorio');
      Alert.alert(
        tipo === 'alarma' ? 'Alarma creada' : 'Recordatorio creado',
        `Se programo para ${describirFecha(fecha)}.`
      );
    } catch (err) {
      setError(err.message || 'No se pudo guardar el recordatorio.');
    } finally {
      setGuardando(false);
    }
  };

  const onCambiarFecha = (event, seleccionada) => {
    if (Platform.OS !== 'ios') setMostrarFecha(false);
    if (event.type === 'dismissed' || !seleccionada) return;
    const base = new Date(fecha);
    base.setFullYear(seleccionada.getFullYear(), seleccionada.getMonth(), seleccionada.getDate());
    setFecha(base);
  };

  const onCambiarHora = (event, seleccionada) => {
    if (Platform.OS !== 'ios') setMostrarHora(false);
    if (event.type === 'dismissed' || !seleccionada) return;
    const base = new Date(fecha);
    base.setHours(seleccionada.getHours(), seleccionada.getMinutes(), 0, 0);
    setFecha(base);
  };

  const confirmarEliminar = (item) => {
    Alert.alert(
      'Eliminar',
      `¿Eliminar "${item.titulo}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => eliminarRecordatorio(item),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>RECORDATORIOS Y ALARMAS</Text>
          <Text style={styles.headerSubtitle}>CREA Y CONTROLA TU AGENDA</Text>
        </View>

        {!permisosConcedidos && (
          <View style={styles.avisoPermiso}>
            <Text style={styles.avisoTexto}>
              Activa las notificaciones para que NEXUS te avise aunque la app
              este cerrada.
            </Text>
            <TouchableOpacity style={styles.avisoBoton} onPress={solicitarPermisos}>
              <Text style={styles.avisoBotonTexto}>Activar notificaciones</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>NUEVO</Text>

          <View style={styles.tipoRow}>
            <TouchableOpacity
              style={[styles.tipoBtn, tipo === 'recordatorio' && styles.tipoBtnActivo]}
              onPress={() => setTipo('recordatorio')}
            >
              <Text
                style={[styles.tipoTexto, tipo === 'recordatorio' && styles.tipoTextoActivo]}
              >
                🔔 Recordatorio
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tipoBtn, tipo === 'alarma' && styles.tipoBtnActivo]}
              onPress={() => setTipo('alarma')}
            >
              <Text style={[styles.tipoTexto, tipo === 'alarma' && styles.tipoTextoActivo]}>
                ⏰ Alarma
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="¿Qué quieres recordar?"
            placeholderTextColor="#8f879d"
            value={titulo}
            onChangeText={setTitulo}
          />

          <View style={styles.pickersRow}>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setMostrarFecha(true)}
            >
              <Text style={styles.pickerLabel}>Fecha</Text>
              <Text style={styles.pickerValor}>
                {fecha.toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setMostrarHora(true)}
            >
              <Text style={styles.pickerLabel}>Hora</Text>
              <Text style={styles.pickerValor}>
                {fecha.toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </TouchableOpacity>
          </View>

          {mostrarFecha && (
            <DateTimePicker
              value={fecha}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onCambiarFecha}
            />
          )}

          {mostrarHora && (
            <DateTimePicker
              value={fecha}
              mode="time"
              is24Hour
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onCambiarHora}
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.agregarBtn, guardando && styles.agregarBtnDisabled]}
            onPress={handleAgregar}
            disabled={guardando}
          >
            <Text style={styles.agregarBtnTexto}>
              {guardando ? 'Guardando...' : '+ Programar'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>PROGRAMADOS ({recordatorios.length})</Text>

          {cargando ? (
            <ActivityIndicator color="#b75cff" style={{ marginTop: 12 }} />
          ) : recordatorios.length === 0 ? (
            <Text style={styles.vacio}>
              Aun no tienes recordatorios. Crea uno o pideselo a NEXUS por voz.
            </Text>
          ) : (
            recordatorios.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <TouchableOpacity
                  style={styles.itemCheck}
                  onPress={() => alternarCompletado(item)}
                >
                  <Text style={styles.itemCheckTexto}>
                    {item.completado ? '✅' : item.tipo === 'alarma' ? '⏰' : '🔔'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.itemInfo}>
                  <Text
                    style={[styles.itemTitulo, item.completado && styles.itemCompletado]}
                  >
                    {item.titulo}
                  </Text>
                  <Text style={styles.itemFecha}>
                    {item.tipo === 'alarma' ? 'Alarma' : 'Recordatorio'} ·{' '}
                    {describirFecha(item.fecha)}
                  </Text>
                </View>

                <TouchableOpacity onPress={() => confirmarEliminar(item)}>
                  <Text style={styles.itemEliminar}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
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
    alignItems: 'center',
    marginBottom: 14,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 18,
    letterSpacing: 3,
    color: '#f0d9ff',
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#b75cff',
    marginTop: 3,
  },
  avisoPermiso: {
    backgroundColor: '#1b1228',
    borderWidth: 1,
    borderColor: '#8d3ec2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  avisoTexto: {
    color: '#e6d9f0',
    fontSize: 13,
    marginBottom: 10,
  },
  avisoBoton: {
    backgroundColor: '#b75cff',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  avisoBotonTexto: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
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
  cardTitle: {
    color: '#b65cff',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 12,
  },
  tipoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  tipoBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4c216b',
    alignItems: 'center',
    backgroundColor: '#07040e',
  },
  tipoBtnActivo: {
    backgroundColor: '#260f38',
    borderColor: '#8d3ec2',
  },
  tipoTexto: {
    color: '#9b90a6',
    fontSize: 13,
    fontWeight: '600',
  },
  tipoTextoActivo: {
    color: '#f0d9ff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#4c216b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    backgroundColor: '#07040e',
    fontSize: 15,
    marginBottom: 12,
  },
  pickersRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  pickerBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#4c216b',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#07040e',
  },
  pickerLabel: {
    fontSize: 10,
    color: '#8f879d',
    marginBottom: 4,
    letterSpacing: 1,
  },
  pickerValor: {
    color: '#f0d9ff',
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: '#ff6b81',
    fontSize: 13,
    marginBottom: 10,
  },
  agregarBtn: {
    backgroundColor: '#b75cff',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  agregarBtnDisabled: {
    opacity: 0.6,
  },
  agregarBtnTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  vacio: {
    color: '#8f879d',
    fontSize: 13,
    lineHeight: 19,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#241536',
  },
  itemCheck: {
    width: 34,
  },
  itemCheckTexto: {
    fontSize: 20,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitulo: {
    color: '#f3edf5',
    fontSize: 15,
    fontWeight: '600',
  },
  itemCompletado: {
    textDecorationLine: 'line-through',
    color: '#8f879d',
  },
  itemFecha: {
    color: '#9b90a6',
    fontSize: 12,
    marginTop: 3,
  },
  itemEliminar: {
    fontSize: 18,
    paddingLeft: 12,
  },
});
