const DIAS = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

const MESES = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const NUMEROS = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
};

const MS_UNIDAD = {
  segundo: 1000,
  segundos: 1000,
  minuto: 60000,
  minutos: 60000,
  hora: 3600000,
  horas: 3600000,
  dia: 86400000,
  dias: 86400000,
  semana: 604800000,
  semanas: 604800000,
};

export function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function numeroDesdeToken(token) {
  if (!token) return null;
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  return NUMEROS[token] ?? null;
}

export function extraerHora(texto) {
  if (/\bmediodia\b/.test(texto)) return { hora: 12, minuto: 0, meridiem: 'pm' };
  if (/\bmedia noche\b/.test(texto)) return { hora: 0, minuto: 0, meridiem: 'am' };

  let meridiem = null;
  if (/\bpm\b|\bde la tarde\b|\bde la noche\b|\ben la tarde\b|\ben la noche\b|\besta noche\b/.test(texto)) {
    meridiem = 'pm';
  }
  if (/\bam\b|\bde la manana\b|\ben la manana\b|\bde la madrugada\b|\ben la madrugada\b/.test(texto)) {
    meridiem = 'am';
  }

  const hm = texto.match(/\b(\d{1,2})[:.](\d{1,2})\b/);
  if (hm) {
    return { hora: parseInt(hm[1], 10), minuto: parseInt(hm[2], 10), meridiem };
  }

  const aLas = texto.match(/\ba\s+la(?:s)?\s+([a-z0-9]+)/);
  if (aLas) {
    const hora = numeroDesdeToken(aLas[1]);
    let minuto = 0;
    const resto = texto.slice(aLas.index + aLas[0].length);
    const ym = resto.match(/^\s+y\s+([a-z0-9]+)/);
    if (ym) {
      if (ym[1] === 'media') minuto = 30;
      else if (ym[1] === 'cuarto') minuto = 15;
      else minuto = numeroDesdeToken(ym[1]) ?? 0;
    }
    return { hora, minuto, meridiem };
  }

  return { hora: null, minuto: 0, meridiem };
}

function aplicarMeridiem(fecha, hora, meridiem) {
  let h = hora;
  if (meridiem === 'pm' && h < 12) h += 12;
  if (meridiem === 'am' && h === 12) h = 0;
  fecha.setHours(h, fecha.getMinutes(), 0, 0);
  return fecha;
}

