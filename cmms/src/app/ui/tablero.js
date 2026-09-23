/* Tablero de OEE: seis bloques, todos gobernados por los mismos filtros globales. */
import { $, esc, h1, n0, pc, pp, soles, banda, cssVar, dialogo, registrarExportador, colorExport } from './comun.js';
import { E, fijarFiltros, escuchar } from '../servicio.js';
import { CATEGORIAS } from '../../core/oee.js';
import { etiquetaMes, mesesDelPeriodo } from '../../core/calendario.js';

const CAT7 = [
  { k: 'correctivo', n: 'Mantenimiento correctivo' }, { k: 'setup', n: 'Setup interno' }, { k: 'reuniones', n: 'Reuniones de emergencia' },
  { k: 'auxiliares', n: 'Fallas de auxiliares' }, { k: 'microparadas', n: 'Microparadas' }, { k: 'vacio', n: 'Operación en vacío' }, { k: 'calidad', n: 'No conformidades' }
];
const COL_CAT = ['#ff5470', '#ffb020', '#8b7bff', '#4cc3ff', '#3dea24', '#2fc61b', '#ff8a3d'];
const graf = {};
let modoPerdidas = 'linea', maqSuperpuestas = [];
const sumCal = p => (p.defectos || 0) + (p.reprocesos || 0);

export function montar() {
  ['fDesde', 'fHasta', 'fEtapa', 'fTopo', 'fTurno'].forEach(id => $(id).addEventListener('change', aplicar));
  $('fLimpiar').onclick = () => { E.filtros = {}; poblarFiltros(true); aplicar(); };
  $('b4Modo').querySelectorAll('.pest').forEach(b => b.onclick = () => { $('b4Modo').querySelectorAll('.pest').forEach(x => x.classList.toggle('on', x === b)); modoPerdidas = b.dataset.m; bloque4(E.resultado); });
  ['b6Cat', 'b6Eq', 'b6Top'].forEach(id => $(id).addEventListener('change', () => bloque6(E.resultado)));
  escuchar('recalculo', () => { if (visible()) pintar(); });
  escuchar('config', () => poblarFiltros(true));
  registrarExportadores();
}
const visible = () => $('v-tablero').classList.contains('on');

export function poblarFiltros(forzar) {
  const meses = mesesDelPeriodo(E.periodo);
  const op = (sel, vals, fn) => { const v = sel.value; sel.innerHTML = vals.map(fn).join(''); if (!forzar && v) sel.value = v; };
  op($('fDesde'), meses, m => '<option value="' + m + '">' + etiquetaMes(m) + '</option>');
  op($('fHasta'), meses, m => '<option value="' + m + '">' + etiquetaMes(m) + '</option>');
  if (forzar || !E.filtros.desde) { $('fDesde').value = meses[0]; $('fHasta').value = meses[meses.length - 1]; }
  const etapas = Array.from(new Set(E.equipos.map(e => e.etapa)));
  op($('fEtapa'), [''].concat(etapas), e => '<option value="' + esc(e) + '">' + (e || 'Todas') + '</option>');
  if (forzar) { $('fEtapa').value = ''; $('fTopo').value = ''; $('fTurno').value = ''; }
  const sel = new Set(E.filtros.equipos || []);
  $('fEquipos').innerHTML = E.equipos.filter(e => e.activo).map(e => '<label class="chip"><input type="checkbox" value="' + e.id + '"' + (sel.has(e.id) ? ' checked' : '') + '> ' + esc(e.nombre) + '</label>').join('');
  $('fEquipos').querySelectorAll('input').forEach(i => i.onchange = aplicar);
  $('b3Maq').innerHTML = E.equipos.filter(e => e.activo).map(e => '<label class="chip"><input type="checkbox" value="' + e.id + '"' + (maqSuperpuestas.indexOf(e.id) >= 0 ? ' checked' : '') + '> ' + esc(e.nombre) + '</label>').join('');
  $('b3Maq').querySelectorAll('input').forEach(i => i.onchange = () => { maqSuperpuestas = Array.from($('b3Maq').querySelectorAll('input:checked')).map(x => x.value); bloque3(E.resultado); });
  $('b6Cat').innerHTML = '<option value="">Todas las categorías</option>' + CATEGORIAS.map(c => '<option value="' + c.k + '">' + c.nombre + '</option>').join('');
  $('b6Eq').innerHTML = '<option value="">Todos los equipos</option>' + E.equipos.map(e => '<option>' + esc(e.nombre) + '</option>').join('') + (E.listas.equipo_auxiliar || []).map(a => '<option>' + esc(a) + '</option>').join('');
}

