// ---------------------------------------------------------------------------
// NEXUS · Reproductor de musica del dispositivo
//
// Usa expo-media-library para leer las canciones del telefono y expo-audio para
// reproducirlas dentro de NEXUS (con controles de pausa, siguiente, volumen...).
// En iOS el framework de fotos no expone audio, asi que se abre la app Musica.
// ---------------------------------------------------------------------------

import { Platform, Linking } from 'react-native';

import { modAudio, modMediaLibrary, modIntentLauncher } from './native';

let player = null;
let pistas = [];
let indice = -1;
let cargandoBiblioteca = null;

function errorConCodigo(mensaje, codigo) {
  const error = new Error(mensaje);
  error.codigo = codigo;
  return error;
}

function normalizarTexto(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function limpiarNombre(archivo) {
  return String(archivo || 'Pista')
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/[_]+/g, ' ')
    .trim();
}

async function asegurarPlayer() {
  const Audio = modAudio();
  if (!Audio) {
    throw new Error('El reproductor interno solo funciona en el celular.');
  }

  if (!player) {
    player = Audio.createAudioPlayer(null, { updateInterval: 500 });
    try {
      await Audio.setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });
    } catch (error) {
      // sin modo de audio igual se puede reproducir
    }
  }

  return player;
}

async function pedirPermisoMusica() {
  const MediaLibrary = modMediaLibrary();
  if (!MediaLibrary) {
    throw errorConCodigo(
      'La biblioteca de musica solo esta disponible en el celular.',
      'SIN_BIBLIOTECA'
    );
  }

  const permiso = await MediaLibrary.requestPermissionsAsync(false, ['audio']);
  if (permiso.status !== 'granted') {
    throw errorConCodigo(
      'Necesito permiso para leer tu musica. Activalo en los ajustes del telefono.',
      'SIN_PERMISO'
    );
  }
}

export async function cargarBiblioteca(forzar = false) {
  if (pistas.length > 0 && !forzar) return pistas;
  if (cargandoBiblioteca && !forzar) return cargandoBiblioteca;

  cargandoBiblioteca = (async () => {
    await pedirPermisoMusica();
    const MediaLibrary = modMediaLibrary();

    const metadatos = await new MediaLibrary.Query()
      .eq(MediaLibrary.AssetField.MEDIA_TYPE, MediaLibrary.MediaType.AUDIO)
      .limit(400)
      .exeForMetadata();

    const assets = await new MediaLibrary.Query()
      .eq(MediaLibrary.AssetField.MEDIA_TYPE, MediaLibrary.MediaType.AUDIO)
      .limit(400)
      .exe();

    const porId = new Map(assets.map((asset) => [asset.id, asset]));

    pistas = metadatos
      .map((meta) => ({
        id: meta.id,
        titulo: limpiarNombre(meta.filename),
        duracion: meta.duration || null,
        asset: porId.get(meta.id) || null,
        uri: null,
      }))
      .filter((pista) => pista.asset);

    return pistas;
  })();

  try {
    return await cargandoBiblioteca;
  } finally {
    cargandoBiblioteca = null;
  }
}

function buscarPista(consulta) {
  const buscado = normalizarTexto(consulta);
  if (!buscado) return null;

  let mejor = null;
  let mejorPuntaje = 0;

  pistas.forEach((pista) => {
    const titulo = normalizarTexto(pista.titulo);
    if (!titulo) return;

    let puntaje = 0;
    if (titulo === buscado) puntaje = 100;
    else if (titulo.startsWith(buscado)) puntaje = 80;
    else if (titulo.includes(buscado)) puntaje = 60;
    else {
      const palabras = buscado.split(' ').filter((p) => p.length > 2);
      const coincidencias = palabras.filter((p) => titulo.includes(p)).length;
      if (palabras.length > 0 && coincidencias === palabras.length) puntaje = 40;
    }

    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = pista;
    }
  });

  return mejor;
}

async function reproducirPista(pista) {
  if (!pista) throw new Error('No hay canciones disponibles.');

  if (!pista.uri) {
    try {
      pista.uri = await pista.asset.getUri();
    } catch (error) {
      throw new Error('No pude leer el archivo de esa cancion.');
    }
  }

  const reproductor = await asegurarPlayer();
  reproductor.replace({ uri: pista.uri });
  reproductor.play();

  try {
    reproductor.setActiveForLockScreen(true, {
      title: pista.titulo,
      artist: 'NEXUS',
    });
  } catch (error) {
    // los controles de pantalla bloqueada son opcionales
  }

  return pista;
}

