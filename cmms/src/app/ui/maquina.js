/* OEE por MÁQUINA: horas-máquina de cada equipo frente a su propio tiempo de carga, con su confiabilidad. */
import { $, esc, h1, n0, pc, banda, cssVar, registrarExportador, colorExport } from './comun.js';
import { E, escuchar, resultadoPara } from '../servicio.js';
import { CATEGORIAS } from '../../core/oee.js';
import { etiquetaMes } from '../../core/calendario.js';
import * as Cascada from './cascada.js';
import { poblarMeses, leerMeses, avisoVacio } from './linea.js';
import { imprimir, tablaPDF } from './pdf.js';

let grafico = null;
const COL = ['#ff5470', '#ffb020', '#8b7bff', '#4cc3ff', '#3dea24', '#2fc61b', '#ff8a3d', '#c77dff'];
const visible = () => $('v-maquina').classList.contains('on');
function filtros() {
  const f = leerMeses('mDesde', 'mHasta');
  const eqs = Array.from($('mEquipos').querySelectorAll('input:checked')).map(i => i.value);
  if (eqs.length) f.equipos = eqs; if ($('mEtapa').value) f.etapa = $('mEtapa').value; if ($('mTopo').value) f.topologia = $('mTopo').value; if ($('mTurno').value) f.turno = $('mTurno').value;
  return f;
}
const resultado = () => resultadoPara(filtros());
const seleccion = r => r.equipos.filter(e => r.seleccion.indexOf(e.id) >= 0);
const conf = (r, id) => r.confiabilidad.find(c => c.id === id) || {};

function poblar() {
  poblarMeses('mDesde', 'mHasta');
  const et = $('mEtapa').value;
  $('mEtapa').innerHTML = '<option value="">Todas</option>' + Array.from(new Set(E.equipos.map(e => e.etapa))).map(x => '<option>' + esc(x) + '</option>').join(''); $('mEtapa').value = et;
  const sel = new Set(Array.from($('mEquipos').querySelectorAll('input:checked')).map(i => i.value));
  $('mEquipos').innerHTML = E.equipos.filter(e => e.activo).map(e => '<label class="chip"><input type="checkbox" value="' + e.id + '"' + (sel.has(e.id) ? ' checked' : '') + '> ' + esc(e.nombre) + '</label>').join('');
  $('mEquipos').querySelectorAll('input').forEach(i => i.onchange = pintar);
}
export function montar() {
  ['mDesde', 'mHasta', 'mEtapa', 'mTopo', 'mTurno'].forEach(id => $(id).addEventListener('change', pintar));
  $('mPdf').onclick = pdf;
  escuchar('recalculo', () => { if (visible()) pintar(); });
  escuchar('config', poblar);
  poblar();
  registrarExportador('mb1', () => { const r = resultado(); return { titulo: 'Resumen por máquina', encabezados: ['Máquina', 'Topología', 'Carga (h)', 'Bruto (h)', 'Neto (h)', 'Valor añadido (h)', 'Disponibilidad', 'Rendimiento', 'Calidad', 'OEE', 'Fallas', 'MTBF (h)', 'MTTR (h)', 'Disp. inherente', 'Validez'],
    filas: seleccion(r).map(e => { const x = r.maquina[e.id].total, c = conf(r, e.id); return [e.nombre, e.topologia, +x.carga.toFixed(1), +x.bruto.toFixed(1), +x.neto.toFixed(1), +x.va.toFixed(1), { v: +x.D.toFixed(4), s: 10 }, { v: +x.R.toFixed(4), s: 10 }, { v: +x.Q.toFixed(4), s: 10 }, { v: +x.OEE.toFixed(4), s: 10 },
      c.n, c.mtbf == null ? '—' : +c.mtbf.toFixed(1), c.mttr == null ? '—' : +c.mttr.toFixed(2), c.dinh == null ? '—' : { v: +c.dinh.toFixed(4), s: 10 }, c.validez]; }) }; });
  registrarExportador('mb2', () => { const r = resultado(), eqs = seleccion(r);
    const filas = eqs.map(e => [e.nombre].concat(r.meses.map(m => ({ v: +r.maquina[e.id][m].OEE.toFixed(4), s: 10 })), [{ v: +r.maquina[e.id].total.OEE.toFixed(4), s: 10 }]));
    return { titulo: 'OEE por máquina y por mes', encabezados: ['Máquina'].concat(r.meses.map(etiquetaMes), ['Periodo']), filas, porcentaje: true, colores: filas.map(f => f.map((c, j) => j ? colorExport(c.v) : null)) }; });
  registrarExportador('mb3', () => { const r = resultado(); return { titulo: 'Pérdidas por máquina (horas-máquina)', canvas: $('gMPerdidas'), encabezados: ['Máquina'].concat(CATEGORIAS.map(c => c.nombre)),
    filas: seleccion(r).map(e => [e.nombre].concat(CATEGORIAS.map(c => +r.maquina[e.id].total.perdidas[c.k].toFixed(1)))) }; });
}

