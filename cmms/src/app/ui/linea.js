/* OEE de LÍNEA: horas de línea (cuánto de cada pérdida detuvo efectivamente la producción). */
import { $, esc, h1, n0, pc, pp, soles, banda, cssVar, dialogo, registrarExportador } from './comun.js';
import { E, escuchar, resultadoPara, periodoVigente } from '../servicio.js';
import { CATEGORIAS } from '../../core/oee.js';
import { etiquetaMes, mesesDelPeriodo } from '../../core/calendario.js';
import * as Cascada from './cascada.js';
import { imprimir, tablaPDF } from './pdf.js';

let grafico = null;
const visible = () => $('v-linea').classList.contains('on');

export function poblarMeses(idD, idH) {
  const meses = mesesDelPeriodo(periodoVigente()), op = meses.map(m => '<option value="' + m + '">' + etiquetaMes(m) + '</option>').join('');
  const d = $(idD).value, h = $(idH).value;
  $(idD).innerHTML = op; $(idH).innerHTML = op;
  $(idD).value = meses.indexOf(d) >= 0 ? d : meses[0]; $(idH).value = meses.indexOf(h) >= 0 ? h : meses[meses.length - 1];
}
export function leerMeses(idD, idH) {
  let d = $(idD).value, h = $(idH).value; if (d > h) { const t = d; d = h; h = t; $(idD).value = d; $(idH).value = h; }
  const meses = mesesDelPeriodo(periodoVigente());
  return (d === meses[0] && h === meses[meses.length - 1]) ? {} : { desde: d, hasta: h };
}
export function avisoVacio(vista, r) {
  const n = Object.values(r.conteos).reduce((a, b) => a + b, 0), sec = $(vista);
  sec.querySelector('.vacio-oee').style.display = n ? 'none' : 'block';
  sec.querySelector('.vacio-oee').innerHTML = '<h2>Sin registros operativos en el periodo</h2><p class="nota">Descargue las plantillas y cargue los Excel en <b>Registros y carga</b>; los indicadores se recalculan automáticamente.</p>';
  sec.querySelector('.con-datos').style.display = n ? '' : 'none';
  return n > 0;
}
const filtros = () => Object.assign(leerMeses('lDesde', 'lHasta'), $('lTurno').value ? { turno: $('lTurno').value } : {});
const resultado = () => resultadoPara(filtros());

export function montar() {
  ['lDesde', 'lHasta', 'lTurno'].forEach(id => $(id).addEventListener('change', pintar));
  $('lLimpiar').onclick = () => { poblarMeses('lDesde', 'lHasta'); $('lDesde').selectedIndex = 0; $('lHasta').selectedIndex = $('lHasta').options.length - 1; $('lTurno').value = ''; pintar(); };
  $('lPdf').onclick = pdf;
  escuchar('recalculo', () => { if (visible()) pintar(); });
  escuchar('config', () => poblarMeses('lDesde', 'lHasta'));
  poblarMeses('lDesde', 'lHasta');
  registrarExportador('lb1', () => { const T = resultado().linea.total; return { titulo: 'Indicadores de la línea', encabezados: ['Indicador', 'Valor'], porcentaje: true,
    filas: [['Disponibilidad', { v: T.D, s: 10 }], ['Rendimiento', { v: T.R, s: 10 }], ['Calidad', { v: T.Q, s: 10 }], ['OEE de línea', { v: T.OEE, s: 10 }], ['Producción (láminas)', Math.round(T.produccion)],
      ['Brecha técnica (pp)', +(T.brecha * 100).toFixed(2)], ['Impacto económico (S/)', Math.round(T.impacto)], ['Tiempo de carga (h)', +T.carga.toFixed(1)], ['Tiempo de valor añadido (h)', +T.va.toFixed(1)]] }; });
  registrarExportador('lb3', () => { const r = resultado(); return { titulo: 'Evolución mensual del OEE de línea', canvas: $('gLEvol'), encabezados: ['Mes', 'Disponibilidad', 'Rendimiento', 'Calidad', 'OEE'],
    filas: r.meses.map(m => [etiquetaMes(m)].concat(['D', 'R', 'Q', 'OEE'].map(k => ({ v: +r.linea[m][k].toFixed(4), s: 10 })))) }; });
  registrarExportador('lb4', () => ({ titulo: 'Pérdidas de la línea', encabezados: ['Categoría', 'Componente', 'Horas-máquina', 'Horas de línea', 'Valor (S/)'], filas: filasPerdidas(resultado()).map(f => [f.nombre, f.comp, +f.hm.toFixed(1), +f.hl.toFixed(1), Math.round(f.valor)]) }));
}

function filasPerdidas(r) {
  const L = r.linea.total, HM = r.lineaHM.total;
  return CATEGORIAS.map(c => ({ k: c.k, nombre: c.nombre, comp: { D: 'Disponibilidad', R: 'Rendimiento', Q: 'Calidad' }[c.comp], hm: HM[c.k], hl: L.perdidas[c.k], valor: L.valorPerdidas[c.k] }));
}

