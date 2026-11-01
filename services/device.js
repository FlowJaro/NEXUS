// ---------------------------------------------------------------------------
// NEXUS · Acciones del dispositivo
//
// Aqui viven las funciones que tocan el telefono: llamadas, SMS, WhatsApp,
// mapas, portapapeles, bateria, brillo, camara, clima, etc. Todo esta envuelto
// en try/catch y devuelve { ok, mensaje } para que la IA pueda contarlo.
// ---------------------------------------------------------------------------

import { Platform, Linking, Share, Vibration } from 'react-native';
import * as Battery from 'expo-battery';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

import {
  modBrightness,
  modContacts,
  modImagePicker,
  modIntentLauncher,
  modLocation,
  esMovil,
} from './native';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

export function normalizarTexto(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function soloDigitos(valor) {
  return String(valor || '').replace(/[^\d]/g, '');
}

function normalizarTelefono(valor) {
  const limpio = String(valor || '').replace(/[^\d+]/g, '');
  return limpio.startsWith('+') ? `+${soloDigitos(limpio)}` : soloDigitos(limpio);
}

function asegurarUrl(valor) {
  const texto = String(valor || '').trim();
  if (!texto) throw new Error('Necesito una direccion web.');
  if (/^[a-z][a-z0-9+.-]*:/i.test(texto)) return texto;
  return `https://${texto}`;
}

async function abrir(url) {
  try {
    await Linking.openURL(url);
    return true;
  } catch (error) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Contactos
// ---------------------------------------------------------------------------

export async function buscarContactos(nombre, limite = 5) {
  const Contacts = modContacts();
  if (!Contacts) {
    throw new Error('Los contactos solo estan disponibles en el celular.');
  }

  const permiso = await Contacts.requestPermissionsAsync();
  if (permiso.status !== 'granted') {
    throw new Error('Necesito permiso para leer tus contactos.');
  }

  const campos = [Contacts.ContactField.FULL_NAME, Contacts.ContactField.PHONES];
  const lista = await Contacts.Contact.getAllDetails(campos, { limit: 800 });
  const buscado = normalizarTexto(nombre);

  if (!buscado) {
    return lista
      .slice(0, limite)
      .map((contacto) => ({
        nombre: contacto.fullName || 'Sin nombre',
        numero: normalizarTelefono(contacto.phones?.[0]?.number),
      }))
      .filter((contacto) => contacto.numero);
  }

  const puntuados = [];

  lista.forEach((contacto) => {
    const completo = normalizarTexto(contacto.fullName);
    const numero = normalizarTelefono(contacto.phones?.[0]?.number);
    if (!completo || !numero) return;

    let puntaje = 0;
    if (completo === buscado) puntaje = 100;
    else if (completo.startsWith(buscado)) puntaje = 85;
    else if (completo.includes(buscado)) puntaje = 65;
    else {
      const palabras = buscado.split(' ').filter((p) => p.length > 1);
      const partes = completo.split(' ');
      const coincide = palabras.every((p) => partes.some((parte) => parte.startsWith(p)));
      if (coincide) puntaje = 50;
    }

    if (puntaje > 0) {
      puntuados.push({ puntaje, nombre: contacto.fullName || 'Sin nombre', numero });
    }
  });

  puntuados.sort((a, b) => b.puntaje - a.puntaje);

  return puntuados.slice(0, limite).map(({ nombre: n, numero }) => ({
    nombre: n,
    numero,
  }));
}

async function resolverDestino({ contacto, numero }) {
  if (numero) {
    const limpio = normalizarTelefono(numero);
    if (limpio.length >= 5) return { numero: limpio, nombre: limpio };
  }

  if (!contacto) {
    throw new Error('Dime a quien quieres contactar.');
  }

  const encontrados = await buscarContactos(contacto, 1);
  if (encontrados.length === 0) {
    throw new Error(`No encontre un contacto llamado "${contacto}".`);
  }

  return encontrados[0];
}

export async function llamar({ contacto, numero }) {
  const destino = await resolverDestino({ contacto, numero });
  const abierto = await abrir(`tel:${destino.numero}`);

  if (!abierto) {
    throw new Error('Este dispositivo no puede hacer llamadas.');
  }

  return { ok: true, mensaje: `Llamando a ${destino.nombre} (${destino.numero})...` };
}

export async function enviarSms({ contacto, numero, mensaje }) {
  const destino = await resolverDestino({ contacto, numero });
  const cuerpo = String(mensaje || '').trim();
  const separador = Platform.OS === 'ios' ? '&' : '?';
  const url = cuerpo
    ? `sms:${destino.numero}${separador}body=${encodeURIComponent(cuerpo)}`
    : `sms:${destino.numero}`;

  const abierto = await abrir(url);
  if (!abierto) throw new Error('Este dispositivo no puede abrir la app de mensajes.');

  return {
    ok: true,
    mensaje: `Abri Mensajes para escribirle a ${destino.nombre}.`,
  };
}

export async function enviarWhatsApp({ contacto, numero, mensaje }) {
  const destino = await resolverDestino({ contacto, numero });
  const texto = String(mensaje || '').trim();
  const url = `https://wa.me/${soloDigitos(destino.numero)}${
    texto ? `?text=${encodeURIComponent(texto)}` : ''
  }`;

  const abierto = await abrir(url);
  if (!abierto) throw new Error('No pude abrir WhatsApp. Verifica que este instalado.');

  return { ok: true, mensaje: `Abri WhatsApp para escribirle a ${destino.nombre}.` };
}

export async function enviarEmail({ destino, asunto, cuerpo }) {
  const para = String(destino || '').trim();
  if (!para) throw new Error('Dime a que correo quieres escribir.');

  const partes = [];
  if (asunto) partes.push(`subject=${encodeURIComponent(asunto)}`);
  if (cuerpo) partes.push(`body=${encodeURIComponent(cuerpo)}`);
  const url = `mailto:${para}${partes.length ? `?${partes.join('&')}` : ''}`;

  const abierto = await abrir(url);
  if (!abierto) throw new Error('No pude abrir la app de correo.');

  return { ok: true, mensaje: `Abri tu correo para escribir a ${para}.` };
}

// ---------------------------------------------------------------------------
// Apps, mapas y web
// ---------------------------------------------------------------------------

const APPS_CONOCIDAS = {
  whatsapp: { url: 'whatsapp://', paquete: 'com.whatsapp', nombre: 'WhatsApp' },
  instagram: { url: 'instagram://app', paquete: 'com.instagram.android', nombre: 'Instagram' },
  facebook: { url: 'fb://', paquete: 'com.facebook.katana', nombre: 'Facebook' },
  youtube: { url: 'youtube://', paquete: 'com.google.android.youtube', nombre: 'YouTube' },
  tiktok: { url: 'snssdk1128://', paquete: 'com.zhiliaoapp.musically', nombre: 'TikTok' },
  spotify: { url: 'spotify://', paquete: 'com.spotify.music', nombre: 'Spotify' },
  telegram: { url: 'tg://', paquete: 'org.telegram.messenger', nombre: 'Telegram' },
  gmail: { url: 'googlegmail://', paquete: 'com.google.android.gm', nombre: 'Gmail' },
  maps: { url: 'https://maps.google.com', paquete: 'com.google.android.apps.maps', nombre: 'Google Maps' },
  camara: { url: 'camera://', paquete: 'com.android.camera', nombre: 'Camara' },
  galeria: { url: 'content://media/internal/images/media', paquete: 'com.google.android.apps.photos', nombre: 'Galeria' },
};

export async function abrirApp({ app }) {
  const clave = normalizarTexto(app);
  if (!clave) throw new Error('Dime que aplicacion quieres abrir.');

  const entrada =
    APPS_CONOCIDAS[clave] ||
    Object.values(APPS_CONOCIDAS).find((item) => normalizarTexto(item.nombre) === clave);

  if (!entrada) {
    const lista = Object.values(APPS_CONOCIDAS)
      .map((item) => item.nombre)
      .join(', ');
    throw new Error(`No conozco esa app. Puedo abrir: ${lista}.`);
  }

  if (await abrir(entrada.url)) {
    return { ok: true, mensaje: `Abri ${entrada.nombre}.` };
  }

  if (Platform.OS === 'android') {
    const IntentLauncher = modIntentLauncher();
    if (IntentLauncher) {
      try {
        await IntentLauncher.openApplication(entrada.paquete);
        return { ok: true, mensaje: `Abri ${entrada.nombre}.` };
      } catch (error) {
        // seguimos
      }
    }
  }

  throw new Error(`No pude abrir ${entrada.nombre}. Puede que no este instalada.`);
}

export async function abrirUrl({ url }) {
  const destino = asegurarUrl(url);
  if (!(await abrir(destino))) throw new Error('No pude abrir ese enlace.');
  return { ok: true, mensaje: `Abri el enlace en tu navegador.` };
}

export async function buscarWeb({ consulta }) {
  const texto = String(consulta || '').trim();
  if (!texto) throw new Error('Dime que quieres buscar.');

  const url = `https://www.google.com/search?q=${encodeURIComponent(texto)}`;
  if (!(await abrir(url))) throw new Error('No pude abrir el navegador.');

  return { ok: true, mensaje: `Busque "${texto}" en Google.` };
}

export async function abrirMapa({ destino, modo }) {
  const lugar = String(destino || '').trim();
  if (!lugar) throw new Error('Dime a donde quieres ir.');

  const viaje = normalizarTexto(modo);
  let url;

  if (viaje === 'a pie' || viaje === 'caminando' || viaje === 'walking') {
    url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      lugar
    )}&travelmode=walking`;
  } else if (viaje === 'transporte' || viaje === 'bus' || viaje === 'metro') {
    url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      lugar
    )}&travelmode=transit`;
  } else {
    url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      lugar
    )}&travelmode=driving`;
  }

  if (!(await abrir(url))) throw new Error('No pude abrir el mapa.');

  return { ok: true, mensaje: `Abri la ruta hacia ${lugar}.` };
}

// ---------------------------------------------------------------------------
// Clima (Open-Meteo, gratis y sin clave)
// ---------------------------------------------------------------------------

const CLIMA_CODIGOS = {
  0: 'cielo despejado',
  1: 'mayormente despejado',
  2: 'parcialmente nublado',
  3: 'nublado',
  45: 'niebla',
  48: 'niebla con escarcha',
  51: 'llovizna ligera',
  53: 'llovizna moderada',
  55: 'llovizna intensa',
  56: 'llovizna helada',
  57: 'llovizna helada intensa',
  61: 'lluvia ligera',
  63: 'lluvia moderada',
  65: 'lluvia fuerte',
  66: 'lluvia helada',
  67: 'lluvia helada fuerte',
  71: 'nieve ligera',
  73: 'nieve moderada',
  75: 'nieve fuerte',
  77: 'granos de nieve',
  80: 'chubascos ligeros',
  81: 'chubascos moderados',
  82: 'chubascos fuertes',
  85: 'chubascos de nieve',
  86: 'chubascos de nieve fuertes',
  95: 'tormenta electrica',
  96: 'tormenta con granizo',
  99: 'tormenta fuerte con granizo',
};

async function ubicacionActual() {
  const Location = modLocation();
  if (!Location) return null;

  try {
    const permiso = await Location.requestForegroundPermissionsAsync();
    if (permiso.status !== 'granted') return null;

    const posicion = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy?.Balanced ?? 3,
    });

    const { latitude, longitude } = posicion.coords;
    let ciudad = null;

    try {
      const respuesta = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=es`
      );
      if (respuesta.ok) {
        const datos = await respuesta.json();
        ciudad = datos.city || datos.locality || datos.principalSubdivision || null;
      }
    } catch (error) {
      // si falla el nombre seguimos con las coordenadas
    }

    return { latitude, longitude, ciudad };
  } catch (error) {
    return null;
  }
}