function aplicar() {
  let d = $('fDesde').value, h = $('fHasta').value;
  if (d > h) { const t = d; d = h; h = t; $('fDesde').value = d; $('fHasta').value = h; }
  const eqs = Array.from($('fEquipos').querySelectorAll('input:checked')).map(i => i.value);
  fijarFiltros({ desde: d, hasta: h, equipos: eqs, etapa: $('fEtapa').value, topologia: $('fTopo').value, turno: $('fTurno').value });
}

export function pintar() {
  const r = E.resultado; if (!r) return;
  const nReg = Object.values(r.conteos).reduce((a, b) => a + b, 0);
  $('tabVacio').style.display = nReg ? 'none' : 'block';
  ['b1', 'b2', 'b5', 'b6'].forEach(id => $(id).style.display = nReg ? '' : 'none');
  document.querySelector('#v-tablero .dos-bloques').style.display = nReg ? '' : 'none';
  $('tabVacio').innerHTML = '<h2>Sistema sin registros operativos</h2><p class="nota">El CMMS se instaló solo con catálogos y parámetros del periodo. Descargue las plantillas y cargue el primer Excel en <b>Registros y carga</b>; el tablero se recalcula automáticamente.</p>';
  const sel = r.seleccion.length, act = r.equipos.length;
  $('fAviso').textContent = 'Periodo ' + etiquetaMes(r.meses[0] || E.periodo.fecha_inicio.slice(0, 7)) + ' a ' + etiquetaMes(r.meses[r.meses.length - 1] || E.periodo.fecha_fin.slice(0, 7)) +
    ' · ' + sel + ' de ' + act + ' equipos' + (E.filtros.turno ? ' · turno ' + E.filtros.turno + ' (tiempo de carga proporcional al turno)' : '') +
    (sel < act ? ' · En el OEE de línea, el filtro de equipos restringe correctivo, setup, microparadas y calidad; reuniones, auxiliares y vacío de arranque son propios de la línea y se conservan.' : '');
  if (!nReg) return;
  bloque1(r); bloque2(r); bloque3(r); bloque4(r); bloque5(r); bloque6(r);
}

function bloque1(r) {
  const T = r.linea.total, ms = r.meses, u = ms[ms.length - 1], a = ms[ms.length - 2];
  const tarjeta = (k, nombre) => {
    const v = T[k], vu = u ? r.linea[u][k] : null, va = a ? r.linea[a][k] : null, d = (vu != null && va != null) ? vu - va : null;
    const flecha = d == null ? '' : d > 0.0005 ? '<span class="sube">▲</span>' : d < -0.0005 ? '<span class="baja">▼</span>' : '<span>▶</span>';
    const b = banda(v);
    return '<div class="kpi" style="--c:' + b.c + '"><div class="k">' + nombre + '</div><div class="v">' + pc(v) + '</div>' +
      '<div class="d">' + flecha + ' ' + (d == null ? 'sin mes anterior' : pp(d) + ' · ' + etiquetaMes(u) + ' vs ' + etiquetaMes(a)) + '</div><div class="j">' + b.t + '</div></div>';
  };
  $('kpiLinea').innerHTML = tarjeta('D', 'Disponibilidad') + tarjeta('R', 'Rendimiento') + tarjeta('Q', 'Calidad') + tarjeta('OEE', 'OEE de línea');
  const P = E.periodo;
  $('kpiLinea2').innerHTML = [
    [n0(T.produccion), 'Producción del periodo, láminas (valor añadido × ' + P.capacidad_cuello_botella + ' lám/h)'],
    [pp(T.brecha), 'Brecha técnica vs benchmark ' + (P.benchmark_oee * 100).toFixed(2) + ' %'],
    [soles(T.impacto), 'Impacto económico: ' + n0(T.laminasBrecha) + ' láminas × S/ ' + P.margen_unitario],
    [h1(T.carga) + ' h', 'Tiempo de carga'], [h1(T.va) + ' h', 'Tiempo de valor añadido']
  ].map(x => '<div class="m"><div class="v">' + x[0] + '</div><div class="k">' + x[1] + '</div></div>').join('');
}

