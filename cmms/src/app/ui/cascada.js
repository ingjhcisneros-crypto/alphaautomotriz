/* Cascada de tiempos (6 etapas) compartida por las vistas de línea y de máquina: resumen primero, detalle a
   pedido. Una sola implementación para no repetir la misma tabla en varios lugares. */
import { esc, h1, pc, dialogo, banda } from './comun.js';
import { etiquetaMes } from '../../core/calendario.js';

export const ETAPAS = [
  { e: 'A', t: 'Tiempo total de producción', s: 'calendario − no programado' },
  { e: 'B', t: 'Tiempo de carga', s: '− almuerzos, capacitación, mantenimiento' },
  { e: 'C', t: 'Tiempo bruto', s: '− paradas no planificadas' },
  { e: 'D', t: 'Tiempo neto', s: '− pérdidas de rendimiento' },
  { e: 'E', t: 'Valor añadido', s: '− pérdidas de calidad' },
  { e: 'O', t: 'OEE', s: 'disponibilidad × rendimiento × calidad' }
];

/* Valor de cada etapa. cal: calendario del mes o del periodo; x: cadena (línea o máquina). */
export function valores(cal, x) {
  return { A: cal.totalProduccion, B: x.carga, C: x.bruto, D: x.neto, E: x.va, O: x.OEE };
}
export function tarjetas(cal, x, idPrefijo) {
  const v = valores(cal, x);
  return ETAPAS.map(s => '<button class="etapa-b" data-etapa="' + s.e + '" id="' + idPrefijo + s.e + '"><b>' + s.e.replace('O', '6') + ' · ' + s.t + '</b><div class="vv"' +
    (s.e === 'O' ? ' style="color:' + banda(v.O).c + '"' : '') + '>' + (s.e === 'O' ? pc(v.O) : h1(v[s.e]) + ' h') + '</div><span>' + s.s + '</span></button>').join('');
}

/* Filas de la cadena completa (lo que se resta en cada etapa). */
export function filasCadena(cal, x) {
  const p = x.perdidas, mt = (x.mttoPrograma || 0);
  return [
    ['Tiempo calendario', cal.calendario, ''], ['− Periodos omitidos', -(cal.hOmitidos || 0), ''], ['− Domingos', -cal.hDomingos, ''], ['− Feriados', -cal.hFeriados, ''], ['− Turno no laborable', -cal.hNoTurno, ''],
    ['A · Tiempo total de producción', cal.totalProduccion, 'tot'],
    ['− Almuerzos', -cal.almuerzo, ''], ['− Capacitaciones', -cal.capacitacion, ''], ['− Mantenimiento planificado fuera del programa', -cal.mtto, ''], ['− Mantenimiento del programa ejecutado (planificado y calidad)', -mt, ''],
    ['B · Tiempo de carga', x.carga, 'tot'],
    ['− Mantenimiento correctivo', -p.correctivo, ''], ['− Setup interno', -p.setup, ''], ['− Reuniones de emergencia', -p.reuniones, ''], ['− Fallas de equipos auxiliares', -p.auxiliares, ''],
    ['C · Tiempo bruto · Disponibilidad ' + pc(x.D), x.bruto, 'tot'],
    ['− Microparadas', -p.microparadas, ''], ['− Operación en vacío', -p.vacio, ''],
    ['D · Tiempo neto · Rendimiento ' + pc(x.R), x.neto, 'tot'],
    ['− Defectos de calidad', -p.defectos, ''], ['− Reprocesos', -p.reprocesos, ''],
    ['E · Tiempo de valor añadido · Calidad ' + pc(x.Q), x.va, 'tot']
  ];
}
export function tablaCadena(cal, x) {
  return '<table><tbody>' + filasCadena(cal, x).filter(f => f[2] === 'tot' || Math.abs(f[1]) > 0.0005).map(f => '<tr class="' + (f[2] === 'tot' ? 'total' : '') + '"><td>' + esc(f[0]) + '</td><td class="num">' + h1(f[1]) + ' h</td></tr>').join('') +
    '<tr class="total"><td>OEE = D × R × C</td><td class="num">' + pc(x.OEE) + '</td></tr></tbody></table>';
}
/* Tabla mensual (solo cuando se pide). */
export function tablaMensual(r, obtener) {
  const filas = r.meses.map(m => ({ m, x: obtener(m), cal: r.cal[m] }));
  return '<div class="tabla-caja"><table><thead><tr><th>Mes</th><th class="num">A (h)</th><th class="num">Carga (h)</th><th class="num">Bruto (h)</th><th class="num">Neto (h)</th><th class="num">Valor añadido (h)</th><th class="num">D</th><th class="num">R</th><th class="num">C</th><th class="num">OEE</th></tr></thead><tbody>' +
    filas.map(f => '<tr><td class="nombre">' + etiquetaMes(f.m) + '</td><td class="num">' + h1(f.cal.totalProduccion) + '</td><td class="num">' + h1(f.x.carga) + '</td><td class="num">' + h1(f.x.bruto) + '</td><td class="num">' + h1(f.x.neto) + '</td><td class="num">' + h1(f.x.va) +
      '</td><td class="num">' + pc(f.x.D) + '</td><td class="num">' + pc(f.x.R) + '</td><td class="num">' + pc(f.x.Q) + '</td><td class="num"><b style="color:' + banda(f.x.OEE).c + '">' + pc(f.x.OEE) + '</b></td></tr>').join('') + '</tbody></table></div>';
}
/* Diálogo de detalle: resumen de la cadena + botón para desplegar la evolución mensual. */
export function detalle(titulo, cal, x, r, obtenerMes) {
  const html = '<div class="rejilla c4" style="margin-bottom:var(--s4)">' + [['Disponibilidad', x.D], ['Rendimiento', x.R], ['Calidad', x.Q], ['OEE', x.OEE]].map(k => '<div class="pastilla"><div class="v" style="color:' + banda(k[1]).c + '">' + pc(k[1]) + '</div><div class="k">' + k[0] + '</div></div>').join('') + '</div>' +
    '<div class="tabla-caja">' + tablaCadena(cal, x) + '</div>' +
    (r && obtenerMes ? '<details class="fold" style="margin-top:var(--s4)"><summary>Ver evolución mensual <span class="hint">' + r.meses.length + ' meses</span></summary><div class="cuerpo">' + tablaMensual(r, obtenerMes) + '</div></details>' : '');
  return dialogo(titulo, html, undefined, 980);
}
