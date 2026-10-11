import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';

import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';

import {
  addReceivedListener,
  dismissNotification,
} from '../services/notifications';
import { RemindersContext } from '../context/RemindersContext';

const SONIDO_ALARMA = require('../assets/alarm_beep.wav');
const VENTANA_RECIENTE = 60000;

export default function InAppNotifications() {
  const { recordatorios } = useContext(RemindersContext);
  const [banner, setBanner] = useState(null);
  const [alarma, setAlarma] = useState(null);

  const timerBanner = useRef(null);
  const disparados = useRef(new Set());
  const alarmandoRef = useRef(false);
  const player = useAudioPlayer(SONIDO_ALARMA);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const mostrar = useCallback((info) => {
    const clave = info.clave || info.id;
    if (clave && disparados.current.has(clave)) return;
    if (info.tipo === 'alarma' && alarmandoRef.current) return;
    if (clave) disparados.current.add(clave);

    if (info.tipo === 'alarma') {
      alarmandoRef.current = true;
      setAlarma(info);
    } else {
      setBanner(info);
      if (timerBanner.current) clearTimeout(timerBanner.current);
      timerBanner.current = setTimeout(() => setBanner(null), 6000);
    }
  }, []);

  useEffect(() => {
    const suscripcion = addReceivedListener((notificacion) => {
      const contenido = notificacion?.request?.content || {};
      const datos = contenido.data || {};
      const id = notificacion?.request?.identifier;

      mostrar({
        clave: `notif:${id}`,
        id,
        tipo: datos.tipo === 'alarma' ? 'alarma' : 'recordatorio',
        titulo: contenido.title || 'NEXUS',
        cuerpo: contenido.body || '',
      });
    });

    return () => {
      if (suscripcion && typeof suscripcion.remove === 'function') {
        suscripcion.remove();
      }
      if (timerBanner.current) clearTimeout(timerBanner.current);
    };
  }, [mostrar]);

  useEffect(() => {
    const temporizadores = [];
    const ahora = Date.now();

    (recordatorios || []).forEach((item) => {
      if (item.completado || !item.fecha) return;
      const momento = item.fecha.getTime();
      if (Number.isNaN(momento)) return;

      const esAlarma = item.tipo === 'alarma';
      const info = {
        clave: `item:${item.id}`,
        id: item.id,
        tipo: esAlarma ? 'alarma' : 'recordatorio',
        titulo: item.titulo || 'NEXUS',
        cuerpo: esAlarma ? 'Es hora de tu alarma' : 'Tienes un recordatorio',
      };

      const restante = momento - ahora;
      if (restante <= 0) {
        if (ahora - momento < VENTANA_RECIENTE) mostrar(info);
        return;
      }

      temporizadores.push(setTimeout(() => mostrar(info), restante));
    });

    return () => temporizadores.forEach((id) => clearTimeout(id));
  }, [recordatorios, mostrar]);

  useEffect(() => {
    if (!player) return;
    try {
      player.loop = true;
      player.volume = 1;
    } catch (error) {
      // sin accion
    }
  }, [player]);

  useEffect(() => {
    if (!player) return;

    if (alarma) {
      try {
        const resultado = player.seekTo ? player.seekTo(0) : null;
        if (resultado && typeof resultado.catch === 'function') {
          resultado.catch(() => {});
        }
      } catch (error) {
        // sin accion
      }
      try {
        player.play();
      } catch (error) {
        // sin accion
      }
    } else {
      try {
        player.pause();
      } catch (error) {
        // sin accion
      }
    }
  }, [alarma, player]);

  const cerrarAlarma = () => {
    alarmandoRef.current = false;
    if (player) {
      try {
        player.pause();
      } catch (error) {
        // sin accion
      }
    }
    if (alarma?.id) dismissNotification(alarma.id);
    setAlarma(null);
  };

  return (
    <>
      {banner && (
        <View style={styles.bannerZona} pointerEvents="box-none">
          <View style={styles.bannerCard}>
            <View style={styles.bannerHeader}>
              <Text style={styles.bannerTitulo} numberOfLines={1}>
                {banner.titulo}
              </Text>
              <TouchableOpacity onPress={() => setBanner(null)}>
                <Text style={styles.bannerCerrar}>✕</Text>
              </TouchableOpacity>
            </View>
            {banner.cuerpo ? (
              <Text style={styles.bannerCuerpo}>{banner.cuerpo}</Text>
            ) : null}
          </View>
        </View>
      )}

      <Modal
        visible={Boolean(alarma)}
        transparent
        animationType="fade"
        onRequestClose={cerrarAlarma}
      >
        <View style={styles.alarmaFondo}>
          <View style={styles.alarmaCard}>
            <Text style={styles.alarmaIcono}>⏰</Text>
            <Text style={styles.alarmaTitulo}>{alarma?.titulo || 'ALARMA'}</Text>
            <Text style={styles.alarmaCuerpo}>
              {alarma?.cuerpo || 'Es hora de tu alarma'}
            </Text>
            <TouchableOpacity style={styles.alarmaBoton} onPress={cerrarAlarma}>
              <Text style={styles.alarmaBotonTexto}>DETENER</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bannerZona: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 40,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    zIndex: 1000,
  },
  bannerCard: {
    backgroundColor: '#17092a',
    borderWidth: 1,
    borderColor: '#b75cff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#b75cff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerTitulo: {
    color: '#f0d9ff',
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
  },
  bannerCerrar: {
    color: '#c9b6d8',
    fontSize: 16,
    paddingHorizontal: 6,
  },
  bannerCuerpo: {
    color: '#d8cce0',
    fontSize: 13,
    marginTop: 6,
  },
  alarmaFondo: {
    flex: 1,
    backgroundColor: 'rgba(3, 1, 8, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  alarmaCard: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#12081f',
    borderWidth: 2,
    borderColor: '#b75cff',
    borderRadius: 20,
    padding: 26,
  },
  alarmaIcono: {
    fontSize: 64,
    marginBottom: 10,
  },
  alarmaTitulo: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  alarmaCuerpo: {
    color: '#d8cce0',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  alarmaBoton: {
    backgroundColor: '#b75cff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 44,
  },
  alarmaBotonTexto: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
});