function celda(v, attrs) {
  if (v == null || !isFinite(v)) return '<td class="num"' + attrs + '>—</td>';
  const b = banda(v);
  return '<td class="num calor-c ' + b.k + '"' + attrs + ' title="' + b.t + '">' + pc(v) + '</td>';
}
function bloque2(r) {
  const eqs = r.equipos.filter(e => r.seleccion.indexOf(e.id) >= 0);
  let h = '<thead><tr><th>Equipo</th>' + r.meses.map(m => '<th class="num">' + etiquetaMes(m) + '</th>').join('') + '<th class="num">Periodo</th></tr></thead><tbody>';
  eqs.forEach(e => {
    h += '<tr><td class="nombre">' + esc(e.nombre) + '<div class="sub">' + e.topologia + '</div></td>' +
      r.meses.map(m => celda(r.maquina[e.id][m].OEE, ' data-eq="' + e.id + '" data-mes="' + m + '"')).join('') + celda(r.maquina[e.id].total.OEE, ' data-eq="' + e.id + '" data-mes="total"') + '</tr>';
  });
  h += '<tr class="total"><td>OEE de línea</td>' + r.meses.map(m => celda(r.linea[m].OEE, ' data-eq="LINEA" data-mes="' + m + '"')).join('') + celda(r.linea.total.OEE, ' data-eq="LINEA" data-mes="total"') + '</tr></tbody>';
  $('tCruzada').innerHTML = h;
  $('tCruzada').querySelectorAll('td[data-eq]').forEach(td => td.onclick = () => detalle(td.dataset.eq, td.dataset.mes));
}

