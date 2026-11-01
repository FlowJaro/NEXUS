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

/**
 * Escucha activa continua dentro de la app para responder cada vez que el usuario diga "NEXUS".
 * Si dice "Nexus, qué hora es", ejecuta la orden de inmediato.
 * Si solo dice "Nexus", responde "Dime, te escucho" y queda a la espera de la instrucción.
 */
export async function iniciarEscuchaContinuaNexus({
  lang = 'es-ES',
  onPalabraClave,
  onComando,
  onError,
  onEstado,
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

  let activo = true;
  let suscripciones = [];
  let ultimoProcesado = '';
  let tiempoReinicio = null;

  const limpiar = () => {
    suscripciones.forEach((s) => {
      try {
        s.remove();
      } catch (_) {}
    });
    suscripciones = [];
  };

  const arrancar = () => {
    if (!activo) return;
    limpiar();

    suscripciones.push(
      addSpeechRecognitionListener('start', () => {
        if (onEstado) onEstado('escuchando');
      })
    );

    suscripciones.push(
      addSpeechRecognitionListener('result', (event) => {
        if (!activo) return;
        const texto = event?.results?.[0]?.transcript ?? '';
        if (!texto) return;

        // Comprueba si contiene la palabra clave 'Nexus'
        const regex = /(?:oye\s+nexus|hola\s+nexus|ok\s+nexus|nexus)[,\s:]*(.*)/i;
        const coincidencia = texto.match(regex);

        if (coincidencia) {
          const comando = coincidencia[1]?.trim() || '';

          if (event?.isFinal) {
            if (texto !== ultimoProcesado) {
              ultimoProcesado = texto;
              if (comando.length > 1) {
                if (onComando) onComando(comando);
              } else {
                if (onPalabraClave) onPalabraClave();
              }
            }
          }
        }
      })
    );

    suscripciones.push(
      addSpeechRecognitionListener('error', (event) => {
        if (!activo) return;
        // Si hay error temporal de silencio, intentamos reconectar tras un breve lapso
        if (event?.error !== 'speech-recognizer-busy') {
          tiempoReinicio = setTimeout(() => {
            if (activo) arrancar();
          }, 800);
        }
      })
    );

    suscripciones.push(
      addSpeechRecognitionListener('end', () => {
        if (activo) {
          tiempoReinicio = setTimeout(() => {
            if (activo) arrancar();
          }, 400);
        }
      })
    );

    try {
      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: true,
        continuous: true,
        contextualStrings: ['Nexus', 'nexus', 'Oye Nexus'],
      });
    } catch (error) {
      if (activo) {
        tiempoReinicio = setTimeout(() => {
          if (activo) arrancar();
        }, 1200);
      }
    }
  };

  arrancar();

  return {
    detener: () => {
      activo = false;
      if (tiempoReinicio) clearTimeout(tiempoReinicio);
      limpiar();
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (_) {}
      if (onEstado) onEstado('detenido');
    },
  };
}