export function resolverFecha(texto, ahora = new Date()) {
  const rel = texto.match(
    /\ben\s+([a-z0-9]+)\s+(minuto|minutos|hora|horas|segundo|segundos|dia|dias|semana|semanas)\b/
  );
  if (rel) {
    const n = numeroDesdeToken(rel[1]) ?? 1;
    return new Date(ahora.getTime() + n * MS_UNIDAD[rel[2]]);
  }

  const { hora, minuto, meridiem } = extraerHora(texto);

  let offsetDias = null;

  if (/\bpasado\s+manana\b/.test(texto)) {
    offsetDias = 2;
  } else if (/\bmanana\b/.test(texto) && !/\bde la manana\b|\ben la manana\b/.test(texto)) {
    offsetDias = 1;
  } else if (/\bhoy\b/.test(texto)) {
    offsetDias = 0;
  } else {
    const dia = texto.match(
      /\b(?:el\s+|proximo\s+|la\s+proxima\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/
    );
    if (dia) {
      const objetivo = DIAS[dia[1]];
      const actual = ahora.getDay();
      let delta = (objetivo - actual + 7) % 7;
      if (delta === 0) delta = 7;
      offsetDias = delta;
    }
  }

  const fechaMes = texto.match(
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/
  );
  if (fechaMes) {
    const diaMes = parseInt(fechaMes[1], 10);
    const mes = MESES[fechaMes[2]];
    const h = hora === null ? 9 : hora;
    let fecha = new Date(ahora.getFullYear(), mes, diaMes, h, minuto, 0, 0);
    if (fecha.getTime() < ahora.getTime()) {
      fecha = new Date(ahora.getFullYear() + 1, mes, diaMes, h, minuto, 0, 0);
    }
    return aplicarMeridiem(fecha, h, meridiem);
  }

  if (hora === null) {
    if (offsetDias === null) return null;
    const fecha = new Date(ahora);
    fecha.setDate(fecha.getDate() + offsetDias);
    fecha.setHours(9, 0, 0, 0);
    return fecha;
  }

  if (meridiem) {
    const fecha = new Date(ahora);
    fecha.setDate(fecha.getDate() + (offsetDias ?? 0));
    fecha.setHours(hora, minuto, 0, 0);
    let final = aplicarMeridiem(fecha, hora, meridiem);
    if (final.getTime() <= ahora.getTime() && (offsetDias === null || offsetDias === 0)) {
      final = new Date(final.getTime() + 86400000);
    }
    return final;
  }

  if (offsetDias !== null) {
    const fecha = new Date(ahora);
    fecha.setDate(fecha.getDate() + offsetDias);
    const h = hora <= 7 ? hora + 12 : hora;
    fecha.setHours(h, minuto, 0, 0);
    return fecha;
  }

  const candidatos = [hora, hora + 12].filter((h) => h >= 0 && h <= 23);
  let mejor = null;
  candidatos.forEach((h) => {
    const c = new Date(ahora);
    c.setSeconds(0, 0);
    c.setHours(h, minuto, 0, 0);
    if (c.getTime() <= ahora.getTime()) return;
    if (mejor === null || c.getTime() < mejor.getTime()) mejor = c;
  });

  if (mejor === null) {
    const c = new Date(ahora);
    c.setDate(c.getDate() + 1);
    c.setHours(hora, minuto, 0, 0);
    mejor = c;
  }

  return mejor;
}

export function formatearHora(fecha) {
  return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export function describirFecha(fecha, ahora = new Date()) {
  if (!fecha) return 'sin fecha';
  const a = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const f = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const diffDias = Math.round((f.getTime() - a.getTime()) / 86400000);

  let dia;
  if (diffDias === 0) dia = 'hoy';
  else if (diffDias === 1) dia = 'manana';
  else if (diffDias === 2) dia = 'pasado manana';
  else if (diffDias > 0) {
    dia = `el ${fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`;
  } else {
    dia = `el ${fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`;
  }

  return `${dia} a las ${formatearHora(fecha)}`;
}

export function limpiarTitulo(original) {
  let t = String(original || '');
  const patrones = [
    /^(oye\s+)?nexus[,]?\s*/i,
    /\bpor favor\b/gi,
    /\b(recu[eé]rdame|record[aá]rme|recuerdame|recuerda(me)?|av[ií]same|avisame|avisa(me)?)\b/gi,
    /\b(pon(me|er)?|crea(r)?|programa(r)?|agrega(r)?|a[nñ]ade|an[oó]ta(me)?|establece(r)?|configura(r)?|despi[eé]rtame)\b/gi,
    /\bun(a|o)?\s+(recordatorio|alarma|despertador|aviso|temporizador|timer)\b/gi,
    /\b(recordatorio|alarma|despertador|aviso|temporizador|timer)\b/gi,
    /\ba\s+la(?:s)?\s+(\d{1,2}|[a-zñ]+)(\s+y\s+(media|cuarto|\d{1,2}|[a-zñ]+))?/gi,
    /\ben\s+(\d{1,2}|[a-zñ]+)\s+(minutos?|horas?|segundos?|d[ií]as?|semanas?)\b/gi,
    /\b(de\s+la\s+ma[nñ]ana|de\s+la\s+tarde|de\s+la\s+noche|en\s+la\s+ma[nñ]ana|en\s+la\s+tarde|en\s+la\s+noche|esta\s+(ma[nñ]ana|tarde|noche)|de\s+la\s+madrugada|en\s+la\s+madrugada)\b/gi,
    /\b(hoy|ma[nñ]ana|pasado\s+ma[nñ]ana)\b/gi,
    /\b(el\s+|pr[oó]ximo\s+|la\s+pr[oó]xima\s+)?(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)\b/gi,
    /\b(am|pm|a\.m\.|p\.m\.)\b/gi,
    /\b(media\s+noche|mediod[ií]a)\b/gi,
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/gi,
  ];

  patrones.forEach((re) => {
    t = t.replace(re, ' ');
  });

  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/^[\s,.:;-]+/, '').replace(/[\s,.:;-]+$/, '');

  const LEADING = /^(de|del|para|que|a|al|el|la|los|las|un|una)\s+/i;
  const TRAILING = /\s+(de|del|para|el|la|los|las|que|a|al)$/i;
  const SOLO = /^(de|del|para|que|a|al|el|la|los|las|un|una)$/i;

  let previo;
  do {
    previo = t;
    t = t.replace(LEADING, '').trim();
  } while (t !== previo && LEADING.test(t));

  do {
    previo = t;
    t = t.replace(TRAILING, '').trim();
  } while (t !== previo && TRAILING.test(t));

  if (SOLO.test(t)) t = '';

  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const SALUDOS = /\b(hola|buenos d[ií]as|buenas tardes|buenas noches|hey|qu[eé] tal)\b/;
const AYUDA = /\b(qu[eé] puedes hacer|ayuda|comandos|para qu[eé] sirves|qu[eé] sabes hacer)\b/;
const HORA_ACTUAL = /\b(qu[eé] hora es|dime la hora|qu[eé] hora)\b/;
const LISTAR = /\b(recordatorios?|alarmas?|pendientes?|agenda)\b/;
const ELIMINAR = /\b(borra|borrar|elimina|eliminar|cancela|cancelar|quita|quitar)\b/;
const TIPO_ALARMA = /\b(alarma|despertador|despi[eé]rtame|despertar)\b/;

export function procesarOrden(original, ahora = new Date()) {
  const texto = normalizar(original);

  if (!texto) {
    return { intent: 'desconocido' };
  }

  if (HORA_ACTUAL.test(texto)) {
    return { intent: 'hora', horaActual: formatearHora(ahora) };
  }

  if (AYUDA.test(texto)) {
    return { intent: 'ayuda' };
  }

  if (SALUDOS.test(texto) && texto.split(' ').length <= 4) {
    return { intent: 'saludo' };
  }

  if (ELIMINAR.test(texto)) {
    const cual = texto.match(/\b(recordatorio|alarma|despertador|aviso)\b/);
    const todo = /\b(todos|todas|todo)\b/.test(texto);
    return {
      intent: 'eliminar',
      tipo: cual && /alarma|despertador/.test(cual[1]) ? 'alarma' : cual ? 'recordatorio' : null,
      todas: todo,
    };
  }

  if (LISTAR.test(texto) && /\b(mis|que|muestra|lista|listar|dime|ver|cu[aá]les|tengo|cuales)\b/.test(texto)) {
    return { intent: 'listar' };
  }

  const tipo = TIPO_ALARMA.test(texto) ? 'alarma' : 'recordatorio';
  const titulo = limpiarTitulo(original);
  const fecha = resolverFecha(texto, ahora);
  const mencionaTiempo =
    /\d|a\s+la|en\s+|hoy|manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo|tarde|noche|mediodia|madrugada/.test(
      texto
    );

  if (!fecha) {
    return {
      intent: 'crear',
      tipo,
      titulo,
      fecha: null,
      error: mencionaTiempo
        ? 'No entendi bien la fecha u hora. Intenta: "recuerdame llamar a mama manana a las 3 de la tarde".'
        : 'Dime a que hora quieres el recordatorio. Ejemplo: "recuerdame tomar agua en 20 minutos".',
    };
  }

  if (fecha.getTime() <= ahora.getTime()) {
    return {
      intent: 'crear',
      tipo,
      titulo,
      fecha: null,
      error: 'Esa hora ya paso. Dime una hora futura para programarlo.',
    };
  }

  return {
    intent: 'crear',
    tipo,
    titulo: titulo || (tipo === 'alarma' ? 'Alarma' : 'Recordatorio'),
    fecha,
  };
}