export function detalle(id, mes) {
  const r = E.resultado, esL = id === 'LINEA';
  const x = esL ? r.linea[mes] : r.maquina[id][mes];
  const nom = esL ? 'Línea (horas de línea)' : r.equipos.find(e => e.id === id).nombre;
  const p = x.perdidas;
  const fila = (n, v, cls) => '<tr class="' + (cls || '') + '"><td>' + n + '</td><td class="num">' + h1(v) + '</td></tr>';
  const tabla = '<table><tbody>' + fila('B. Tiempo de carga', x.carga, 'total') +
    fila('− Mantenimiento correctivo', -p.correctivo) + fila('− Setup interno', -p.setup) + fila('− Reuniones de emergencia', -p.reuniones) + fila('− Fallas de equipos auxiliares', -p.auxiliares) +
    fila('C. Tiempo bruto · Disponibilidad ' + pc(x.D), x.bruto, 'total') + fila('− Microparadas', -p.microparadas) + fila('− Operación en vacío', -p.vacio) +
    fila('D. Tiempo neto · Rendimiento ' + pc(x.R), x.neto, 'total') + fila('− Defectos de calidad', -p.defectos) + fila('− Reprocesos', -p.reprocesos) +
    fila('E. Tiempo de valor añadido · Calidad ' + pc(x.Q), x.va, 'total') + '</tbody></table>';
  const tot = CATEGORIAS.reduce((a, c) => a + p[c.k], 0) || 1;
  const barras = CATEGORIAS.map(c => '<div class="desg"><span>' + c.nombre + '</span><div class="barrita"><i style="width:' + (p[c.k] / tot * 100).toFixed(1) + '%"></i></div><b>' + h1(p[c.k]) + ' h · ' + (p[c.k] / tot * 100).toFixed(1) + ' %</b></div>').join('');
  const b = banda(x.OEE);
  dialogo(nom + ' · ' + (mes === 'total' ? 'periodo completo' : etiquetaMes(mes)),
    '<div class="rejilla c4" style="margin-bottom:var(--s4)">' + [['Disponibilidad', x.D], ['Rendimiento', x.R], ['Calidad', x.Q], ['OEE', x.OEE]].map(k => '<div class="pastilla"><div class="v">' + pc(k[1]) + '</div><div class="k">' + k[0] + '</div></div>').join('') + '</div>' +
    '<p class="chico" style="color:' + b.c + '">Clasificación: ' + b.t + (esL ? '' : ' · ' + (x.n_fallas || 0) + ' fallas correctivas') + '</p>' +
    '<div class="rejilla c2"><div class="tabla-caja">' + tabla + '</div><div><h3>Desglose de paradas por categoría</h3>' + barras + '</div></div>', undefined, 900);
}

function base(tipo, datos, opciones) {
  const txt = cssVar('--muted') || '#8b9aab', grid = cssVar('--border') || 'rgba(255,255,255,.08)';
  return { type: tipo, data: datos, options: Object.assign({ responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { labels: { color: txt, boxWidth: 12, font: { family: 'Poppins', size: 11 } } }, tooltip: { mode: 'index', intersect: false } },
    scales: { x: { ticks: { color: txt }, grid: { color: grid } }, y: { ticks: { color: txt }, grid: { color: grid } } } }, opciones || {}) };
}
function dibujar(id, cfg) { if (graf[id]) graf[id].destroy(); graf[id] = new Chart($(id), cfg); return graf[id]; }

function bloque3(r) {
  const P = E.periodo, lab = r.meses.map(etiquetaMes);
  const ds = [{ label: 'OEE de línea', data: r.meses.map(m => +(r.linea[m].OEE * 100).toFixed(2)), borderColor: cssVar('--lima'), backgroundColor: cssVar('--lima'), borderWidth: 3, tension: 0.2 },
    { label: 'Benchmark ' + (P.benchmark_oee * 100).toFixed(2) + ' %', data: r.meses.map(() => P.benchmark_oee * 100), borderColor: '#8b7bff', borderDash: [6, 4], pointRadius: 0, borderWidth: 2 },
    { label: 'Objetivo de la empresa ' + (P.objetivo_oee * 100).toFixed(2) + ' %', data: r.meses.map(() => P.objetivo_oee * 100), borderColor: '#ffb020', borderDash: [2, 4], pointRadius: 0, borderWidth: 2 }];
  const pal = ['#4cc3ff', '#ff5470', '#ff8a3d', '#c77dff', '#00d4aa', '#f6d55c', '#9aa5b1', '#ff66c4', '#7bd389', '#5b8def'];
  maqSuperpuestas.forEach((id, i) => { if (r.maquina[id]) ds.push({ label: r.equipos.find(e => e.id === id).nombre, data: r.meses.map(m => +(r.maquina[id][m].OEE * 100).toFixed(2)), borderColor: pal[i % pal.length], borderWidth: 1.5, tension: 0.2 }); });
  dibujar('gEvol', base('line', { labels: lab, datasets: ds }, { scales: { x: { ticks: { color: cssVar('--muted') } }, y: { ticks: { color: cssVar('--muted'), callback: v => v + ' %' }, suggestedMin: 0, suggestedMax: 100 } } }));
}

