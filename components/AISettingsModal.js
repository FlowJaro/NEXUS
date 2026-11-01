// ---------------------------------------------------------------------------
// NEXUS · Modal de ajustes de la IA
//
// El usuario no escribe claves: NEXUS las consigue solo. Aqui solo se elige el
// estilo de respuesta, la voz y se puede comprobar la conexion.
// ---------------------------------------------------------------------------

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { PROVEEDORES } from '../services/ai/config';
import { probarProveedor } from '../services/ai/client';
import { cargarClavesRemotas } from '../services/ai/keys';
import {
  cargarAjustes,
  claveDeProveedor,
  estadoClaves,
  guardarAjustes,
} from '../services/ai/settings';

const ORDEN = ['auto', 'llm7', 'pollinations', 'gemini', 'groq', 'openrouter', 'local'];

const TEMPERATURAS = [
  { valor: 0.2, etiqueta: 'Precisa' },
  { valor: 0.6, etiqueta: 'Equilibrada' },
  { valor: 0.9, etiqueta: 'Creativa' },
];

function sinClave(proveedor) {
  return !proveedor.requiereClave || Boolean(proveedor.claveFija);
}

export default function AISettingsModal({ visible, onClose, onGuardado }) {
  const [proveedor, setProveedor] = useState('auto');
  const [claves, setClaves] = useState({});
  const [modelos, setModelos] = useState({});
  const [textoModelo, setTextoModelo] = useState('');
  const [temperatura, setTemperatura] = useState(0.6);
  const [voz, setVoz] = useState(true);
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [clavesAuto, setClavesAuto] = useState(estadoClaves());

  useEffect(() => {
    if (!visible) return undefined;

    let activo = true;

    (async () => {
      const ajustes = await cargarAjustes();
      if (!activo) return;

      setProveedor(ajustes.proveedor);
      setClaves(ajustes.claves || {});
      setModelos(ajustes.modelos || {});
      setTemperatura(ajustes.temperatura);
      setVoz(ajustes.voz);
      setTextoModelo(ajustes.modelos?.[ajustes.proveedor] || '');
      setPrueba(null);
      setClavesAuto(estadoClaves());
    })();

    return () => {
      activo = false;
    };
  }, [visible]);

  const actual = PROVEEDORES[proveedor] || PROVEEDORES.auto;

  const ajustesBorrador = useMemo(
    () => ({
      proveedor,
      temperatura,
      voz,
      claves,
      modelos: { ...modelos, [proveedor]: textoModelo.trim() },
    }),
    [proveedor, temperatura, voz, claves, modelos, textoModelo]
  );

  const elegirProveedor = (id) => {
    setModelos((prev) => ({ ...prev, [proveedor]: textoModelo.trim() }));
    setProveedor(id);
    setTextoModelo(modelos[id] || '');
    setPrueba(null);
  };

  const probar = async () => {
    if (proveedor === 'local') return;

    setProbando(true);
    setPrueba(null);

    try {
      const resultado = await probarProveedor(proveedor, ajustesBorrador);
      const segundos = (resultado.ms / 1000).toFixed(1);
      setPrueba({
        ok: true,
        texto: `${PROVEEDORES[resultado.proveedor]?.nombre || resultado.proveedor} respondio en ${segundos}s con el modelo ${resultado.modelo}.`,
      });
    } catch (error) {
      const detalle = (error?.intentos || [])
        .map((intento) => `${intento.proveedor}: ${intento.error}`)
        .join('\n');
      setPrueba({ ok: false, texto: detalle || error?.message || 'No se pudo conectar.' });
    } finally {
      setProbando(false);
    }
  };

  const actualizarClaves = async () => {
    setRefrescando(true);
    try {
      await cargarClavesRemotas({ forzar: true });
      setClavesAuto(estadoClaves());
    } finally {
      setRefrescando(false);
    }
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await guardarAjustes(ajustesBorrador);
      onGuardado?.();
      onClose?.();
    } finally {
      setGuardando(false);
    }
  };

  const hayClaves = clavesAuto.total > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.fondo}>
        <View style={styles.hoja}>
          <View style={styles.cabecera}>
            <View style={{ flex: 1 }}>
              <Text style={styles.titulo}>MOTOR DE IA</Text>
              <Text style={styles.subtitulo}>Sin claves: NEXUS se configura solo</Text>
            </View>
            <TouchableOpacity style={styles.cerrar} onPress={onClose}>
              <Ionicons name="close" size={20} color="#d8cce0" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.cuerpo}
            contentContainerStyle={styles.cuerpoContenido}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.estadoClaves}>
              <View style={styles.estadoClavesIcono}>
                <Ionicons
                  name={hayClaves ? 'cloud-done' : 'flash'}
                  size={18}
                  color={hayClaves ? '#7cff8b' : '#b75cff'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.estadoClavesTitulo}>
                  {hayClaves ? 'Claves automaticas activas' : 'Proveedores gratuitos activos'}
                </Text>
                <Text style={styles.estadoClavesTexto}>
                  {hayClaves
                    ? `${clavesAuto.total} clave(s): ${clavesAuto.proveedores.join(', ')}. Se actualizan solas.`
                    : 'LLM7 y Pollinations funcionan sin clave ni registro. No tienes que configurar nada.'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.botonSecundario, refrescando && styles.botonDeshabilitado]}
              onPress={actualizarClaves}
              disabled={refrescando}
            >
              {refrescando ? (
                <ActivityIndicator color="#b75cff" size="small" />
              ) : (
                <Ionicons name="refresh" size={15} color="#b75cff" />
              )}
              <Text style={styles.botonSecundarioTexto}>
                {refrescando ? 'Buscando claves...' : 'Buscar claves ahora'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.seccion}>PROVEEDOR</Text>

            {ORDEN.map((id) => {
              const item = PROVEEDORES[id];
              const activo = proveedor === id;
              const listo = !item.requiereClave || Boolean(claveDeProveedor(ajustesBorrador, id));

              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.opcion, activo && styles.opcionActiva]}
                  onPress={() => elegirProveedor(id)}
                >
                  <View style={styles.opcionIcono}>
                    <Ionicons
                      name={activo ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={activo ? '#b75cff' : '#6f6480'}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.opcionTituloFila}>
                      <Text style={[styles.opcionTitulo, activo && styles.opcionTituloActiva]}>
                        {item.nombre}
                      </Text>
                      {sinClave(item) ? (
                        <Text style={[styles.insignia, styles.insigniaGratis]}>GRATIS</Text>
                      ) : listo ? (
                        <Text style={[styles.insignia, styles.insigniaOk]}>AUTOMATICA</Text>
                      ) : (
                        <Text style={[styles.insignia, styles.insigniaPendiente]}>SIN CLAVE</Text>
                      )}
                    </View>
                    <Text style={styles.opcionDescripcion}>{item.descripcion}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {proveedor !== 'local' && actual.modelos?.length > 0 && (
              <>
                <Text style={styles.seccion}>MODELO</Text>
                <TextInput
                  style={styles.input}
                  value={textoModelo}
                  onChangeText={setTextoModelo}
                  placeholder={actual.modeloPorDefecto || 'Modelo por defecto'}
                  placeholderTextColor="#6f6480"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsFila}>
                  {actual.modelos.map((modelo) => (
                    <TouchableOpacity
                      key={modelo}
                      style={[styles.chip, textoModelo === modelo && styles.chipActivo]}
                      onPress={() => setTextoModelo(modelo)}
                    >
                      <Text style={[styles.chipTexto, textoModelo === modelo && styles.chipTextoActivo]}>
                        {modelo}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={styles.seccion}>ESTILO DE RESPUESTA</Text>
            <View style={styles.chipsFila}>
              {TEMPERATURAS.map((opcion) => (
                <TouchableOpacity
                  key={opcion.valor}
                  style={[styles.chip, temperatura === opcion.valor && styles.chipActivo]}
                  onPress={() => setTemperatura(opcion.valor)}
                >
                  <Text
                    style={[styles.chipTexto, temperatura === opcion.valor && styles.chipTextoActivo]}
                  >
                    {opcion.etiqueta}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.filaSwitch}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitulo}>Respuestas por voz</Text>
                <Text style={styles.switchDescripcion}>NEXUS lee sus respuestas en voz alta.</Text>
              </View>
              <Switch
                value={voz}
                onValueChange={setVoz}
                trackColor={{ false: '#2b193d', true: '#5b267c' }}
                thumbColor={voz ? '#b75cff' : '#8f879d'}
              />
            </View>

            {proveedor !== 'local' && (
              <TouchableOpacity
                style={[styles.botonPrueba, probando && styles.botonDeshabilitado]}
                onPress={probar}
                disabled={probando}
              >
                {probando ? (
                  <ActivityIndicator color="#b75cff" size="small" />
                ) : (
                  <Ionicons name="pulse" size={16} color="#b75cff" />
                )}
                <Text style={styles.botonPruebaTexto}>
                  {probando ? 'Probando conexion...' : 'Probar conexion'}
                </Text>
              </TouchableOpacity>
            )}

            {prueba && (
              <View style={[styles.resultado, prueba.ok ? styles.resultadoOk : styles.resultadoError]}>
                <Ionicons
                  name={prueba.ok ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={prueba.ok ? '#7cff8b' : '#ff8a8a'}
                />
                <Text style={[styles.resultadoTexto, { color: prueba.ok ? '#b8ffc0' : '#ffc9c9' }]}>
                  {prueba.texto}
                </Text>
              </View>
            )}

            <Text style={styles.nota}>
              NEXUS nunca te pide claves. Si algun proveedor esta ocupado, prueba el siguiente
              automaticamente. Si no hay internet, responde en modo local.
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={[styles.botonGuardar, guardando && styles.botonDeshabilitado]}
            onPress={guardar}
            disabled={guardando}
          >
            {guardando ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.botonGuardarTexto}>GUARDAR AJUSTES</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(3, 1, 8, 0.82)',
    justifyContent: 'flex-end',
  },
  hoja: {
    maxHeight: Platform.OS === 'web' ? '92%' : '88%',
    backgroundColor: '#08040f',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: '#3c1854',
    paddingBottom: 18,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#241536',
  },
  titulo: {
    color: '#f0d9ff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  subtitulo: {
    color: '#8f879d',
    fontSize: 11,
    marginTop: 2,
  },
  cerrar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#150d22',
    borderWidth: 1,
    borderColor: '#3c1854',
  },
  cuerpo: {
    paddingHorizontal: 18,
  },
  cuerpoContenido: {
    paddingTop: 6,
    paddingBottom: 14,
  },
  estadoClaves: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2b193d',
    backgroundColor: '#0b0715',
  },
  estadoClavesIcono: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#150d22',
    borderWidth: 1,
    borderColor: '#3c1854',
  },
  estadoClavesTitulo: {
    color: '#e6dcf0',
    fontSize: 13,
    fontWeight: '600',
  },
  estadoClavesTexto: {
    color: '#8f879d',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  botonSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3c1854',
    backgroundColor: '#0b0715',
  },
  botonSecundarioTexto: {
    color: '#b75cff',
    fontSize: 12,
    fontWeight: '600',
  },
  seccion: {
    color: '#b75cff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1.6,
    marginTop: 16,
    marginBottom: 8,
  },
  opcion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#241536',
    backgroundColor: '#0b0715',
    marginBottom: 8,
  },
  opcionActiva: {
    borderColor: '#b75cff',
    backgroundColor: '#170c24',
  },
  opcionIcono: {
    marginRight: 8,
    marginTop: 1,
  },
  opcionTituloFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opcionTitulo: {
    color: '#e6dcf0',
    fontSize: 13,
    fontWeight: '600',
  },
  opcionTituloActiva: {
    color: '#f0d9ff',
  },
  opcionDescripcion: {
    color: '#8f879d',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  insignia: {
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  insigniaOk: {
    color: '#7cff8b',
    backgroundColor: 'rgba(124, 255, 139, 0.12)',
  },
  insigniaPendiente: {
    color: '#ffb86b',
    backgroundColor: 'rgba(255, 184, 107, 0.12)',
  },
  insigniaGratis: {
    color: '#9ecbff',
    backgroundColor: 'rgba(158, 203, 255, 0.12)',
  },
  input: {
    borderWidth: 1,
    borderColor: '#3c1854',
    borderRadius: 10,
    backgroundColor: '#0b0715',
    color: '#fff',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  chipsFila: {
    flexDirection: 'row',
    marginTop: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#3c1854',
    backgroundColor: '#0b0715',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipActivo: {
    borderColor: '#b75cff',
    backgroundColor: '#2a1240',
  },
  chipTexto: {
    color: '#9d92ab',
    fontSize: 11,
  },
  chipTextoActivo: {
    color: '#f0d9ff',
    fontWeight: '600',
  },
  filaSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#241536',
    backgroundColor: '#0b0715',
  },
  switchTitulo: {
    color: '#e6dcf0',
    fontSize: 13,
    fontWeight: '600',
  },
  switchDescripcion: {
    color: '#8f879d',
    fontSize: 11,
    marginTop: 2,
  },
  botonPrueba: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5b267c',
    backgroundColor: '#150d22',
  },
  botonPruebaTexto: {
    color: '#d9c6ee',
    fontSize: 13,
    fontWeight: '600',
  },
  botonDeshabilitado: {
    opacity: 0.6,
  },
  resultado: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  resultadoOk: {
    borderColor: 'rgba(124, 255, 139, 0.35)',
    backgroundColor: 'rgba(124, 255, 139, 0.08)',
  },
  resultadoError: {
    borderColor: 'rgba(255, 138, 138, 0.35)',
    backgroundColor: 'rgba(255, 138, 138, 0.08)',
  },
  resultadoTexto: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  nota: {
    color: '#6f6480',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 10,
  },
  botonGuardar: {
    marginHorizontal: 18,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#b75cff',
  },
  botonGuardarTexto: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1.4,
  },
});