export function pintar() {
  const r = resultado();
  if (!avisoVacio('v-linea', r)) return;
  const T = r.linea.total, ms = r.meses, u = ms[ms.length - 1], a = ms[ms.length - 2], P = E.periodo;
  const tarjeta = (k, nombre) => {
    const v = T[k], d = a ? r.linea[u][k] - r.linea[a][k] : null, b = banda(v);
    const fl = d == null ? '' : d > 0.0005 ? '<span class="sube">▲</span>' : d < -0.0005 ? '<span class="baja">▼</span>' : '▶';
    return '<div class="kpi" style="--c:' + b.c + '"><div class="k">' + nombre + '</div><div class="v">' + pc(v) + '</div><div class="d">' + fl + ' ' + (d == null ? 'un solo mes' : pp(d) + ' · ' + etiquetaMes(u) + ' vs ' + etiquetaMes(a)) + '</div><div class="j">' + b.t + '</div></div>';
  };
  $('lKpis').innerHTML = tarjeta('D', 'Disponibilidad') + tarjeta('R', 'Rendimiento') + tarjeta('Q', 'Calidad') + tarjeta('OEE', 'OEE de línea');
  $('lBanda').innerHTML = [[n0(T.produccion), 'Producción, láminas (valor añadido × ' + P.capacidad_cuello_botella + ' lám/h)'], [pp(T.brecha), 'Brecha vs benchmark ' + (P.benchmark_oee * 100).toFixed(2) + ' %'],
    [soles(T.impacto), 'Impacto: ' + n0(T.laminasBrecha) + ' láminas × S/ ' + P.margen_unitario], [h1(T.mttoPrograma) + ' h', 'Mantenimiento del programa ejecutado (' + r.mantenimiento.ordenes + ' órdenes)']]
    .map(x => '<div class="m"><div class="v">' + x[0] + '</div><div class="k">' + x[1] + '</div></div>').join('');
  $('lCascada').innerHTML = Cascada.tarjetas(r.cal.total, T, 'lc');
  $('lCascada').querySelectorAll('[data-etapa]').forEach(b => b.onclick = () => Cascada.detalle('Cascada de la línea · ' + (r.meses.length === 12 ? 'periodo completo' : etiquetaMes(r.meses[0]) + ' a ' + etiquetaMes(u)), r.cal.total, T, r, m => r.linea[m]));
  $('lPerdidas').innerHTML = '<thead><tr><th>Categoría</th><th>Afecta a</th><th class="num">Horas-máquina</th><th class="num">Horas de línea</th><th class="num">Valor perdido</th></tr></thead><tbody>' +
    filasPerdidas(r).map(f => '<tr class="clic" data-k="' + f.k + '"><td class="nombre">' + esc(f.nombre) + '</td><td class="chico">' + f.comp + '</td><td class="num">' + h1(f.hm) + '</td><td class="num"><b>' + h1(f.hl) + '</b></td><td class="num">' + soles(f.valor) + '</td></tr>').join('') +
    '<tr class="total"><td>Total</td><td></td><td class="num">' + h1(filasPerdidas(r).reduce((s, f) => s + f.hm, 0)) + '</td><td class="num">' + h1(filasPerdidas(r).reduce((s, f) => s + f.hl, 0)) + '</td><td class="num">' + soles(filasPerdidas(r).reduce((s, f) => s + f.valor, 0)) + '</td></tr></tbody>';
  $('lPerdidas').querySelectorAll('[data-k]').forEach(tr => tr.onclick = () => detallePerdida(r, tr.dataset.k));
  const t = cssVar('--muted'), g = cssVar('--border');
  if (grafico) grafico.destroy();
  grafico = new Chart($('gLEvol'), { type: 'line', data: { labels: r.meses.map(etiquetaMes), datasets: [
    { label: 'OEE de línea', data: r.meses.map(m => +(r.linea[m].OEE * 100).toFixed(2)), borderColor: cssVar('--lima'), backgroundColor: cssVar('--lima'), borderWidth: 3, tension: 0.2 },
    { label: 'Benchmark ' + (P.benchmark_oee * 100).toFixed(2) + ' %', data: r.meses.map(() => P.benchmark_oee * 100), borderColor: '#8b7bff', borderDash: [6, 4], pointRadius: 0 },
    { label: 'Objetivo ' + (P.objetivo_oee * 100).toFixed(0) + ' %', data: r.meses.map(() => P.objetivo_oee * 100), borderColor: '#ffb020', borderDash: [2, 4], pointRadius: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: t } } }, scales: { x: { ticks: { color: t }, grid: { color: g } }, y: { suggestedMin: 0, suggestedMax: 100, ticks: { color: t, callback: v => v + ' %' }, grid: { color: g } } } } });
}