function perdidasMes(r, m) {
  const p = modoPerdidas === 'linea' ? r.linea[m].perdidas : r.lineaHM[m];
  return CAT7.map(c => c.k === 'calidad' ? sumCal(p) : p[c.k]);
}
function bloque4(r) {
  const ds = CAT7.map((c, i) => ({ label: c.n, data: r.meses.map(m => +perdidasMes(r, m)[i].toFixed(1)), backgroundColor: COL_CAT[i], stack: 's' }));
  dibujar('gPerdidas', base('bar', { labels: r.meses.map(etiquetaMes), datasets: ds }, { scales: { x: { stacked: true, ticks: { color: cssVar('--muted') } }, y: { stacked: true, ticks: { color: cssVar('--muted'), callback: v => v + ' h' } } } }));
}

function bloque5(r) {
  let h = '<thead><tr><th>Equipo</th><th>Topología</th><th class="num">Tiempo bruto (h)</th><th class="num">N° de fallas</th><th class="num">Horas de parada</th><th class="num">MTBF (h)</th><th class="num">MTTR (h)</th><th class="num">Disp. inherente</th><th>Validez estadística</th></tr></thead><tbody>';
  r.confiabilidad.forEach(c => {
    const cls = c.validez === 'Suficiente' ? 'm-ok' : c.validez === 'Limitada' ? 'm-warn' : 'm-bad';
    h += '<tr><td class="nombre">' + esc(c.nombre) + '</td><td>' + c.topologia + '</td><td class="num">' + h1(c.bruto) + '</td><td class="num">' + c.n + '</td><td class="num">' + h1(c.horas) +
      '</td><td class="num">' + h1(c.mtbf) + '</td><td class="num">' + (c.mttr == null ? '—' : c.mttr.toFixed(2)) + '</td><td class="num">' + pc(c.dinh) + '</td><td><span class="marcador ' + cls + '">' + c.validez + '</span></td></tr>';
  });
  $('tConf').innerHTML = h + '</tbody>';
}

function datosPareto(r) {
  const cat = $('b6Cat').value, eqn = $('b6Eq').value, top = +$('b6Top').value;
  const m = {};
  r.pareto.filter(x => (!cat || x.cat === cat) && (!eqn || x.equipo === eqn)).forEach(x => { const k = x.causa || '(sin causa)'; m[k] = (m[k] || 0) + x.horas; });
  const orden = Object.entries(m).sort((a, b) => b[1] - a[1]);
  const tot = orden.reduce((a, x) => a + x[1], 0) || 1;
  let ac = 0;
  return orden.slice(0, top).map(([c, h]) => { ac += h; return { causa: c, horas: h, pct: h / tot, acum: ac / tot }; });
}
function bloque6(r) {
  const d = datosPareto(r);
  dibujar('gPareto', base('bar', { labels: d.map(x => x.causa.length > 42 ? x.causa.slice(0, 40) + '…' : x.causa),
    datasets: [{ type: 'bar', label: 'Horas perdidas', data: d.map(x => +x.horas.toFixed(1)), backgroundColor: '#ff8a3d', yAxisID: 'y' },
      { type: 'line', label: '% acumulado', data: d.map(x => +(x.acum * 100).toFixed(1)), borderColor: cssVar('--lima'), backgroundColor: cssVar('--lima'), yAxisID: 'y2' }] },
  { scales: { x: { ticks: { color: cssVar('--muted'), maxRotation: 60, minRotation: 30 } }, y: { ticks: { color: cssVar('--muted'), callback: v => v + ' h' } }, y2: { position: 'right', min: 0, max: 100, ticks: { color: cssVar('--muted'), callback: v => v + ' %' }, grid: { display: false } } } }));
}

