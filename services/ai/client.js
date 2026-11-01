// ---------------------------------------------------------------------------
// NEXUS · Cliente de IA (OpenAI compatible)
//
// Un solo cliente para todos los proveedores. La app nunca pide claves: usa la
// clave fija de los servicios gratuitos, las claves automaticas que llegan en
// segundo plano o las del build. Si un proveedor falla o esta limitado, pasa
// al siguiente sin que el usuario note nada.
// ---------------------------------------------------------------------------

import { ORDEN_AUTO, PROVEEDORES } from './config';
import { claveDeProveedor } from './settings';

const TIEMPO_POR_DEFECTO_MS = 30000;
const TIEMPOS = {
  gemini: 25000,
  puter: 25000,
  llm7: 20000,
  pollinations: 35000,
  groq: 20000,
  openrouter: 25000,
};

const MAX_ESPERA_REINTENTO_MS = 2500;
const ENFRIAMIENTO_MAX_MS = 60000;

// Recuerda cuando un proveedor pidio esperar, para no insistir de inmediato.
const enfriamiento = new Map();

export class ErrorIA extends Error {
  constructor(mensaje, intentos = []) {
    super(mensaje);
    this.name = 'ErrorIA';
    this.intentos = intentos;
  }
}

function esperaRestante(id) {
  const hasta = enfriamiento.get(id);
  if (!hasta) return 0;
  return Math.max(0, hasta - Date.now());
}

function enfriar(id, ms) {
  const tiempo = Math.min(ENFRIAMIENTO_MAX_MS, Math.max(500, Number(ms) || 0));
  enfriamiento.set(id, Date.now() + tiempo);
}

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function modelosPara(id, ajustes) {
  const proveedor = PROVEEDORES[id];
  if (!proveedor) return [];

  const elegido = ajustes?.modelos?.[id];
  if (elegido) return [elegido];

  const lista = [proveedor.modeloPorDefecto, ...(proveedor.modelos || [])].filter(Boolean);
  return Array.from(new Set(lista)).slice(0, 3);
}

function esErrorDeModelo(error) {
  const mensaje = String(error?.message || '').toLowerCase();

  if (error?.status === 404) return true;
  if (error?.status === 400 && mensaje.includes('model')) return true;

  return (
    mensaje.includes('unknown model') ||
    mensaje.includes('model not found') ||
    mensaje.includes('model_not_found') ||
    mensaje.includes('model_unavailable') ||
    mensaje.includes('currently unavailable') ||
    mensaje.includes('does not exist') ||
    mensaje.includes('not supported for generatecontent') ||
    mensaje.includes('is not found') ||
    mensaje.includes('no longer available') ||
    mensaje.includes('decommissioned')
  );
}

function esLimiteDeVelocidad(error) {
  if (error?.status === 429) return true;
  if (error?.status === 402) return true;
  if (error?.status === 503) return false;

  const mensaje = String(error?.message || '').toLowerCase();
  return (
    mensaje.includes('rate limit') ||
    mensaje.includes('free limit') ||
    mensaje.includes('too many requests') ||
    mensaje.includes('retry after')
  );
}

function segundosDeEspera(error, respuesta) {
  const cabecera = respuesta?.headers?.get?.('retry-after');
  const deCabecera = Number(cabecera);
  if (Number.isFinite(deCabecera) && deCabecera > 0) return deCabecera;

  if (Number.isFinite(error?.retryAfter) && error.retryAfter > 0) return error.retryAfter;

  const mensaje = String(error?.message || '');
  const coincidencia = mensaje.match(/retry(?:\s+in)?\s+(?:after\s+)?(\d+(?:\.\d+)?)\s*(s|sec|seconds|segundos)?/i);
  if (coincidencia) {
    const valor = Number(coincidencia[1]);
    if (Number.isFinite(valor) && valor > 0) return valor;
  }

  return null;
}

function cabecerasExtra(id, clave) {
  const base = { 'Content-Type': 'application/json', Accept: 'application/json' };

  if (!clave || (id === 'puter' && clave === 'puter-free')) return base;

  const cabeceras = { ...base, Authorization: `Bearer ${clave}` };

  if (id === 'openrouter') {
    cabeceras['HTTP-Referer'] = 'https://nexus.app';
    cabeceras['X-Title'] = 'NEXUS';
  }

  return cabeceras;
}

async function peticion({ id, url, clave, modelo, mensajes, temperatura }) {
  const controlador = new AbortController();
  const limite = TIEMPOS[id] || TIEMPO_POR_DEFECTO_MS;
  const temporizador = setTimeout(() => controlador.abort(), limite);

  try {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: cabecerasExtra(id, clave),
      body: JSON.stringify({
        model: modelo,
        messages: mensajes,
        temperature: Number.isFinite(temperatura) ? temperatura : 0.6,
        max_tokens: 700,
        stream: false,
      }),
      signal: controlador.signal,
    });

    const crudo = await respuesta.text();

    let datos = null;
    try {
      datos = JSON.parse(crudo);
    } catch (error) {
      datos = null;
    }

    if (!respuesta.ok) {
      const detalle =
        datos?.error?.message ||
        datos?.message ||
        (crudo ? crudo.slice(0, 240) : `HTTP ${respuesta.status}`);

      const error = new Error(detalle);
      error.status = respuesta.status;
      error.retryAfter = segundosDeEspera(error, respuesta);
      throw error;
    }

    let contenido = datos?.choices?.[0]?.message?.content ?? datos?.choices?.[0]?.text;

    if (Array.isArray(contenido)) {
      contenido = contenido.map((parte) => parte?.text || '').join('');
    }

    if (!contenido || !String(contenido).trim()) {
      throw new Error('El proveedor devolvio una respuesta vacia.');
    }

    return String(contenido);
  } catch (error) {
    if (error?.name === 'AbortError') {
      const tiempoAgotado = new Error('El proveedor tardo demasiado en responder.');
      tiempoAgotado.status = 408;
      throw tiempoAgotado;
    }
    throw error;
  } finally {
    clearTimeout(temporizador);
  }
}

