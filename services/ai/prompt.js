// ---------------------------------------------------------------------------
// NEXUS · Prompt del sistema y lectura de la respuesta JSON
// ---------------------------------------------------------------------------

import { catalogoParaPrompt } from './tools';
import { describirFecha } from '../assistant';

function fechaLarga(fecha) {
  try {
    return fecha.toLocaleString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return fecha.toISOString();
  }
}

function zonaHoraria() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  } catch (error) {
    return 'local';
  }
}

export function construirSistema({ nombreUsuario, proximos = [], ahora = new Date() } = {}) {
  const nombre = nombreUsuario ? `Te llamas NEXUS y hablas con ${nombreUsuario}.` : 'Te llamas NEXUS.';
  const pendientes = (proximos || [])
    .slice(0, 8)
    .map((item) => `- ${item.titulo} (${describirFecha(item.fecha)})`)
    .join('\n');

  return `Eres NEXUS, el asistente personal de este celular. ${nombre}

Puedes conversar de cualquier tema y ademas ejecutar acciones reales en el telefono.

REGLAS OBLIGATORIAS:
1. Responde siempre en espanol, con naturalidad y brevedad (maximo 90 palabras, salvo que pidan detalle).
2. Devuelve SIEMPRE un unico objeto JSON valido. Nada de markdown, nada de texto fuera del JSON.
3. Formato exacto: {"respuesta": "texto para el usuario", "acciones": [{"tool": "nombre", "args": {}}]}
4. Si no hace falta ejecutar nada, escribe "acciones": [].
5. Nunca inventes el resultado de una accion: la app la ejecuta y muestra el resultado real.
6. Usa como maximo 4 acciones por respuesta.
7. Si falta un dato imprescindible (numero, cancion, ciudad, destinatario), pregunta en "respuesta" y deja "acciones": [].
8. Las acciones de llamar, SMS, WhatsApp y correo requieren confirmacion del usuario; tu solo proponlas.
9. Responde preguntas generales con tu conocimiento. Si algo es muy reciente o no lo sabes, dilo y ofrece "buscar_web".
10. No repitas el JSON dentro de "respuesta".

FECHA Y HORA ACTUAL: ${fechaLarga(ahora)} (${zonaHoraria()}).
Cuando crees recordatorios, calcula tu mismo la fecha absoluta en formato ISO 8601 local, por ejemplo 2026-11-02T15:00:00. Nunca devuelvas fechas relativas como "manana".

${
  pendientes
    ? `RECORDATORIOS PENDIENTES DEL USUARIO:\n${pendientes}\n`
    : 'El usuario no tiene recordatorios pendientes.\n'
}
HERRAMIENTAS DISPONIBLES:
${catalogoParaPrompt()}

EJEMPLOS:
Usuario: "que hora es"
Tu: {"respuesta":"Son las 14:32.","acciones":[]}

Usuario: "recuerdame llamar al banco manana a las 10"
Tu: {"respuesta":"Listo, te aviso manana a las 10.","acciones":[{"tool":"crear_recordatorio","args":{"titulo":"Llamar al banco","fecha":"2026-11-02T10:00:00","tipo":"recordatorio"}}]}

Usuario: "llama a mama"
Tu: {"respuesta":"Voy a llamar a mama.","acciones":[{"tool":"llamar","args":{"contacto":"mama"}}]}

Usuario: "pon musica de rock"
Tu: {"respuesta":"Busco rock en tu musica.","acciones":[{"tool":"reproducir_musica","args":{"consulta":"rock"}}]}

Usuario: "cuanto es 17 por 23"
Tu: {"respuesta":"17 por 23 es 391.","acciones":[]}`;
}

// Prompt corto para el reintento: si el proveedor se enredo con el catalogo de
// herramientas, al menos queremos que conteste la pregunta.
export function construirSistemaCompacto({ nombreUsuario, ahora = new Date() } = {}) {
  const nombre = nombreUsuario ? ` Hablas con ${nombreUsuario}.` : '';

  return `Eres NEXUS, un asistente util y directo.${nombre} Responde en espanol, en menos de 80 palabras, sin markdown.
Fecha actual: ${fechaLarga(ahora)}.
Devuelve SOLO este JSON: {"respuesta":"tu respuesta","acciones":[]}`;
}

// Los modelos gratuitos a veces devuelven la respuesta con otro nombre de campo.
const CAMPOS_RESPUESTA = [
  'respuesta',
  'response',
  'answer',
  'texto',
  'text',
  'content',
  'message',
  'reply',
  'output',
  'resultado',
];

export function textoDeRespuesta(datos) {
  if (!datos || typeof datos !== 'object') return '';

  for (const campo of CAMPOS_RESPUESTA) {
    const valor = datos[campo];
    if (typeof valor === 'string' && valor.trim()) return valor.trim();
  }

  return '';
}

// Extrae el objeto JSON aunque el modelo agregue texto o bloques de codigo.
export function extraerJSON(textoRespuesta) {
  if (!textoRespuesta) return null;

  let limpio = String(textoRespuesta).trim();

  // Quita bloques ```json ... ```
  limpio = limpio.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  const intentar = (valor) => {
    try {
      const datos = JSON.parse(valor);
      return datos && typeof datos === 'object' ? datos : null;
    } catch (error) {
      return null;
    }
  };

  const directo = intentar(limpio);
  if (directo) return directo;

  // Busca el primer objeto equilibrado dentro del texto.
  const inicio = limpio.indexOf('{');
  if (inicio < 0) return null;

  let profundidad = 0;
  let enCadena = false;
  let escape = false;

  for (let i = inicio; i < limpio.length; i += 1) {
    const caracter = limpio[i];

    if (enCadena) {
      if (escape) escape = false;
      else if (caracter === '\\') escape = true;
      else if (caracter === '"') enCadena = false;
      continue;
    }

    if (caracter === '"') enCadena = true;
    else if (caracter === '{') profundidad += 1;
    else if (caracter === '}') {
      profundidad -= 1;
      if (profundidad === 0) {
        return intentar(limpio.slice(inicio, i + 1));
      }
    }
  }

  return null;
}