export async function reproducir(consulta) {
  if (Platform.OS === 'ios') {
    const respaldo = await abrirReproductorDelSistema();
    if (respaldo.ok) {
      return {
        ok: true,
        mensaje: `${respaldo.mensaje} En iPhone la musica se controla desde esa app.`,
      };
    }
    throw errorConCodigo('No pude abrir tu app de Musica.', 'SIN_BIBLIOTECA');
  }

  await cargarBiblioteca();

  if (pistas.length === 0) {
    throw errorConCodigo('No encontre canciones en tu dispositivo.', 'SIN_BIBLIOTECA');
  }

  let pista;
  if (consulta) {
    pista = buscarPista(consulta);
    if (!pista) {
      throw errorConCodigo(`No encontre "${consulta}" en tu musica.`, 'NO_ENCONTRADA');
    }
  } else {
    pista = pistas[indice >= 0 ? indice : 0];
  }

  indice = Math.max(0, pistas.indexOf(pista));
  const activa = await reproducirPista(pista);

  return {
    ok: true,
    mensaje: `Reproduciendo "${activa.titulo}".`,
    datos: { titulo: activa.titulo },
  };
}

export async function pausar() {
  if (!player) return { ok: true, mensaje: 'No hay musica sonando.' };
  player.pause();
  return { ok: true, mensaje: 'Musica en pausa.' };
}

export async function reanudar() {
  if (!player) {
    return reproducir(null);
  }
  player.play();
  return { ok: true, mensaje: 'Continuando la musica.' };
}

export async function detener() {
  if (player) {
    player.pause();
    try {
      await player.seekTo(0);
    } catch (error) {
      // sin problema si no se puede reiniciar
    }
  }
  return { ok: true, mensaje: 'Musica detenida.' };
}

export async function siguiente() {
  if (Platform.OS === 'ios') {
    return {
      ok: false,
      mensaje: 'En iPhone cambia de cancion desde la app de Musica.',
    };
  }

  await cargarBiblioteca();
  if (pistas.length === 0) throw new Error('No hay canciones disponibles.');

  indice = (indice + 1) % pistas.length;
  const pista = await reproducirPista(pistas[indice]);
  return { ok: true, mensaje: `Siguiente: "${pista.titulo}".`, datos: { titulo: pista.titulo } };
}

export async function anterior() {
  if (Platform.OS === 'ios') {
    return {
      ok: false,
      mensaje: 'En iPhone cambia de cancion desde la app de Musica.',
    };
  }

  await cargarBiblioteca();
  if (pistas.length === 0) throw new Error('No hay canciones disponibles.');

  indice = (indice - 1 + pistas.length) % pistas.length;
  const pista = await reproducirPista(pistas[indice]);
  return { ok: true, mensaje: `Anterior: "${pista.titulo}".`, datos: { titulo: pista.titulo } };
}

export async function cambiarVolumen(nivel) {
  const reproductor = await asegurarPlayer();
  const valor = Math.min(1, Math.max(0, Number(nivel) / 100));
  reproductor.volume = valor;
  return { ok: true, mensaje: `Volumen al ${Math.round(valor * 100)}%.` };
}

export function estadoMusica() {
  if (!player) {
    return { ok: true, mensaje: 'No hay musica reproduciendose ahora mismo.' };
  }

  const pista = pistas[indice];
  const titulo = pista?.titulo || 'una cancion';
  const segundos = Math.round(player.currentTime || 0);

  return {
    ok: true,
    mensaje: player.playing
      ? `Suena "${titulo}" (${segundos}s). Volumen al ${Math.round((player.volume ?? 1) * 100)}%.`
      : `"${titulo}" esta en pausa.`,
  };
}

// Abre la app de musica del sistema cuando no podemos reproducir dentro de NEXUS.
export async function abrirReproductorDelSistema() {
  if (Platform.OS === 'ios') {
    try {
      await Linking.openURL('music://');
      return { ok: true, mensaje: 'Abri tu app de Musica.' };
    } catch (error) {
      return { ok: false, mensaje: 'No pude abrir la app de Musica en este dispositivo.' };
    }
  }

  if (Platform.OS === 'android') {
    const IntentLauncher = modIntentLauncher();

    if (IntentLauncher) {
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.MUSIC_PLAYER');
        return { ok: true, mensaje: 'Abri tu reproductor de musica.' };
      } catch (error) {
        // seguimos con el intent generico
      }

      try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          type: 'audio/*',
        });
        return { ok: true, mensaje: 'Abri tu reproductor de musica.' };
      } catch (error) {
        // sin reproductor disponible
      }
    }
  }

  return { ok: false, mensaje: 'No encontre un reproductor de musica en este dispositivo.' };
}

export function liberarMusica() {
  try {
    player?.remove();
  } catch (error) {
    // ignorado
  }
  player = null;
  indice = -1;
}
