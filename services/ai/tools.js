// ---------------------------------------------------------------------------
// NEXUS · Catalogo de herramientas del asistente
//
// Cada herramienta declara:
//   - descripcion: lo que la IA lee para decidir cuando usarla
//   - args: ejemplo de argumentos (se inyecta en el prompt)
//   - sensible: true => NEXUS pide confirmacion antes de ejecutarla
//   - ejecutar(args, contexto): devuelve { ok, mensaje, datos }
// ---------------------------------------------------------------------------

import { describirFecha } from '../assistant';
import * as device from '../device';
import * as music from '../music';

function texto(valor) {
  return String(valor ?? '').trim();
}

function normalizar(valor) {
  return device.normalizarTexto(valor);
}

function buscarRecordatorio(lista, titulo) {
  const buscado = normalizar(titulo);
  if (!buscado) return null;

  let mejor = null;
  let mejorPuntaje = 0;

  (lista || []).forEach((item) => {
    const nombre = normalizar(item.titulo);
    let puntaje = 0;
    if (nombre === buscado) puntaje = 100;
    else if (nombre.includes(buscado)) puntaje = 70;
    else if (buscado.includes(nombre)) puntaje = 50;

    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = item;
    }
  });

  return mejor;
}

function aFecha(valor) {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export const HERRAMIENTAS = {
  // -------------------------------------------------------------------------
  // Recordatorios
  // -------------------------------------------------------------------------
  crear_recordatorio: {
    descripcion:
      'Crea un recordatorio o una alarma en NEXUS. Usala cuando el usuario pida recordar, avisar, programar o despertarse.',
    args: '{ "titulo": "Llamar a mama", "fecha": "2026-11-02T15:00:00", "tipo": "recordatorio" }',
    sensible: false,
    async ejecutar(args, ctx) {
      const titulo = texto(args.titulo) || 'Recordatorio';
      const fecha = aFecha(args.fecha);
      const tipo = normalizar(args.tipo) === 'alarma' ? 'alarma' : 'recordatorio';

      if (!fecha) {
        return { ok: false, mensaje: 'No entendi la fecha y hora. Dime algo como "manana a las 3 de la tarde".' };
      }

      if (fecha.getTime() <= Date.now()) {
        return { ok: false, mensaje: 'Esa hora ya paso. Dime una hora futura.' };
      }

      if (typeof ctx.agregarRecordatorio !== 'function') {
        return { ok: false, mensaje: 'No pude acceder a tus recordatorios.' };
      }

      await ctx.agregarRecordatorio({ titulo, fecha, tipo });

      return {
        ok: true,
        mensaje: `Listo. Programe tu ${tipo} "${titulo}" ${describirFecha(fecha)}.`,
        datos: { titulo, fecha: fecha.toISOString(), tipo },
      };
    },
  },

  listar_recordatorios: {
    descripcion:
      'Muestra los recordatorios y alarmas pendientes del usuario.',
    args: '{}',
    sensible: false,
    async ejecutar(_args, ctx) {
      const pendientes = ctx.proximos || [];

      if (pendientes.length === 0) {
        return { ok: true, mensaje: 'No tienes recordatorios ni alarmas pendientes.' };
      }

      const lineas = pendientes
        .slice(0, 10)
        .map((item) => `• ${item.titulo} — ${describirFecha(item.fecha)}`);

      return {
        ok: true,
        mensaje: `Tus proximos compromisos:\n${lineas.join('\n')}`,
        datos: { total: pendientes.length },
      };
    },
  },

  completar_recordatorio: {
    descripcion:
      'Marca un recordatorio o tarea como completada. Usala cuando el usuario diga que ya hizo algo.',
    args: '{ "titulo": "Comprar pan" }',
    sensible: false,
    async ejecutar(args, ctx) {
      const objetivo = buscarRecordatorio(ctx.recordatorios, args.titulo);

      if (!objetivo) {
        return { ok: false, mensaje: `No encontre un recordatorio parecido a "${texto(args.titulo)}".` };
      }

      if (typeof ctx.alternarCompletado !== 'function') {
        return { ok: false, mensaje: 'No pude actualizar ese recordatorio.' };
      }

      await ctx.alternarCompletado(objetivo);
      return { ok: true, mensaje: `Marque "${objetivo.titulo}" como completado.` };
    },
  },

  eliminar_recordatorio: {
    descripcion:
      'Elimina un recordatorio concreto o todos los recordatorios. Usala cuando el usuario pida borrar, cancelar o quitar.',
    args: '{ "titulo": "Comprar pan", "todos": false }',
    sensible: false,
    async ejecutar(args, ctx) {
      const todos = args.todos === true || normalizar(args.todos) === 'true';

      if (todos) {
        if (typeof ctx.eliminarTodas !== 'function') {
          return { ok: false, mensaje: 'No pude eliminar tus recordatorios.' };
        }
        await ctx.eliminarTodas();
        return { ok: true, mensaje: 'Listo, elimine todos tus recordatorios y alarmas.' };
      }

      const objetivo = buscarRecordatorio(ctx.recordatorios, args.titulo);

      if (!objetivo) {
        return { ok: false, mensaje: `No encontre un recordatorio parecido a "${texto(args.titulo)}".` };
      }

      if (typeof ctx.eliminarRecordatorio !== 'function') {
        return { ok: false, mensaje: 'No pude eliminar ese recordatorio.' };
      }

      await ctx.eliminarRecordatorio(objetivo);
      return { ok: true, mensaje: `Elimine "${objetivo.titulo}".` };
    },
  },

  // -------------------------------------------------------------------------
  // Comunicacion (pide confirmacion)
  // -------------------------------------------------------------------------
  llamar: {
    descripcion:
      'Hace una llamada telefonica a un contacto del telefono o a un numero.',
    args: '{ "contacto": "mama" }  o  { "numero": "+34600111222" }',
    sensible: true,
    async ejecutar(args) {
      return device.llamar({ contacto: args.contacto, numero: args.numero });
    },
  },

  enviar_sms: {
    descripcion:
      'Abre la app de mensajes con un SMS listo para enviar a un contacto o numero.',
    args: '{ "contacto": "Juan", "mensaje": "Llego en 10 minutos" }',
    sensible: true,
    async ejecutar(args) {
      return device.enviarSms({
        contacto: args.contacto,
        numero: args.numero,
        mensaje: args.mensaje,
      });
    },
  },

  enviar_whatsapp: {
    descripcion:
      'Abre WhatsApp con un mensaje listo para enviar a un contacto o numero.',
    args: '{ "contacto": "Juan", "mensaje": "Hola!" }',
    sensible: true,
    async ejecutar(args) {
      return device.enviarWhatsApp({
        contacto: args.contacto,
        numero: args.numero,
        mensaje: args.mensaje,
      });
    },
  },

  enviar_email: {
    descripcion: 'Abre la app de correo con un email listo para enviar.',
    args: '{ "destino": "hola@ejemplo.com", "asunto": "Hola", "cuerpo": "..." }',
    sensible: true,
    async ejecutar(args) {
      return device.enviarEmail({
        destino: args.destino,
        asunto: args.asunto,
        cuerpo: args.cuerpo,
      });
    },
  },

  buscar_contacto: {
    descripcion:
      'Busca el numero de telefono de un contacto guardado en el dispositivo.',
    args: '{ "nombre": "mama" }',
    sensible: false,
    async ejecutar(args) {
      const encontrados = await device.buscarContactos(args.nombre, 3);

      if (encontrados.length === 0) {
        return { ok: false, mensaje: `No encontre un contacto llamado "${texto(args.nombre)}".` };
      }

      const lista = encontrados.map((c) => `${c.nombre}: ${c.numero}`).join('\n');
      return { ok: true, mensaje: `Encontre:\n${lista}`, datos: { contactos: encontrados } };
    },
  },

  // -------------------------------------------------------------------------
  // Musica
  // -------------------------------------------------------------------------
  reproducir_musica: {
    descripcion:
      'Reproduce musica guardada en el telefono. Si no se indica cancion, reproduce la biblioteca.',
    args: '{ "consulta": "nombre de la cancion o artista" }',
    sensible: false,
    async ejecutar(args) {
      try {
        return await music.reproducir(args.consulta);
      } catch (error) {
        if (error?.codigo === 'NO_ENCONTRADA') throw error;

        const respaldo = await music.abrirReproductorDelSistema();
        if (respaldo.ok) {
          return {
            ok: true,
            mensaje: `${respaldo.mensaje} No pude reproducirlo dentro de NEXUS: ${error.message}`,
          };
        }
        throw error;
      }
    },
  },

  controlar_musica: {
    descripcion:
      'Controla la musica que esta sonando: pausar, reanudar, detener, siguiente, anterior o cambiar el volumen.',
    args: '{ "accion": "pausar" }  o  { "accion": "volumen", "valor": 40 }',
    sensible: false,
    async ejecutar(args) {
      const accion = normalizar(args.accion);

      if (accion === 'pausar' || accion === 'pausa') return music.pausar();
      if (accion === 'reanudar' || accion === 'continuar' || accion === 'play') {
        return music.reanudar();
      }
      if (accion === 'detener' || accion === 'parar' || accion === 'stop') {
        return music.detener();
      }
      if (accion === 'siguiente' || accion === 'next') return music.siguiente();
      if (accion === 'anterior' || accion === 'prev') return music.anterior();
      if (accion === 'volumen') return music.cambiarVolumen(args.valor);
      if (accion === 'estado') return music.estadoMusica();

      return {
        ok: false,
        mensaje: 'Puedo pausar, reanudar, detener, pasar de cancion o cambiar el volumen.',
      };
    },
  },

  abrir_reproductor: {
    descripcion: 'Abre la aplicacion de musica del telefono.',
    args: '{}',
    sensible: false,
    async ejecutar() {
      return music.abrirReproductorDelSistema();
    },
  },

  // -------------------------------------------------------------------------
  // Apps, web y mapas
  // -------------------------------------------------------------------------
  abrir_app: {
    descripcion:
      'Abre una aplicacion instalada en el telefono (WhatsApp, Instagram, YouTube, Spotify, etc).',
    args: '{ "app": "whatsapp" }',
    sensible: false,
    async ejecutar(args) {
      return device.abrirApp({ app: args.app });
    },
  },

  abrir_url: {
    descripcion: 'Abre un enlace web en el navegador.',
    args: '{ "url": "https://ejemplo.com" }',
    sensible: false,
    async ejecutar(args) {
      return device.abrirUrl({ url: args.url });
    },
  },

  buscar_web: {
    descripcion:
      'Abre una busqueda en Google. Usala cuando no sepas algo actual o el usuario pida buscar en internet.',
    args: '{ "consulta": "precio del dolar hoy" }',
    sensible: false,
    async ejecutar(args) {
      return device.buscarWeb({ consulta: args.consulta });
    },
  },

  abrir_mapa: {
    descripcion:
      'Abre Google Maps con la ubicación indicada por el usuario, o traza una ruta si se especifica un modo de transporte.',
    args: '{ "destino": "Torre Eiffel, Paris" }  o  { "destino": "Plaza Mayor, Madrid", "modo": "coche" }',
    sensible: false,
    async ejecutar(args) {
      return device.abrirMapa({
        destino: args.destino || args.ubicacion || args.lugar,
        modo: args.modo,
      });
    },
  },

  consultar_clima: {
    descripcion:
      'Consulta el clima actual de una ciudad o de la ubicacion del usuario.',
    args: '{ "ciudad": "Madrid" }',
    sensible: false,
    async ejecutar(args) {
      return device.consultarClima({ ciudad: args.ciudad });
    },
  },

  // -------------------------------------------------------------------------
  // Utilidades del sistema
  // -------------------------------------------------------------------------
  copiar_texto: {
    descripcion: 'Copia un texto al portapapeles del telefono.',
    args: '{ "texto": "..." }',
    sensible: false,
    async ejecutar(args) {
      return device.copiarTexto({ texto: args.texto });
    },
  },

  leer_portapapeles: {
    descripcion: 'Lee lo que hay actualmente en el portapapeles.',
    args: '{}',
    sensible: false,
    async ejecutar() {
      return device.leerPortapapeles();
    },
  },

  estado_bateria: {
    descripcion: 'Informa el nivel y el estado de la bateria del telefono.',
    args: '{}',
    sensible: false,
    async ejecutar() {
      return device.estadoBateria();
    },
  },

  info_dispositivo: {
    descripcion: 'Informa el modelo, sistema operativo y version de NEXUS.',
    args: '{}',
    sensible: false,
    async ejecutar() {
      return device.infoDispositivo();
    },
  },

  ajustar_brillo: {
    descripcion: 'Cambia el brillo de la pantalla. El nivel va de 0 a 100.',
    args: '{ "nivel": 60 }',
    sensible: false,
    async ejecutar(args) {
      return device.ajustarBrillo({ nivel: args.nivel });
    },
  },

  vibrar: {
    descripcion: 'Hace vibrar el telefono. La duracion va en milisegundos.',
    args: '{ "duracion": 500 }',
    sensible: false,
    async ejecutar(args) {
      return device.vibrar({ duracion: args.duracion });
    },
  },

  compartir: {
    descripcion: 'Abre el menu del sistema para compartir un texto o un enlace.',
    args: '{ "texto": "...", "url": "https://..." }',
    sensible: false,
    async ejecutar(args) {
      return device.compartir({ texto: args.texto, url: args.url });
    },
  },

  abrir_ajustes: {
    descripcion: 'Abre los ajustes del telefono o de NEXUS.',
    args: '{}',
    sensible: false,
    async ejecutar() {
      return device.abrirAjustes();
    },
  },

  tomar_foto: {
    descripcion: 'Abre la camara para tomar una foto y guardarla en la galeria.',
    args: '{}',
    sensible: false,
    async ejecutar() {
      return device.tomarFoto();
    },
  },
};

// Nombres alternativos que a veces inventan los modelos.
const ALIAS = {
  crear_alarma: 'crear_recordatorio',
  agregar_recordatorio: 'crear_recordatorio',
  nuevo_recordatorio: 'crear_recordatorio',
  listar_recordatorios_pendientes: 'listar_recordatorios',
  ver_recordatorios: 'listar_recordatorios',
  borrar_recordatorio: 'eliminar_recordatorio',
  eliminar_todos_los_recordatorios: 'eliminar_recordatorio',
  completar_tarea: 'completar_recordatorio',
  llamar_contacto: 'llamar',
  hacer_llamada: 'llamar',
  marcar_numero: 'llamar',
  mandar_sms: 'enviar_sms',
  enviar_mensaje: 'enviar_sms',
  mandar_whatsapp: 'enviar_whatsapp',
  whatsapp: 'enviar_whatsapp',
  buscar_en_web: 'buscar_web',
  buscar_en_internet: 'buscar_web',
  abrir_navegador: 'abrir_url',
  abrir_whatsapp: 'abrir_app',
  poner_musica: 'reproducir_musica',
  play_musica: 'reproducir_musica',
  pausar_musica: 'controlar_musica',
  siguiente_cancion: 'controlar_musica',
  clima: 'consultar_clima',
  tiempo: 'consultar_clima',
  bateria: 'estado_bateria',
  brillo: 'ajustar_brillo',
  camara: 'tomar_foto',
  foto: 'tomar_foto',
  mapa: 'abrir_mapa',
};

export function resolverNombre(nombre) {
  const limpio = texto(nombre);
  if (!limpio) return null;
  if (HERRAMIENTAS[limpio]) return limpio;

  const alias = ALIAS[limpio];
  if (alias && HERRAMIENTAS[alias]) return alias;

  const enMinusculas = limpio.toLowerCase();
  if (HERRAMIENTAS[enMinusculas]) return enMinusculas;
  if (ALIAS[enMinusculas] && HERRAMIENTAS[ALIAS[enMinusculas]]) {
    return ALIAS[enMinusculas];
  }

  return null;
}

export function esSensible(nombre) {
  return HERRAMIENTAS[nombre]?.sensible === true;
}

export function catalogoParaPrompt() {
  return Object.entries(HERRAMIENTAS)
    .map(([nombre, tool]) => `- ${nombre}: ${tool.descripcion} args: ${tool.args}`)
    .join('\n');
}

export async function ejecutarHerramienta(nombre, args, contexto) {
  const real = resolverNombre(nombre);

  if (!real) {
    return { ok: false, mensaje: `No tengo una accion llamada "${texto(nombre)}".` };
  }

  try {
    const resultado = await HERRAMIENTAS[real].ejecutar(args || {}, contexto || {});
    if (!resultado || typeof resultado !== 'object') {
      return { ok: true, mensaje: String(resultado || 'Hecho.') };
    }
    return {
      ok: resultado.ok !== false,
      mensaje: texto(resultado.mensaje) || (resultado.ok === false ? 'No pude hacerlo.' : 'Hecho.'),
      datos: resultado.datos,
    };
  } catch (error) {
    return {
      ok: false,
      mensaje: error?.message || 'No pude completar esa accion.',
    };
  }
}

export function descripcionAccion(nombre, args = {}) {
  const real = resolverNombre(nombre) || nombre;

  switch (real) {
    case 'llamar':
      return `Llamar a ${args.contacto || args.numero || 'un contacto'}`;
    case 'enviar_sms':
      return `Enviar un SMS a ${args.contacto || args.numero || 'un contacto'}`;
    case 'enviar_whatsapp':
      return `Escribir por WhatsApp a ${args.contacto || args.numero || 'un contacto'}`;
    case 'enviar_email':
      return `Enviar un correo a ${args.destino || 'un contacto'}`;
    default:
      return HERRAMIENTAS[real]?.descripcion || real;
  }
}
