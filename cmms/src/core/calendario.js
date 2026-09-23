/* Calendario de producción. Fechas como texto local 'AAAA-MM-DDTHH:MM' y aritmética en UTC
   para que el resultado no dependa de la zona horaria del equipo donde se abre la aplicación. */

export const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic'];

export function aMin(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso || '');
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) / 60000;
}
export function deMin(min) {
  const d = new Date(Math.round(min) * 60000);
  const p = n => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + 'T' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
}
export const horasEntre = (a, b) => (aMin(b) - aMin(a)) / 60;
export const soloFecha = iso => String(iso).slice(0, 10);
export const mesDe = iso => String(iso).slice(0, 7);
export function sumarDias(fecha, n) { return deMin(aMin(fecha) + n * 1440).slice(0, 10); }
export function diaSemana(fecha) { return new Date(aMin(fecha) * 60000).getUTCDay(); }
export const hhmm = iso => String(iso).slice(11, 16);
export const aHoras = hm => { const p = String(hm || '0:0').split(':'); return (+p[0] || 0) + (+p[1] || 0) / 60; };

/* Fecha de Excel (serie) o Date local → texto local. */
export function desdeDate(d) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
}
export function desdeSerieExcel(v) {
  const ms = Math.round((v - 25569) * 86400000 / 60000) * 60000;
  return deMin(ms / 60000);
}
/* Acepta 'dd/mm/aaaa hh:mm', 'aaaa-mm-dd hh:mm', Date o número de serie. */
export function parsearFecha(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : desdeDate(v);
  if (typeof v === 'number') return v > 20000 && v < 80000 ? desdeSerieExcel(v) : null;
  const s = String(v).trim();
  let m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(s);
  if (m) return valida(+m[3], +m[2], +m[1], +(m[4] || 0), +(m[5] || 0));
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(s);
  if (m) return valida(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0));
  return null;
}
function valida(y, mo, d, h, mi) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const iso = deMin(Date.UTC(y, mo - 1, d, h, mi) / 60000);
  return +iso.slice(8, 10) === d ? iso : null;
}

/* Regla del turno 2: lo ocurrido antes de la hora de corte pertenece al día de producción anterior. */
export function diaProduccion(iso, corte = '02:00') {
  const f = soloFecha(iso);
  return hhmm(iso || '00:00').length === 5 && (hhmm(iso) < corte) ? sumarDias(f, -1) : f;
}

/* Feriados nacionales del Perú: fijos más Jueves y Viernes Santo. Solo se usa para sembrar la configuración. */
function pascua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return y + '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
}
const FIJOS = [['01-01','Año nuevo'],['05-01','Día del trabajo'],['06-07','Batalla de Arica'],['06-29','San Pedro y San Pablo'],
  ['07-23','Día de la Fuerza Aérea'],['07-28','Fiestas Patrias'],['07-29','Fiestas Patrias'],['08-06','Batalla de Junín'],
  ['08-30','Santa Rosa de Lima'],['10-08','Combate de Angamos'],['11-01','Todos los Santos'],['12-08','Inmaculada Concepción'],
  ['12-09','Batalla de Ayacucho'],['12-25','Navidad']];
export function feriadosPeru(desde, hasta) {
  const out = [];
  for (let y = +desde.slice(0, 4); y <= +hasta.slice(0, 4); y++) {
    FIJOS.forEach(f => out.push({ fecha: y + '-' + f[0], motivo: f[1] }));
    const p = pascua(y);
    out.push({ fecha: sumarDias(p, -3), motivo: 'Jueves Santo' }, { fecha: sumarDias(p, -2), motivo: 'Viernes Santo' });
  }
  return out.filter(x => x.fecha >= desde && x.fecha <= hasta).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
}

/* Clasificación de cada día del periodo y resumen por mes. */
export function diasDelPeriodo(periodo) {
  const fer = new Set((periodo.feriados || []).map(f => f.fecha));
  const out = [];
  for (let f = periodo.fecha_inicio; f <= periodo.fecha_fin; f = sumarDias(f, 1)) {
    const dom = diaSemana(f) === 0, esFer = fer.has(f);
    out.push({ fecha: f, mes: mesDe(f), domingo: dom, feriado: esFer && !dom, feriadoDomingo: esFer && dom,
      laborable: !dom && !esFer, dow: diaSemana(f) });
  }
  return out;
}
export function esLaborable(fecha, periodo) {
  if (diaSemana(fecha) === 0) return false;
  return !(periodo.feriados || []).some(f => f.fecha === fecha);
}
export function mesesDelPeriodo(periodo) {
  const out = [];
  let y = +periodo.fecha_inicio.slice(0, 4), m = +periodo.fecha_inicio.slice(5, 7);
  const fin = periodo.fecha_fin.slice(0, 7);
  for (;;) {
    const k = y + '-' + String(m).padStart(2, '0');
    if (k > fin) break;
    out.push(k);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}
export const etiquetaMes = k => MESES_CORTOS[+k.slice(5, 7) - 1] + '-' + k.slice(2, 4);

/* Horas operativas entre dos instantes (ventana diaria de los días laborables). Se usa para medir
   el tiempo entre fallas sobre el reloj de planta y no sobre el reloj calendario. */
export function horasOperativasEntre(a, b, periodo) {
  const ini = aHoras(periodo.hora_inicio), dur = periodo.turnos_dia * periodo.horas_turno;
  let t0 = aMin(a), t1 = aMin(b);
  if (!(t1 > t0)) return 0;
  let total = 0;
  for (let f = sumarDias(soloFecha(a), -1); f <= soloFecha(b); f = sumarDias(f, 1)) {
    if (!esLaborable(f, periodo)) continue;
    const w0 = aMin(f) + ini * 60, w1 = w0 + dur * 60;
    total += Math.max(0, Math.min(t1, w1) - Math.max(t0, w0));
  }
  return total / 60;
}