function registrarExportadores() {
  registrarExportador('b1', () => { const r = E.resultado, T = r.linea.total; return { titulo: 'Indicadores de línea', encabezados: ['Indicador', 'Valor'],
    filas: [['Disponibilidad', { v: T.D, s: 10 }], ['Rendimiento', { v: T.R, s: 10 }], ['Calidad', { v: T.Q, s: 10 }], ['OEE de línea', { v: T.OEE, s: 10 }], ['Producción (láminas)', Math.round(T.produccion)],
      ['Brecha técnica (pp)', +(T.brecha * 100).toFixed(2)], ['Impacto económico (S/)', Math.round(T.impacto)], ['Tiempo de carga (h)', +T.carga.toFixed(1)], ['Tiempo de valor añadido (h)', +T.va.toFixed(1)]], porcentaje: true }; });
  registrarExportador('b2', () => { const r = E.resultado, eqs = r.equipos.filter(e => r.seleccion.indexOf(e.id) >= 0);
    const filas = eqs.map(e => [e.nombre].concat(r.meses.map(m => ({ v: +r.maquina[e.id][m].OEE.toFixed(4), s: 10 })), [{ v: +r.maquina[e.id].total.OEE.toFixed(4), s: 10 }]));
    filas.push(['OEE de línea'].concat(r.meses.map(m => ({ v: +r.linea[m].OEE.toFixed(4), s: 10 })), [{ v: +r.linea.total.OEE.toFixed(4), s: 10 }]));
    return { titulo: 'OEE por máquina y por mes', encabezados: ['Equipo'].concat(r.meses.map(etiquetaMes), ['Periodo']), filas, porcentaje: true,
      colores: filas.map(f => f.map((c, j) => j ? colorExport(c.v) : null)) }; });
  registrarExportador('b3', () => { const r = E.resultado; return { titulo: 'Evolución mensual del OEE de línea', canvas: $('gEvol'), encabezados: ['Mes', 'OEE de línea', 'Benchmark', 'Objetivo'].concat(maqSuperpuestas.map(id => r.equipos.find(e => e.id === id).nombre)),
    filas: r.meses.map(m => [etiquetaMes(m), { v: +r.linea[m].OEE.toFixed(4), s: 10 }, { v: E.periodo.benchmark_oee, s: 10 }, { v: E.periodo.objetivo_oee, s: 10 }].concat(maqSuperpuestas.map(id => ({ v: +r.maquina[id][m].OEE.toFixed(4), s: 10 })))) }; });
  registrarExportador('b4', () => { const r = E.resultado; return { titulo: 'Composición de pérdidas · ' + (modoPerdidas === 'linea' ? 'horas de línea' : 'horas-máquina'), canvas: $('gPerdidas'),
    encabezados: ['Mes'].concat(CAT7.map(c => c.n)), filas: r.meses.map(m => [etiquetaMes(m)].concat(perdidasMes(r, m).map(v => +v.toFixed(1)))) }; });
  registrarExportador('b5', () => ({ titulo: 'Confiabilidad por equipo', encabezados: ['Equipo', 'Topología', 'Tiempo bruto (h)', 'N° de fallas', 'Horas de parada', 'MTBF (h)', 'MTTR (h)', 'Disponibilidad inherente', 'Validez'],
    filas: E.resultado.confiabilidad.map(c => [c.nombre, c.topologia, +c.bruto.toFixed(1), c.n, +c.horas.toFixed(1), c.mtbf == null ? '—' : +c.mtbf.toFixed(1), c.mttr == null ? '—' : +c.mttr.toFixed(2), c.dinh == null ? '—' : { v: +c.dinh.toFixed(4), s: 10 }, c.validez]) }));
  registrarExportador('b6', () => ({ titulo: 'Pareto de causas por horas perdidas', canvas: $('gPareto'), encabezados: ['Causa', 'Horas', '% del total', '% acumulado'],
    filas: datosPareto(E.resultado).map(x => [x.causa, +x.horas.toFixed(2), { v: +x.pct.toFixed(4), s: 10 }, { v: +x.acum.toFixed(4), s: 10 }]) }));
}
