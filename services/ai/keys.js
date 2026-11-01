// ---------------------------------------------------------------------------
// NEXUS · Claves de IA obtenidas automaticamente
//
// La app NO le pide claves al usuario. Al arrancar intenta traer un pequeno
// JSON con claves desde una URL configurada por el desarrollador (por ejemplo
// un Gist privado o un archivo en tu hosting). Si no hay URL, si no hay red o
// si el JSON no existe, NEXUS sigue funcionando con los proveedores gratuitos
// que no necesitan clave (LLM7 y Pollinations).
//
// Formato aceptado (cualquiera de estos):
//   { "gemini": "AIza...", "groq": "gsk_..." }
//   { "claves": { "gemini": "AIza..." } }
//   { "keys": { "gemini": "AIza..." } }
//   { "providers": { "gemini": { "key": "AIza..." } } }
//
// La URL se define en el build con EXPO_PUBLIC_AI_KEYS_URL.
// ---------------------------------------------------------------------------

import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE_ALMACEN = 'nexus.ai.claves.v1';
const VIGENCIA_MS = 6 * 60 * 60 * 1000; // 6 horas
const TIEMPO_LIMITE_MS = 12000;

let claves = {};
let actualizado = 0;
let cargando = null;
const oyentes = new Set();

function avisar() {
  const copia = clavesRemotas();
  oyentes.forEach((fn) => {
    try {
      fn(copia);
    } catch (error) {
      // un oyente roto no debe romper a los demas
    }
  });
}

function urlRemota() {
  const url = process.env.EXPO_PUBLIC_AI_KEYS_URL;
  return typeof url === 'string' ? url.trim() : '';
}

function normalizarClaves(bruto) {
  if (!bruto || typeof bruto !== 'object') return {};

  const fuente =
    bruto.claves || bruto.keys || bruto.providers || bruto.proveedores || bruto;

  const salida = {};

  Object.keys(fuente).forEach((id) => {
    const valor = fuente[id];

    if (typeof valor === 'string' && valor.trim()) {
      salida[id] = valor.trim();
      return;
    }

    if (valor && typeof valor === 'object') {
      const clave = valor.clave || valor.key || valor.apiKey || valor.token;
      if (typeof clave === 'string' && clave.trim()) salida[id] = clave.trim();
    }
  });

  return salida;
}

async function leerCache() {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_ALMACEN);
    if (!crudo) return null;
    const datos = JSON.parse(crudo);
    return {
      claves: normalizarClaves(datos?.claves),
      actualizado: Number(datos?.actualizado) || 0,
    };
  } catch (error) {
    return null;
  }
}

async function guardarCache() {
  try {
    await AsyncStorage.setItem(
      CLAVE_ALMACEN,
      JSON.stringify({ claves, actualizado })
    );
  } catch (error) {
    // sin cache igual funciona
  }
}

export function clavesRemotas() {
  return { ...claves };
}

export function hayClavesRemotas() {
  return Object.keys(claves).length > 0;
}

export function antiguedadClaves() {
  return actualizado ? Date.now() - actualizado : null;
}

export function suscribirClaves(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

// Descarga (o lee del cache) las claves. Nunca lanza: si algo falla, devuelve
// lo que ya tuviera.
export async function cargarClavesRemotas({ forzar = false } = {}) {
  if (!forzar && Object.keys(claves).length > 0 && Date.now() - actualizado < VIGENCIA_MS) {
    return clavesRemotas();
  }

  if (cargando) return cargando;

  cargando = (async () => {
    // 1. Cache local (sirve incluso vencido si despues falla la red).
    if (!actualizado) {
      const cache = await leerCache();
      if (cache?.claves && Object.keys(cache.claves).length > 0) {
        claves = cache.claves;
        actualizado = cache.actualizado || Date.now();
        avisar();
      }
    }

    const url = urlRemota();

    if (!url) {
      if (forzar && Object.keys(claves).length === 0) {
        // Sin URL configurada no hay nada que descargar: se usan los
        // proveedores sin clave.
        return clavesRemotas();
      }
      return clavesRemotas();
    }

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIEMPO_LIMITE_MS);

    try {
      const respuesta = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controlador.signal,
      });

      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

      const datos = await respuesta.json();
      const nuevas = normalizarClaves(datos);

      if (Object.keys(nuevas).length > 0) {
        claves = { ...claves, ...nuevas };
        actualizado = Date.now();
        await guardarCache();
        avisar();
      }
    } catch (error) {
      console.warn('NEXUS: no se pudieron actualizar las claves de IA.', error?.message);
    } finally {
      clearTimeout(temporizador);
    }

    return clavesRemotas();
  })();

  try {
    return await cargando;
  } finally {
    cargando = null;
  }
}