async function intentarProveedor(id, { mensajes, ajustes, ignorarEspera = false }) {
  const proveedor = PROVEEDORES[id];
  if (!proveedor?.url) throw new Error('Proveedor no disponible.');

  const clave = claveDeProveedor(ajustes, id);
  if (proveedor.requiereClave && !clave) {
    throw new Error('Falta la clave de API.');
  }

  const espera = esperaRestante(id);
  if (!ignorarEspera && espera > MAX_ESPERA_REINTENTO_MS) {
    const error = new Error(`En espera ${Math.ceil(espera / 1000)}s por limite del proveedor.`);
    error.status = 429;
    throw error;
  }

  const modelos = modelosPara(id, ajustes);
  let ultimoError = null;
  let abortar = false;

  for (const modelo of modelos) {
    if (abortar) break;

    let intento = 0;

    while (intento < 2) {
      intento += 1;

      try {
        const textoRespuesta = await peticion({
          id,
          url: proveedor.url,
          clave,
          modelo,
          mensajes,
          temperatura: ajustes?.temperatura,
        });

        enfriamiento.delete(id);
        return { texto: textoRespuesta, proveedor: id, modelo };
      } catch (error) {
        ultimoError = error;

        // Modelo inexistente: prueba el siguiente modelo del mismo proveedor.
        if (esErrorDeModelo(error)) break;

        // En los proveedores sin clave el token es publico: algunos modelos
        // piden clave real (401) aunque el modelo por defecto si funcione.
        if (proveedor.claveFija && (error?.status === 401 || error?.status === 403)) break;

        // Limite de velocidad: si la espera es corta, reintenta una vez.
        if (esLimiteDeVelocidad(error) && intento === 1) {
          const segundos = segundosDeEspera(error, null);
          const esperaMs = segundos ? segundos * 1000 : 1200;

          if (esperaMs <= MAX_ESPERA_REINTENTO_MS) {
            await dormir(esperaMs);
            continue;
          }

          enfriar(id, esperaMs);
        }

        // Error de red, timeout o credenciales: no insistas con otros modelos.
        abortar = true;
        break;
      }
    }
  }

  throw ultimoError || new Error('Error desconocido.');
}

export async function completar({
  mensajes,
  sistema,
  ajustes,
  proveedor,
  onEstado,
  ignorarEspera = false,
}) {
  const elegido = proveedor || ajustes?.proveedor || 'auto';
  const ids = (elegido === 'auto' ? ORDEN_AUTO : [elegido]).filter(
    (id) => PROVEEDORES[id]?.url
  );

  const listaMensajes = sistema
    ? [{ role: 'system', content: sistema }, ...(mensajes || [])]
    : mensajes || [];

  const intentos = [];

  // Primero los que no estan en espera; si todos lo estan, igual se intenta.
  const libres = ids.filter((id) => esperaRestante(id) <= MAX_ESPERA_REINTENTO_MS);
  const orden = libres.length > 0 ? libres : ids;

  for (const id of orden) {
    const proveedorActual = PROVEEDORES[id];
    const clave = claveDeProveedor(ajustes, id);

    if (proveedorActual.requiereClave && !clave) {
      intentos.push({ proveedor: id, error: 'Sin clave disponible.' });
      continue;
    }

    onEstado?.({ fase: 'probando', proveedor: id });

    try {
      const resultado = await intentarProveedor(id, {
        mensajes: listaMensajes,
        ajustes,
        ignorarEspera,
      });

      onEstado?.({ fase: 'listo', proveedor: id, modelo: resultado.modelo });
      return resultado;
    } catch (error) {
      const mensaje = error?.message || 'Error desconocido.';
      intentos.push({ proveedor: id, error: mensaje });
      onEstado?.({ fase: 'fallo', proveedor: id, error: mensaje });
    }
  }

  throw new ErrorIA(
    'No pude contactar a ningun proveedor de IA. Revisa tu conexion.',
    intentos
  );
}

// Prueba rapida desde el modal de ajustes.
export async function probarProveedor(id, ajustes) {
  const inicio = Date.now();

  const resultado = await completar({
    proveedor: id,
    ajustes,
    sistema: 'Responde unicamente con la palabra OK.',
    mensajes: [{ role: 'user', content: 'Di OK' }],
    ignorarEspera: true,
  });

  return { ...resultado, ms: Date.now() - inicio };
}
