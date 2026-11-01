// ---------------------------------------------------------------------------
// NEXUS · Ajustes de la IA
//
// El usuario no configura claves: NEXUS las obtiene solo (URL remota, variables
// de entorno del build o cache). Los ajustes que si puede tocar son el estilo
// de respuesta y la voz.
// ---------------------------------------------------------------------------

import AsyncStorage from '@react-native-async-storage/async-storage';

import { PROVEEDORES, ORDEN_AUTO } from './config';
import {
  cargarClavesRemotas,
  clavesRemotas,
  suscribirClaves,
} from './keys';

const CLAVE_ALMACEN = 'nexus.ai.ajustes.v1';

export const AJUSTES_POR_DEFECTO = {
  proveedor: 'auto',
  claves: {},
  modelos: {},
  temperatura: 0.6,
  voz: true,
};

let cache = null;
let cargando = null;
const oyentes = new Set();

function clonar(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function normalizar(bruto) {
  const base = clonar(AJUSTES_POR_DEFECTO);
  if (!bruto || typeof bruto !== 'object') return base;

  if (PROVEEDORES[bruto.proveedor]) base.proveedor = bruto.proveedor;

  if (bruto.claves && typeof bruto.claves === 'object') {
    Object.keys(bruto.claves).forEach((id) => {
      const valor = bruto.claves[id];
      if (typeof valor === 'string' && valor.trim()) base.claves[id] = valor.trim();
    });
  }

  if (bruto.modelos && typeof bruto.modelos === 'object') {
    Object.keys(bruto.modelos).forEach((id) => {
      const valor = bruto.modelos[id];
      if (typeof valor === 'string' && valor.trim()) base.modelos[id] = valor.trim();
    });
  }

  const temperatura = Number(bruto.temperatura);
  if (Number.isFinite(temperatura)) {
    base.temperatura = Math.min(1.2, Math.max(0, temperatura));
  }

  base.voz = bruto.voz !== false;
  return base;
}

function avisar() {
  const copia = ajustesActuales();
  oyentes.forEach((fn) => {
    try {
      fn(copia);
    } catch (error) {
      // un oyente roto no debe romper a los demas
    }
  });
}

export function ajustesActuales() {
  return cache ? clonar(cache) : clonar(AJUSTES_POR_DEFECTO);
}

export async function cargarAjustes() {
  if (cache) return ajustesActuales();
  if (cargando) return cargando;

  cargando = (async () => {
    try {
      const crudo = await AsyncStorage.getItem(CLAVE_ALMACEN);
      cache = normalizar(crudo ? JSON.parse(crudo) : null);
    } catch (error) {
      console.warn('NEXUS: no se pudieron leer los ajustes de IA.', error?.message);
      cache = normalizar(null);
    }
    cargando = null;
    return ajustesActuales();
  })();

  const ajustes = await cargando;

  // Trae claves en segundo plano, sin bloquear la primera respuesta.
  cargarClavesRemotas()
    .then(() => avisar())
    .catch(() => {});

  return ajustes;
}

export async function guardarAjustes(parcial) {
  const actual = await cargarAjustes();
  const fusionado = normalizar({
    ...actual,
    ...parcial,
    claves: { ...actual.claves, ...(parcial?.claves || {}) },
    modelos: { ...actual.modelos, ...(parcial?.modelos || {}) },
  });

  cache = fusionado;
  avisar();

  try {
    await AsyncStorage.setItem(CLAVE_ALMACEN, JSON.stringify(fusionado));
  } catch (error) {
    console.warn('NEXUS: no se pudieron guardar los ajustes de IA.', error?.message);
  }

  return ajustesActuales();
}

export function suscribirAjustes(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

// Cuando llegan claves nuevas, avisamos a la UI para que actualice el estado.
suscribirClaves(() => avisar());

// Claves de respaldo definidas en el build (.env / eas.json / EAS secrets).
const CLAVES_ENTORNO = {
  gemini: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
  groq: process.env.EXPO_PUBLIC_GROQ_API_KEY,
  openrouter: process.env.EXPO_PUBLIC_OPENROUTER_API_KEY,
};

// Orden de busqueda de una clave: ajustes locales -> clave fija del proveedor
// -> claves automaticas -> variables de entorno del build.
export function claveDeProveedor(ajustes, id) {
  const guardada = ajustes?.claves?.[id];
  if (guardada) return String(guardada).trim();

  const fija = PROVEEDORES[id]?.claveFija;
  if (fija) return String(fija).trim();

  const remota = clavesRemotas()[id];
  if (remota) return String(remota).trim();

  const entorno = CLAVES_ENTORNO[id];
  return entorno ? String(entorno).trim() : '';
}

export function modeloDeProveedor(ajustes, id) {
  const elegido = ajustes?.modelos?.[id];
  if (elegido) return elegido;
  return PROVEEDORES[id]?.modeloPorDefecto || null;
}

// Devuelve los proveedores que realmente pueden usarse ahora mismo.
export function proveedoresListos(ajustes = ajustesActuales()) {
  const ids = ajustes.proveedor === 'auto' ? ORDEN_AUTO : [ajustes.proveedor];

  return ids.filter((id) => {
    const proveedor = PROVEEDORES[id];
    if (!proveedor || !proveedor.url) return false;
    if (proveedor.requiereClave && !claveDeProveedor(ajustes, id)) return false;
    return true;
  });
}

export function hayProveedorConIA(ajustes = ajustesActuales()) {
  return proveedoresListos(ajustes).length > 0;
}

// Resumen para la pantalla de ajustes.
export function estadoClaves() {
  const remotas = clavesRemotas();
  const ids = Object.keys(remotas);
  return {
    total: ids.length,
    proveedores: ids,
    automaticas: ids.length > 0,
  };
}