const celda = (v, a) => { const b = banda(v); return '<td class="num calor-c ' + b.k + '"' + a + ' title="' + b.t + '">' + pc(v) + '</td>'; };
export function pintar() {
  const r = resultado();
  if (!avisoVacio('v-maquina', r)) return;
  const eqs = seleccion(r);
  $('mResumen').innerHTML = '<thead><tr><th>Máquina</th><th class="num">Carga (h)</th><th class="num">Valor añadido (h)</th><th class="num">Disponib.</th><th class="num">Rendim.</th><th class="num">Calidad</th><th class="num">OEE</th><th class="num">Fallas</th><th class="num">MTBF (h)</th><th class="num">MTTR (h)</th><th>Validez</th></tr></thead><tbody>' +
    eqs.map(e => { const x = r.maquina[e.id].total, c = conf(r, e.id), b = banda(x.OEE), cls = c.validez === 'Suficiente' ? 'm-ok' : c.validez === 'Limitada' ? 'm-warn' : 'm-bad';
      return '<tr class="clic" data-eq="' + e.id + '"><td class="nombre">' + esc(e.nombre) + '<div class="sub">' + e.topologia + '</div></td><td class="num">' + h1(x.carga) + '</td><td class="num">' + h1(x.va) + '</td><td class="num">' + pc(x.D) + '</td><td class="num">' + pc(x.R) + '</td><td class="num">' + pc(x.Q) +
        '</td><td class="num"><b style="color:' + b.c + '">' + pc(x.OEE) + '</b></td><td class="num">' + (c.n || 0) + '</td><td class="num">' + h1(c.mtbf) + '</td><td class="num">' + (c.mttr == null ? '—' : c.mttr.toFixed(2)) + '</td><td><span class="marcador ' + cls + '">' + (c.validez || '—') + '</span></td></tr>'; }).join('') + '</tbody>';
  $('mResumen').querySelectorAll('[data-eq]').forEach(tr => tr.onclick = () => abrir(r, tr.dataset.eq, 'total'));
  $('mCruzada').innerHTML = '<thead><tr><th>Máquina</th>' + r.meses.map(m => '<th class="num">' + etiquetaMes(m) + '</th>').join('') + '<th class="num">Periodo</th></tr></thead><tbody>' +
    eqs.map(e => '<tr><td class="nombre">' + esc(e.nombre) + '</td>' + r.meses.map(m => celda(r.maquina[e.id][m].OEE, ' data-eq="' + e.id + '" data-mes="' + m + '"')).join('') + celda(r.maquina[e.id].total.OEE, ' data-eq="' + e.id + '" data-mes="total"') + '</tr>').join('') + '</tbody>';
  $('mCruzada').querySelectorAll('td[data-eq]').forEach(td => td.onclick = () => abrir(r, td.dataset.eq, td.dataset.mes));
  const t = cssVar('--muted'), g = cssVar('--border');
  if (grafico) grafico.destroy();
  grafico = new Chart($('gMPerdidas'), { type: 'bar', data: { labels: eqs.map(e => e.nombre), datasets: CATEGORIAS.map((c, i) => ({ label: c.nombre, data: eqs.map(e => +r.maquina[e.id].total.perdidas[c.k].toFixed(1)), backgroundColor: COL[i], stack: 's' })) },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: t, boxWidth: 12 } }, tooltip: { mode: 'index', intersect: false } },
      scales: { x: { stacked: true, ticks: { color: t, callback: v => v + ' h' }, grid: { color: g } }, y: { stacked: true, ticks: { color: t }, grid: { color: g } } } } });
}

function abrir(r, id, mes) {
  const e = r.equipos.find(x => x.id === id), x = r.maquina[id][mes], cal = mes === 'total' ? r.cal.total : r.cal[mes];
  Cascada.detalle(e.nombre + ' · ' + (mes === 'total' ? 'periodo' : etiquetaMes(mes)), cal, x, mes === 'total' ? r : null, m => r.maquina[id][m]);
}

function pdf() {
  const r = resultado(), eqs = seleccion(r), f = filtros();
  imprimir({ titulo: 'OEE por', acento: 'máquina', subtitulo: 'Línea de láminas antiabrasivas · ' + E.periodo.nombre, archivo: 'OEE_por_maquina',
    filtros: ['Meses: ' + etiquetaMes(r.meses[0]) + ' a ' + etiquetaMes(r.meses[r.meses.length - 1]), 'Turno: ' + (f.turno || 'ambos'), 'Etapa: ' + (f.etapa || 'todas'), 'Topología: ' + (f.topologia || 'todas'), eqs.length + ' equipos', 'Horas-máquina'],
    secciones: [
      { titulo: 'Resumen por máquina', html: tablaPDF([{ t: 'Máquina' }, { t: 'Carga (h)', n: true }, { t: 'V. añadido (h)', n: true }, { t: 'D', n: true }, { t: 'R', n: true }, { t: 'C', n: true }, { t: 'OEE', n: true }, { t: 'Fallas', n: true }, { t: 'MTBF', n: true }, { t: 'MTTR', n: true }, { t: 'Validez' }],
        eqs.map(e => { const x = r.maquina[e.id].total, c = conf(r, e.id); return [e.nombre, h1(x.carga), h1(x.va), pc(x.D), pc(x.R), pc(x.Q), pc(x.OEE), c.n || 0, h1(c.mtbf), c.mttr == null ? '—' : c.mttr.toFixed(2), c.validez]; })) },
      { titulo: 'Pérdidas por máquina (horas-máquina)', html: tablaPDF([{ t: 'Máquina' }].concat(CATEGORIAS.map(c => ({ t: c.nombre, n: true }))), eqs.map(e => [e.nombre].concat(CATEGORIAS.map(c => h1(r.maquina[e.id].total.perdidas[c.k]))))) },
      { titulo: 'OEE mensual', html: tablaPDF([{ t: 'Máquina' }].concat(r.meses.map(m => ({ t: etiquetaMes(m), n: true }))), eqs.map(e => [e.nombre].concat(r.meses.map(m => pc(r.maquina[e.id][m].OEE))))) +
        '<p class="nota">Cada máquina se mide contra su propio tiempo de carga (se descuenta su mantenimiento del programa ejecutado). No es comparable directamente con el OEE de línea, que usa horas de línea.</p>' }
    ] });
}
