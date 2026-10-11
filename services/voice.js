import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

let moduloVoz;
let intentoCarga = false;

function cargarModuloVoz() {
  if (intentoCarga) return moduloVoz;
  intentoCarga = true;

  if (Platform.OS === 'web') {
    moduloVoz = null;
    return null;
  }

  try {
    // eslint-disable-next-line global-require
    moduloVoz = require('expo-speech-recognition');
  } catch (error) {
    moduloVoz = null;
  }

  return moduloVoz;
}

export function vozDisponible() {
  return cargarModuloVoz() != null;
}

export function hablar(texto, opciones = {}) {
  if (!texto) return;
  try {
    Speech.stop();
    Speech.speak(String(texto), {
      language: 'es-ES',
      pitch: 1,
      rate: 1,
      ...opciones,
    });
  } catch (error) {
    console.warn('No se pudo reproducir la voz:', error);
  }
}

export function detenerVoz() {
  try {
    Speech.stop();
  } catch (error) {
    // sin accion
  }
}

export async function pedirPermisoMicrofono() {
  const mod = cargarModuloVoz();
  if (!mod) return false;
  try {
    const resultado = await mod.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return Boolean(resultado && resultado.granted);
  } catch (error) {
    return false;
  }
}

export async function escucharUnaOrden({
  lang = 'es-ES',
  onResultado,
  onFinal,
  onError,
} = {}) {
  const mod = cargarModuloVoz();

  if (!mod) {
    if (onError) onError('VOZ_NO_DISPONIBLE');
    return null;
  }

  const { ExpoSpeechRecognitionModule } = mod;

  const addSpeechRecognitionListener = (nombre, manejador) => {
    if (
      ExpoSpeechRecognitionModule &&
      typeof ExpoSpeechRecognitionModule.addListener === 'function'
    ) {
      return ExpoSpeechRecognitionModule.addListener(nombre, manejador);
    }
    return { remove() {} };
  };

  const permiso = await pedirPermisoMicrofono();
  if (!permiso) {
    if (onError) onError('PERMISO_DENEGADO');
    return null;
  }

  let suscripciones = [];

  const limpiar = () => {
    suscripciones.forEach((s) => {
      try {
        s.remove();
      } catch (error) {
        // sin accion
      }
    });
    suscripciones = [];
  };

  suscripciones.push(
    addSpeechRecognitionListener('result', (event) => {
      const texto = event?.results?.[0]?.transcript ?? '';
      if (event?.isFinal) {
        if (onFinal) onFinal(texto);
      } else if (onResultado) {
        onResultado(texto);
      }
    })
  );

  suscripciones.push(
    addSpeechRecognitionListener('error', (event) => {
      if (onError) onError(event?.error || 'ERROR_VOZ');
      limpiar();
    })
  );

  suscripciones.push(
    addSpeechRecognitionListener('end', () => {
      limpiar();
    })
  );

  try {
    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
    });
  } catch (error) {
    if (onError) onError('ERROR_INICIAR');
    limpiar();
    return null;
  }

  return {
    detener: () => {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (error) {
        // sin accion
      }
    },
    abortar: () => {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch (error) {
        // sin accion
      }
      limpiar();
    },
  };
}