export async function consultarClima({ ciudad }) {
  let lugar = String(ciudad || '').trim();
  let coordenadas = null;

  if (lugar) {
    const respuesta = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        lugar
      )}&count=1&language=es&format=json`
    );

    if (!respuesta.ok) throw new Error('No pude buscar esa ciudad.');
    const datos = await respuesta.json();
    const encontrada = datos?.results?.[0];

    if (!encontrada) throw new Error(`No encontre la ciudad "${lugar}".`);

    lugar = encontrada.name;
    coordenadas = {
      latitude: encontrada.latitude,
      longitude: encontrada.longitude,
    };
  } else {
    coordenadas = await ubicacionActual();
    if (!coordenadas) {
      throw new Error('Dime una ciudad para consultar el clima.');
    }
    lugar = coordenadas.ciudad || 'tu ubicacion';
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${coordenadas.latitude}` +
    `&longitude=${coordenadas.longitude}` +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=auto&forecast_days=1';

  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error('El servicio del clima no respondio.');

  const datos = await respuesta.json();
  const actual = datos?.current;
  if (!actual) throw new Error('No recibi datos del clima.');

  const descripcion = CLIMA_CODIGOS[actual.weather_code] || 'condiciones variables';
  const maxima = datos?.daily?.temperature_2m_max?.[0];
  const minima = datos?.daily?.temperature_2m_min?.[0];
  const lluvia = datos?.daily?.precipitation_probability_max?.[0];

  const partes = [
    `En ${lugar} hay ${Math.round(actual.temperature_2m)} °C con ${descripcion}.`,
    `Sensacion de ${Math.round(actual.apparent_temperature)} °C, humedad ${actual.relative_humidity_2m}% y viento de ${Math.round(
      actual.wind_speed_10m
    )} km/h.`,
  ];

  if (Number.isFinite(maxima) && Number.isFinite(minima)) {
    partes.push(`Hoy: maxima ${Math.round(maxima)} °C y minima ${Math.round(minima)} °C.`);
  }
  if (Number.isFinite(lluvia)) {
    partes.push(`Probabilidad de lluvia: ${lluvia}%.`);
  }

  return { ok: true, mensaje: partes.join(' '), datos: { ciudad: lugar } };
}

