import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from '../firebaseConfig';
import { AuthContext } from './AuthContext';
import {
  cancelReminderNotification,
  ensureNotificationPermissions,
  scheduleReminderNotification,
} from '../services/notifications';

export const RemindersContext = createContext();

const COLECCION = 'recordatorios';

function aFecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor.toDate === 'function') return valor.toDate();
  return new Date(valor);
}

export function RemindersProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [recordatorios, setRecordatorios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [permisosConcedidos, setPermisosConcedidos] = useState(false);

  const reconciliados = useRef(new Set());

  useEffect(() => {
    if (!user) return undefined;

    let activo = true;

    (async () => {
      const concedidos = await ensureNotificationPermissions();
      if (activo) setPermisosConcedidos(concedidos);
    })();

    return () => {
      activo = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setRecordatorios([]);
      setCargando(false);
      return undefined;
    }

    setCargando(true);

    const q = query(
      collection(db, COLECCION),
      where('uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const datos = snapshot.docs
          .map((d) => {
            const data = d.data();
            return { id: d.id, ...data, fecha: aFecha(data.fecha) };
          })
          .sort((a, b) => (a.fecha?.getTime() || 0) - (b.fecha?.getTime() || 0));
        setRecordatorios(datos);
        setCargando(false);
      },
      (error) => {
        console.warn('Error al leer recordatorios:', error);
        setCargando(false);
      }
    );

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user || recordatorios.length === 0) return;

    recordatorios.forEach(async (item) => {
      const pendiente = !item.completado;
      const futuro = item.fecha && item.fecha.getTime() > Date.now();
      const sinNotificacion = !item.notificacionId;
      const clave = item.id;

      if (pendiente && futuro && sinNotificacion && !reconciliados.current.has(clave)) {
        reconciliados.current.add(clave);
        try {
          const notifId = await scheduleReminderNotification({
            titulo: item.titulo || 'Recordatorio',
            cuerpo: item.tipo === 'alarma' ? 'Alarma programada por NEXUS' : 'Recordatorio de NEXUS',
            fecha: item.fecha,
            tipo: item.tipo || 'recordatorio',
          });
          if (notifId) {
            await updateDoc(doc(db, COLECCION, item.id), { notificacionId: notifId });
          }
        } catch (error) {
          reconciliados.current.delete(clave);
          console.warn('No se pudo reagendar el recordatorio:', error);
        }
      }
    });
  }, [recordatorios, user]);

  const solicitarPermisos = async () => {
    const concedidos = await ensureNotificationPermissions();
    setPermisosConcedidos(concedidos);
    return concedidos;
  };

  const agregarRecordatorio = async ({ titulo, fecha, tipo = 'recordatorio' }) => {
    if (!user) throw new Error('Debes iniciar sesion.');
    const limpio = (titulo || '').trim();
    if (!limpio) throw new Error('El recordatorio necesita un titulo.');

    const fechaDate = fecha instanceof Date ? fecha : new Date(fecha);
    if (Number.isNaN(fechaDate.getTime())) {
      throw new Error('La fecha no es valida.');
    }

    const notificacionId = await scheduleReminderNotification({
      titulo: limpio,
      cuerpo: tipo === 'alarma' ? 'Alarma programada por NEXUS' : 'Recordatorio de NEXUS',
      fecha: fechaDate,
      tipo,
    });

    const referencia = await addDoc(collection(db, COLECCION), {
      uid: user.uid,
      titulo: limpio,
      tipo,
      fecha: Timestamp.fromDate(fechaDate),
      completado: false,
      notificacionId: notificacionId || null,
      creadoEn: serverTimestamp(),
    });

    return { id: referencia.id, notificacionId };
  };

  const eliminarRecordatorio = async (item) => {
    if (!item) return;
    await cancelReminderNotification(item.notificacionId);
    reconciliados.current.delete(item.id);
    await deleteDoc(doc(db, COLECCION, item.id));
  };

  const alternarCompletado = async (item) => {
    const nuevoEstado = !item.completado;
    if (nuevoEstado) {
      await cancelReminderNotification(item.notificacionId);
    }
    await updateDoc(doc(db, COLECCION, item.id), {
      completado: nuevoEstado,
      ...(nuevoEstado ? { notificacionId: null } : {}),
    });
  };

  const eliminarTodas = async () => {
    await Promise.all(
      recordatorios.map(async (item) => {
        await cancelReminderNotification(item.notificacionId);
        await deleteDoc(doc(db, COLECCION, item.id));
      })
    );
    reconciliados.current.clear();
  };

  const proximos = useMemo(
    () =>
      recordatorios.filter(
        (r) => !r.completado && r.fecha && r.fecha.getTime() > Date.now()
      ),
    [recordatorios]
  );

  const value = useMemo(
    () => ({
      recordatorios,
      proximos,
      cargando,
      permisosConcedidos,
      solicitarPermisos,
      agregarRecordatorio,
      eliminarRecordatorio,
      alternarCompletado,
      eliminarTodas,
    }),
    [recordatorios, proximos, cargando, permisosConcedidos]
  );

  return (
    <RemindersContext.Provider value={value}>
      {children}
    </RemindersContext.Provider>
  );
}
