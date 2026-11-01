// ---------------------------------------------------------------------------
// NEXUS · Orquestador del asistente
//
// Flujo: mensaje -> respuesta instantanea local (hora, fecha, cuentas) o
// proveedor de IA -> JSON { respuesta, acciones } -> ejecuta las acciones
// seguras -> devuelve las sensibles para confirmar.
//
// Si ningun proveedor responde, NEXUS contesta igual en modo local. El usuario
// nunca ve un error tecnico ni tiene que configurar claves.
// ---------------------------------------------------------------------------

import { MAX_ACCIONES, MAX_HISTORIAL } from './config';
import { completar } from './client';
import {
  construirSistema,
  construirSistemaCompacto,
  extraerJSON,
  textoDeRespuesta,
} from './prompt';
import { ajustesActuales } from './settings';
import {
  descripcionAccion,
  ejecutarHerramienta,
  esSensible,
  resolverNombre,
} from './tools';
import { procesarOrden } from '../assistant';

function sinAcentos(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function numeroBonito(valor) {
  if (!Number.isFinite(valor)) return '';
  const redondeado = Math.round(valor * 1e6) / 1e6;
  return redondeado.toLocaleString('es-ES', { maximumFractionDigits: 6 });
}

// Evaluador aritmetico propio: Hermes (Android) no soporta `Function` ni `eval`,
// asi que resolvemos las cuentas con un tokenizador y el algoritmo de precedencia.
function evaluarCuenta(expresion) {
  const tokens = String(expresion).match(/\d+(?:\.\d+)?|[+\-*/()]/g);
  if (!tokens || tokens.length === 0) return NaN;

  const valores = [];
  const operadores = [];

  const precedencia = { '+': 1, '-': 1, '*': 2, '/': 2 };

  const aplicar = () => {
    const operador = operadores.pop();
    const b = valores.pop();
    const a = valores.pop();
    if (a === undefined || b === undefined) return false;

    switch (operador) {
      case '+':
        valores.push(a + b);
        return true;
      case '-':
        valores.push(a - b);
        return true;
      case '*':
        valores.push(a * b);
        return true;
      case '/':
        valores.push(b === 0 ? NaN : a / b);
        return true;
      default:
        return false;
    }
  };

  let esperaNumero = true;

  for (const token of tokens) {
    if (/^\d/.test(token)) {
      valores.push(Number(token));
      esperaNumero = false;
      continue;
    }

    if (token === '(') {
      operadores.push(token);
      esperaNumero = true;
      continue;
    }

    if (token === ')') {
      while (operadores.length > 0 && operadores[operadores.length - 1] !== '(') {
        if (!aplicar()) return NaN;
      }
      if (operadores.pop() !== '(') return NaN;
      esperaNumero = false;
      continue;
    }

    // Signo unario (al inicio o despues de un operador o parentesis).
    if ((token === '-' || token === '+') && esperaNumero) {
      valores.push(0);
      operadores.push(token === '-' ? '-' : '+');
      esperaNumero = true;
      continue;
    }

    const actual = precedencia[token];
    if (!actual) return NaN;

    while (operadores.length > 0) {
      const tope = operadores[operadores.length - 1];
      if (tope === '(' || precedencia[tope] < actual) break;
      if (!aplicar()) return NaN;
    }

    operadores.push(token);
    esperaNumero = true;
  }

  while (operadores.length > 0) {
    if (!aplicar()) return NaN;
  }

  return valores.length === 1 ? valores[0] : NaN;
}

// Resuelve cuentas escritas en lenguaje natural ("17 por 23", "15% de 200").
function interpretarCuenta(texto) {
  const plano = sinAcentos(texto);

  let t = plano
    .replace(/cuanto (es|son|vale|da)/g, ' ')
    .replace(/calcula|calculame|resultado de/g, ' ')
    .replace(/multiplicado por/g, '*')
    .replace(/dividido (entre|por)/g, '/')
    .replace(/\bpor\b/g, '*')
    .replace(/\bentre\b/g, '/')
    .replace(/\bmas\b/g, '+')
    .replace(/\bmenos\b/g, '-')
    .replace(/\bx\b/g, '*')
    .replace(/÷/g, '/')
    .replace(/×/g, '*')
    .replace(/,/g, '.');

  const porcentaje = t.match(/(\d+(?:\.\d+)?)\s*%\s*de\s*(\d+(?:\.\d+)?)/);
  if (porcentaje) {
    const parte = Number(porcentaje[1]);
    const total = Number(porcentaje[2]);
    if (Number.isFinite(parte) && Number.isFinite(total)) {
      return {
        respuesta: `El ${numeroBonito(parte)}% de ${numeroBonito(total)} es ${numeroBonito(
          (parte / 100) * total
        )}.`,
      };
    }
  }

  const raiz = t.match(/raiz (cuadrada )?de (\d+(?:\.\d+)?)/);
  if (raiz) {
    const valor = Number(raiz[2]);
    if (Number.isFinite(valor) && valor >= 0) {
      return { respuesta: `La raiz de ${numeroBonito(valor)} es ${numeroBonito(Math.sqrt(valor))}.` };
    }
  }

  // Evita falsos positivos: "el partido quedo 3-2" no es una cuenta.
  const soloMatematica = /^[0-9+\-*/().\s?!]+$/.test(t.trim());
  const loPide =
    /^(cuanto|cuanta|cuantos|calcula|calculame|resultado)\b/.test(t.trim()) ||
    /\b(por|mas|menos|entre|dividido|multiplicado)\b/.test(plano);

  if (!soloMatematica && !loPide) return null;

  const limpio = t.replace(/[^0-9+\-*/().\s]/g, ' ').replace(/\s+/g, ' ').trim();

  if (!limpio || !/[+\-*/]/.test(limpio) || !/\d/.test(limpio)) return null;

  const soloCuenta = limpio.replace(/[0-9+\-*/().\s]/g, '');
  if (soloCuenta.length > 0) return null;

  const valor = evaluarCuenta(limpio);
  if (!Number.isFinite(valor)) return null;

  return { respuesta: `${limpio} = ${numeroBonito(valor)}.` };
}

// Respuestas que no necesitan red: mejoran muchisimo la sensacion de rapidez.
function respuestaInmediata(texto) {
  const t = sinAcentos(texto);

  if (/^(que|k) hora (es|son)\b/.test(t) || /^hora (actual|es)\b/.test(t)) {
    const hora = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return { respuesta: `Son las ${hora}.` };
  }

  if (
    /^(que|k) (dia|fecha) (es|estamos)\b/.test(t) ||
    /^fecha (de hoy|actual)\b/.test(t) ||
    /^(a )?que dia estamos\b/.test(t)
  ) {
    const fecha = new Date().toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return { respuesta: `Hoy es ${fecha}.` };
  }

  if (/^(quien eres|como te llamas|que eres)\b/.test(t)) {
    return {
      respuesta:
        'Soy NEXUS, tu asistente personal. Puedo responder preguntas y tambien actuar en tu telefono: recordatorios, llamadas, mensajes, musica, apps, clima y mas.',
    };
  }

  if (/^(que puedes hacer|en que me puedes ayudar|ayuda|comandos)\b/.test(t)) {
    return {
      respuesta:
        'Puedo responder casi cualquier pregunta y ademas: crear recordatorios y alarmas, llamar o escribir a tus contactos, poner tu musica, abrir apps, darte indicaciones, consultar el clima, copiar texto, revisar la bateria y ajustar el brillo. Pidemelo con naturalidad.',
    };
  }

  const cuenta = interpretarCuenta(texto);
  if (cuenta) return cuenta;

  return null;
}

function normalizarAcciones(datos) {
  const crudas = Array.isArray(datos?.acciones)
    ? datos.acciones
    : Array.isArray(datos?.actions)
      ? datos.actions
      : datos?.accion
        ? [datos.accion]
        : [];

  const acciones = [];

  crudas.forEach((cruda) => {
    if (acciones.length >= MAX_ACCIONES) return;

    let nombre;
    let args = {};

    if (typeof cruda === 'string') {
      nombre = cruda;
    } else if (cruda && typeof cruda === 'object') {
      nombre = cruda.tool || cruda.herramienta || cruda.name || cruda.nombre || cruda.accion;
      args = cruda.args || cruda.parametros || cruda.arguments || cruda.input || {};
    }

    const real = resolverNombre(nombre);
    if (!real) return;

    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
      } catch (error) {
        args = {};
      }
    }

    acciones.push({
      tool: real,
      args: args && typeof args === 'object' ? args : {},
    });
  });

  return acciones;
}