// ---------------------------------------------------------------------------
// Portapapeles, bateria y sistema
// ---------------------------------------------------------------------------

export async function copiarTexto({ texto }) {
  const contenido = String(texto || '').trim();
  if (!contenido) throw new Error('No hay nada que copiar.');

  await Clipboard.setStringAsync(contenido);
  return { ok: true, mensaje: 'Copie el texto al portapapeles.' };
}

export async function leerPortapapeles() {
  const contenido = await Clipboard.getStringAsync();
  if (!contenido) return { ok: true, mensaje: 'El portapapeles esta vacio.' };

  return { ok: true, mensaje: `En el portapapeles tienes: ${contenido}` };
}

export async function estadoBateria() {
  const nivel = await Battery.getBatteryLevelAsync();
  const estado = await Battery.getBatteryStateAsync();

  if (!Number.isFinite(nivel) || nivel < 0) {
    return { ok: true, mensaje: 'No pude leer el nivel de bateria en este dispositivo.' };
  }

  const porcentaje = Math.round(nivel * 100);
  const estados = {
    [Battery.BatteryState.CHARGING]: 'y se esta cargando',
    [Battery.BatteryState.FULL]: 'y esta al 100%',
    [Battery.BatteryState.UNPLUGGED]: 'y esta descargandose',
  };
  const detalle = estados[estado] || '';

  return { ok: true, mensaje: `La bateria esta al ${porcentaje}% ${detalle}.`.trim() };
}