/* Reparto de una categoría: por máquina (horas-máquina → horas de línea) y por mes. */
function detallePerdida(r, k) {
  const c = CATEGORIAS.find(x => x.k === k), eqs = r.equipos;
  const filas = eqs.map(e => ({ n: e.nombre, t: e.topologia, h: r.maquina[e.id].total.perdidas[k] })).filter(f => f.h > 0.0005);
  const lineaNota = { reuniones: 'Una parada de emergencia de toda la línea cuenta una sola vez en la línea, no por cada máquina.', auxiliares: 'Las fallas de auxiliares detienen la línea: cuentan una vez con su duración registrada.',
    vacio: 'En la línea el vacío es el camino crítico del arranque (retraso + caldero + máximo de proceso), no la suma de las máquinas.' }[k] || 'Serie: 100 % a la línea · paralelo y soporte según los factores de Parámetros.';
  dialogo(c.nombre, '<div class="rejilla c2"><div><h3>Por máquina (horas-máquina)</h3><div class="tabla-caja"><table><thead><tr><th>Máquina</th><th>Topología</th><th class="num">Horas</th></tr></thead><tbody>' +
    (filas.length ? filas.map(f => '<tr><td class="nombre">' + esc(f.n) + '</td><td class="chico">' + f.t + '</td><td class="num">' + h1(f.h) + '</td></tr>').join('') : '<tr><td colspan="3" class="chico tenue">Sin horas</td></tr>') +
    '<tr class="total"><td>Horas de línea</td><td></td><td class="num">' + h1(r.linea.total.perdidas[k]) + '</td></tr></tbody></table></div><p class="nota">' + lineaNota + '</p></div>' +
    '<div><h3>Por mes (horas de línea)</h3><div class="tabla-caja"><table><thead><tr><th>Mes</th><th class="num">Horas</th></tr></thead><tbody>' + r.meses.map(m => '<tr><td>' + etiquetaMes(m) + '</td><td class="num">' + h1(r.linea[m].perdidas[k]) + '</td></tr>').join('') + '</tbody></table></div></div></div>', undefined, 900);
}

function pdf() {
  const r = resultado(), T = r.linea.total, P = E.periodo, f = filtros();
  const cad = Cascada.filasCadena(r.cal.total, T).filter(x => x[2] === 'tot' || Math.abs(x[1]) > 0.0005);
  imprimir({ titulo: 'OEE de', acento: 'línea', subtitulo: 'Línea de láminas antiabrasivas · ' + P.nombre, archivo: 'OEE_de_linea',
    filtros: ['Meses: ' + etiquetaMes(r.meses[0]) + ' a ' + etiquetaMes(r.meses[r.meses.length - 1]), 'Turno: ' + (f.turno || 'ambos'), 'Horas de línea'],
    kpis: [[pc(T.D), 'Disponibilidad'], [pc(T.R), 'Rendimiento'], [pc(T.Q), 'Calidad'], [pc(T.OEE), 'OEE de línea'], [n0(T.produccion), 'Láminas'], [pp(T.brecha), 'Brecha vs ' + (P.benchmark_oee * 100).toFixed(2) + ' %']],
    secciones: [
      { titulo: 'Cascada de tiempos', html: tablaPDF([{ t: 'Concepto' }, { t: 'Horas', n: true }], cad.map(x => [x[0], h1(x[1])]).concat([['OEE = D × R × C', pc(T.OEE)]]), cad.map(x => x[2] === 'tot' ? 'tot' : '').concat(['tot'])) },
      { titulo: 'Pérdidas de la línea', html: tablaPDF([{ t: 'Categoría' }, { t: 'Afecta a' }, { t: 'Horas-máquina', n: true }, { t: 'Horas de línea', n: true }, { t: 'Valor perdido', n: true }], filasPerdidas(r).map(x => [x.nombre, x.comp, h1(x.hm), h1(x.hl), soles(x.valor)])) },
      { titulo: 'Evolución mensual', html: tablaPDF([{ t: 'Mes' }, { t: 'Carga (h)', n: true }, { t: 'Valor añadido (h)', n: true }, { t: 'D', n: true }, { t: 'R', n: true }, { t: 'C', n: true }, { t: 'OEE', n: true }, { t: 'Láminas', n: true }],
        r.meses.map(m => { const x = r.linea[m]; return [etiquetaMes(m), h1(x.carga), h1(x.va), pc(x.D), pc(x.R), pc(x.Q), pc(x.OEE), n0(x.produccion)]; })) + '<p class="nota">OEE de línea calculado con horas de línea según la topología (serie 100 %; paralelo y soporte según los factores de Parámetros; reuniones una sola vez; vacío por camino crítico). Impacto económico: ' + soles(T.impacto) + ' (' + n0(T.laminasBrecha) + ' láminas × S/ ' + P.margen_unitario + ').</p>' }
    ] });
}