async function aplicarAcciones(acciones, contexto) {
  const resultados = [];
  const pendientes = [];

  for (const accion of acciones) {
    if (esSensible(accion.tool)) {
      pendientes.push({
        ...accion,
        descripcion: descripcionAccion(accion.tool, accion.args),
      });
      continue;
    }

    const resultado = await ejecutarHerramienta(accion.tool, accion.args, contexto);
    resultados.push({ ...accion, ...resultado });
  }

  return { resultados, pendientes };
}

function planLocal(mensaje, contexto) {
  const orden = procesarOrden(mensaje);
  const acciones = [];
  let respuesta = '';

  switch (orden.intent) {
    case 'saludo':
      respuesta =
        'Hola. Puedo conversar de cualquier tema, crear recordatorios y controlar tu telefono. Que necesitas?';
      break;

    case 'ayuda':
      respuesta =
        'Puedo responder preguntas, crear recordatorios y alarmas, llamar a tus contactos, enviar mensajes, reproducir tu musica, abrir apps, consultar el clima y mas. Prueba: "llama a mama", "pon musica" o "que clima hace en Madrid".';
      break;

    case 'hora':
      respuesta = `Son las ${orden.horaActual}.`;
      break;

    case 'listar':
      acciones.push({ tool: 'listar_recordatorios', args: {} });
      break;

    case 'eliminar': {
      if (orden.todas) {
        acciones.push({ tool: 'eliminar_recordatorio', args: { todos: true } });
        break;
      }

      const lista = contexto.proximos || [];
      const objetivo =
        lista.find((item) => (orden.tipo ? item.tipo === orden.tipo : true)) || lista[0];

      if (!objetivo) respuesta = 'No encontre recordatorios para eliminar.';
      else acciones.push({ tool: 'eliminar_recordatorio', args: { titulo: objetivo.titulo } });
      break;
    }

    case 'crear':
      if (orden.error || !orden.fecha) {
        respuesta = orden.error || 'No pude entender la fecha y la hora.';
      } else {
        acciones.push({
          tool: 'crear_recordatorio',
          args: {
            titulo: orden.titulo,
            fecha: orden.fecha.toISOString(),
            tipo: orden.tipo,
          },
        });
      }
      break;

    default:
      respuesta =
        'Ahora mismo estoy sin conexion a la IA. Puedo ayudarte con recordatorios, alarmas, la hora, la fecha, cuentas y comandos basicos del telefono. Reintenta en unos segundos y te respondo cualquier pregunta.';
      break;
  }

  return { respuesta, acciones };
}