export async function infoDispositivo() {
  const partes = [];
  const modelo = Device.modelName || Device.deviceName;
  if (modelo) partes.push(modelo);
  if (Device.osName) partes.push(`${Device.osName} ${Device.osVersion || ''}`.trim());

  if (Device.totalMemory) {
    partes.push(`${Math.round(Device.totalMemory / 1024 ** 3)} GB de RAM`);
  }

  const version = Constants.expoConfig?.version;
  if (version) partes.push(`NEXUS ${version}`);

  return {
    ok: true,
    mensaje: partes.length
      ? `Estas usando ${partes.join(' · ')}.`
      : 'No pude leer la informacion del dispositivo.',
  };
}

export async function ajustarBrillo({ nivel }) {
  const Brightness = modBrightness();
  if (!Brightness) throw new Error('El brillo solo se puede cambiar en el celular.');

  let valor = Number(nivel);
  if (!Number.isFinite(valor)) throw new Error('Dime un nivel de brillo entre 0 y 100.');

  valor = Math.min(100, Math.max(0, valor));
  await Brightness.setBrightnessAsync(valor / 100);

  return { ok: true, mensaje: `Brillo ajustado al ${Math.round(valor)}%.` };
}

export function vibrar({ duracion }) {
  const ms = Number(duracion);
  const tiempo = Number.isFinite(ms) && ms > 0 ? Math.min(3000, ms) : 400;
  Vibration.vibrate(tiempo);
  return { ok: true, mensaje: 'Vibre el telefono.' };
}

export async function compartir({ texto, url }) {
  const mensaje = String(texto || '').trim();
  if (!mensaje && !url) throw new Error('Dime que quieres compartir.');

  await Share.share({
    message: mensaje || String(url),
    ...(url ? { url: String(url) } : {}),
  });

  return { ok: true, mensaje: 'Abri el menu para compartir.' };
}

export async function abrirAjustes() {
  if (Platform.OS === 'android') {
    const IntentLauncher = modIntentLauncher();
    if (IntentLauncher) {
      try {
        await IntentLauncher.startActivityAsync('android.settings.SETTINGS');
        return { ok: true, mensaje: 'Abri los ajustes del telefono.' };
      } catch (error) {
        // seguimos
      }
    }
  }

  if (await abrir('app-settings:')) {
    return { ok: true, mensaje: 'Abri los ajustes de NEXUS.' };
  }

  throw new Error('No pude abrir los ajustes.');
}

export async function tomarFoto() {
  const ImagePicker = modImagePicker();
  if (!ImagePicker) throw new Error('La camara solo esta disponible en el celular.');

  const permiso = await ImagePicker.requestCameraPermissionsAsync();
  if (!permiso.granted) {
    throw new Error('Necesito permiso para usar la camara.');
  }

  const resultado = await ImagePicker.launchCameraAsync({
    quality: 0.7,
    allowsEditing: false,
  });

  if (resultado.canceled || !resultado.assets?.length) {
    return { ok: true, mensaje: 'Cancelaste la foto.' };
  }

  return {
    ok: true,
    mensaje: 'Tome la foto y la guarde en la galeria del telefono.',
    datos: { uri: resultado.assets[0].uri },
  };
}

export function accionesDisponibles() {
  return esMovil();
}
