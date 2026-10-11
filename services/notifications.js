import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const RECORDATORIO_CHANNEL = 'nexus-recordatorios';
export const ALARMA_CHANNEL = 'nexus-alarmas';

const isWeb = Platform.OS === 'web';

// En Expo Go (SDK 53+) las push notifications remotas fueron eliminadas.
// El simple hecho de importar expo-notifications ya dispara el crash.
// Usamos require() dinámico para que el módulo NO se cargue en Expo Go.
const isExpoGo = Constants.executionEnvironment === 'storeClient';

let Notifications = null;
if (!isWeb && !isExpoGo) {
  Notifications = require('expo-notifications');
}

export const notificationsSupported = !isWeb && !isExpoGo;

// ---------------------------------------------------------------------------

export function configureNotifications() {
  if (!notificationsSupported) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function setupNotificationChannels() {
  if (!notificationsSupported) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(RECORDATORIO_CHANNEL, {
      name: 'Recordatorios NEXUS',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#b75cff',
    });

    await Notifications.setNotificationChannelAsync(ALARMA_CHANNEL, {
      name: 'Alarmas NEXUS',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      lightColor: '#b75cff',
      sound: 'alarm_beep',
      bypassDnd: true,
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}

export async function ensureNotificationPermissions() {
  if (!notificationsSupported) return false;

  if (Platform.OS === 'android') {
    await setupNotificationChannels();
  }

  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;

  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    granted = requested.granted;
    if (
      !granted &&
      requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    ) {
      granted = true;
    }
  }

  return granted;
}

export async function scheduleReminderNotification({
  titulo,
  cuerpo,
  fecha,
  tipo = 'recordatorio',
}) {
  if (!notificationsSupported) return null;

  const date = fecha instanceof Date ? fecha : new Date(fecha);

  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    return null;
  }

  const esAlarma = tipo === 'alarma';

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: esAlarma ? `⏰ ${titulo}` : `🔔 ${titulo}`,
      body: cuerpo || (esAlarma ? 'Tu alarma esta sonando' : 'Tienes un recordatorio'),
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { tipo, fecha: date.toISOString() },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: esAlarma ? ALARMA_CHANNEL : RECORDATORIO_CHANNEL,
    },
  });

  return notificationId;
}

export async function cancelReminderNotification(notificationId) {
  if (!notificationsSupported || !notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.warn('No se pudo cancelar la notificacion:', error);
  }
}

export async function presentLocalNotification({ titulo, cuerpo, tipo = 'recordatorio' }) {
  if (!notificationsSupported) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: tipo === 'alarma' ? `⏰ ${titulo}` : `🔔 ${titulo}`,
      body: cuerpo,
      sound: 'default',
      data: { tipo },
    },
    trigger: null,
  });
}

export function addReceivedListener(callback) {
  if (!notificationsSupported) return { remove() {} };
  return Notifications.addNotificationReceivedListener(callback);
}

export function dismissNotification(identifier) {
  if (!notificationsSupported || !identifier) return undefined;
  try {
    return Notifications.dismissNotificationAsync(identifier);
  } catch (error) {
    return undefined;
  }
}