async function responderLocal(texto, contexto, aviso) {
  const plan = planLocal(texto, contexto);
  const { resultados, pendientes } = await aplicarAcciones(plan.acciones, contexto);

  let respuesta = plan.respuesta;
  if (!respuesta && resultados.length > 0) {
    respuesta = resultados.map((item) => item.mensaje).join('\n');
  }

  return {
    respuesta: respuesta || 'Listo.',
    resultados,
    pendientes,
    proveedor: 'local',
    modelo: null,
    ms: 0,
    aviso: aviso || null,
  };
}

export async function conversar({ mensaje, historial = [], contexto = {}, onEstado }) {
  const texto = String(mensaje || '').trim();
  const ajustes = ajustesActuales();

  if (!texto) {
    return {
      respuesta: '',
      resultados: [],
      pendientes: [],
      proveedor: 'local',
      modelo: null,
      ms: 0,
      aviso: null,
    };
  }

  // 1. Respuesta instantanea sin red (hora, fecha, cuentas, identidad).
  const rapida = respuestaInmediata(texto);
  if (rapida) {
    return {
      respuesta: rapida.respuesta,
      resultados: [],
      pendientes: [],
      proveedor: 'local',
      modelo: null,
      ms: 0,
      aviso: null,
    };
  }

  if (ajustes.proveedor === 'local') {
    return responderLocal(texto, contexto, null);
  }

  const inicio = Date.now();

  const previos = (historial || [])
    .filter((item) => item.rol === 'usuario' || item.rol === 'nexus')
    .slice(-MAX_HISTORIAL)
    .map((item) => ({
      role: item.rol === 'usuario' ? 'user' : 'assistant',
      content: String(item.texto || '').slice(0, 2000),
    }));

  // 2. Intento normal: conversacion + acciones.
  try {
    const sistema = construirSistema({
      nombreUsuario: contexto.nombreUsuario,
      proximos: contexto.proximos,
      ahora: new Date(),
    });

    const salida = await completar({
      sistema,
      mensajes: [...previos, { role: 'user', content: texto }],
      ajustes,
      onEstado,
    });

    const datos = extraerJSON(salida.texto);
    const acciones = normalizarAcciones(datos);

    let respuesta = textoDeRespuesta(datos);
    if (!respuesta && !datos) {
      // El modelo respondio texto plano: lo mostramos tal cual.
      respuesta = String(salida.texto || '').trim();
    }

    const { resultados, pendientes } = await aplicarAcciones(acciones, contexto);

    if (!respuesta) {
      if (pendientes.length > 0) {
        respuesta = pendientes.map((item) => `${item.descripcion}.`).join(' ');
      } else if (resultados.length > 0) {
        respuesta = resultados.map((item) => item.mensaje).join('\n');
      } else {
        respuesta = 'Listo.';
      }
    }

    return {
      respuesta,
      resultados,
      pendientes,
      proveedor: salida.proveedor,
      modelo: salida.modelo,
      ms: Date.now() - inicio,
      aviso: null,
    };
  } catch (error) {
    // 3. Reintento con un prompt corto: prioriza contestar la pregunta.
    try {
      const compacto = construirSistemaCompacto({
        nombreUsuario: contexto.nombreUsuario,
        ahora: new Date(),
      });

      const salida = await completar({
        sistema: compacto,
        mensajes: [{ role: 'user', content: texto }],
        ajustes,
        onEstado,
      });

      const datos = extraerJSON(salida.texto);
      const respuesta = textoDeRespuesta(datos) || String(salida.texto || '').trim();

      if (respuesta) {
        return {
          respuesta,
          resultados: [],
          pendientes: [],
          proveedor: salida.proveedor,
          modelo: salida.modelo,
          ms: Date.now() - inicio,
          aviso: null,
        };
      }
    } catch (segundoError) {
      // seguimos al modo local
    }

    const intentos = Array.isArray(error?.intentos) ? error.intentos : [];
    const detalle = intentos
      .map((intento) => `${intento.proveedor}: ${intento.error}`)
      .join(' · ');

    const aviso = detalle
      ? `No pude usar la IA (${detalle}). Respondo en modo local.`
      : 'No pude usar la IA. Respondo en modo local.';

    return responderLocal(texto, contexto, aviso);
  }
}

// Ejecuta una accion sensible despues de que el usuario confirma.
export async function ejecutarAccion(accion, contexto = {}) {
  return ejecutarHerramienta(accion.tool, accion.args, contexto);
}
