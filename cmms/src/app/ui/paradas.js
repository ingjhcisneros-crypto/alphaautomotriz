/* Análisis de paradas por máquina y tipo: correctivo, cambio de formato, auxiliares, paradas cortas, operación
   en vacío y reuniones de emergencia. Las horas salen del mismo motor del OEE (fuente única); los registros solo
   aportan el detalle de eventos y causas. */
import { $, esc, h1, n0, pc, cssVar, dialogo, registrarExportador, descargar, XLSX_MIME, libroTabla, fechaArchivo } from './comun.js';
import { E, escuchar, resultadoPara, registrosDelPeriodo } from '../servicio.js';
import { etiquetaMes } from '../../core/calendario.js';
import { normCmp } from '../../core/util.js';
import { poblarMeses, leerMeses, avisoVacio } from './linea.js';
import { imprimir, tablaPDF } from './pdf.js';

const fecha = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) + ' ' + s.slice(11, 16) : '';
const interna = r => normCmp(r.clasificacion_actual) === 'interna';
/* Afectación de una falla de auxiliar a una máquina (mismo reparto que el motor del OEE). */
function parteAux(r, id) {
  const ids = ((E.config.etapas_afectadas || {})[r.etapa_afectada] || []).filter(x => E.equipos.some(e => e.id === x && e.activo));
  if (ids.indexOf(id) < 0) return 0;
  return E.config.reparto_auxiliares === 'completo' ? r.horas : r.horas / (ids.length || 1);
}
export const TIPOS = [
  { k: 'correctivo', n: 'Correctivo', hm: 'correctivo', reg: 'correctivo', de: (r, id) => r.equipo_id === id ? r.horas : 0, causa: r => r.causa_raiz, det: r => r.componente_fallado + ' · ' + r.modo_falla + ' · ' + r.sistema_afectado },
  { k: 'formato', n: 'Cambio de formato', hm: 'setup', reg: 'cambio_formato', de: (r, id) => r.equipo_id === id && interna(r) ? +r.duracion_actividad_h || 0 : 0, causa: r => r.actividad, det: r => r.n_cambio + ' · ' + r.formato_saliente + ' → ' + r.formato_entrante, evento: r => r.n_cambio },
  { k: 'auxiliares', n: 'Equipos auxiliares', hm: 'auxiliares', reg: 'equipos_auxiliares', de: parteAux, causa: r => r.equipo_auxiliar + ' · ' + r.causa_raiz, det: r => r.etapa_afectada + ' · ' + r.componente_fallado },
  { k: 'cortas', n: 'Paradas cortas', hm: 'microparadas', reg: 'paradas_cortas', de: (r, id) => r.equipo_id === id ? r.horas : 0, causa: r => r.tipo_evento, det: r => r.actividad_cil + ' · ' + r.condicion_detectada },
  { k: 'vacio', n: 'Operación en vacío', hm: 'vacio', reg: null },
  { k: 'reuniones', n: 'Reuniones de emergencia', hm: 'reuniones', reg: 'reuniones_emergencia', de: (r, id) => { const a = normCmp(r.equipos_afectados); const e = E.equipos.find(x => x.id === id); return (a === normCmp('Toda la línea') || !a || (e && normCmp(e.nombre) === a)) ? r.horas : 0; }, causa: r => r.motivo, det: r => r.equipos_afectados }
];
const visible = () => $('v-paradas').classList.contains('on');
const filtros = () => Object.assign(leerMeses('pDesde', 'pHasta'), $('pTurno').value ? { turno: $('pTurno').value } : {});
const resultado = () => resultadoPara(filtros());

/* Eventos de un tipo para una máquina, dentro de los meses y turno filtrados. */
function eventos(t, id, r) {
  if (!t.reg) return [];
  const meses = new Set(r.meses), tu = $('pTurno').value;
  return registrosDelPeriodo()[t.reg].filter(x => meses.has(x.mes) && (!tu || String(x.turno) === tu)).map(x => ({ x, h: id ? t.de(x, id) : (t.k === 'formato' ? (interna(x) ? +x.duracion_actividad_h || 0 : 0) : x.horas) })).filter(o => o.h > 0);
}
function conteo(t, lista) { return t.evento ? new Set(lista.map(o => t.evento(o.x))).size : lista.length; }
/* Operación en vacío: arranques de jornada y arranques posteriores a un cambio de formato. */
function vacioDe(id, r) {
  const v = registrosDelPeriodo().operacion_en_vacio.find(x => x.equipo_id === id); if (!v) return null;
  const tu = $('pTurno').value, arr = (tu && tu !== '1') ? 0 : r.meses.reduce((a, m) => a + r.cal[m].laborables, 0);
  const meses = new Set(r.meses), camb = new Set(registrosDelPeriodo().cambio_formato.filter(x => x.equipo_id === id && meses.has(x.mes) && (!tu || String(x.turno) === tu)).map(x => x.n_cambio)).size;
  return { arranques: arr, cambios: camb, minA: +v.minutos_arranque, minP: +v.minutos_post_setup, hA: arr * v.minutos_arranque / 60, hP: camb * v.minutos_post_setup / 60 };
}

export function montar() {
  ['pDesde', 'pHasta', 'pTurno', 'pMedida'].forEach(id => $(id).addEventListener('change', pintar));
  ['pCat', 'pEq', 'pTop'].forEach(id => $(id).addEventListener('change', () => pareto(resultado())));
  $('pPdf').onclick = pdf;
  escuchar('recalculo', () => { if (visible()) pintar(); });
  escuchar('config', () => { poblarMeses('pDesde', 'pHasta'); poblarSelects(); });
  poblarMeses('pDesde', 'pHasta'); poblarSelects();
  registrarExportador('pb1', () => { const r = resultado(), M = matriz(r); return { titulo: 'Paradas por máquina y tipo (horas-máquina)', encabezados: ['Máquina'].concat(TIPOS.map(t => t.n + ' (h)'), TIPOS.map(t => t.n + ' (eventos)'), ['Total (h)']),
    filas: M.map(f => [f.e.nombre].concat(f.c.map(c => +c.h.toFixed(2)), f.c.map(c => c.n), [+f.tot.toFixed(2)])) }; });
  registrarExportador('pb2', () => ({ titulo: 'Pareto de causas', canvas: $('gPPareto'), encabezados: ['Causa', 'Horas', 'Eventos', '% acumulado'], filas: datosPareto(resultado()).map(x => [x.causa, +x.h.toFixed(2), x.n, { v: +x.acum.toFixed(4), s: 10 }]) }));
}
function poblarSelects() {
  const c = $('pCat').value, q = $('pEq').value;
  $('pCat').innerHTML = '<option value="">Todos los tipos</option>' + TIPOS.filter(t => t.reg).map(t => '<option value="' + t.k + '">' + t.n + '</option>').join('');
  $('pEq').innerHTML = '<option value="">Todas las máquinas</option>' + E.equipos.filter(e => e.activo).map(e => '<option value="' + e.id + '">' + esc(e.nombre) + '</option>').join('');
  $('pCat').value = c; $('pEq').value = q;
}

function matriz(r) {
  return r.equipos.map(e => {
    const c = TIPOS.map(t => { const h = r.maquina[e.id].total.perdidas[t.hm]; let n;
      if (t.k === 'vacio') { const v = vacioDe(e.id, r); n = v ? v.arranques + v.cambios : 0; } else n = conteo(t, eventos(t, e.id, r));
      return { h, n }; });
    return { e, c, tot: c.reduce((a, x) => a + x.h, 0) };
  });
}

let gPar = null;
export function pintar() {
  const r = resultado();
  if (!avisoVacio('v-paradas', r)) return;
  const M = matriz(r), porN = $('pMedida').value === 'n';
  const max = Math.max(1e-9, ...M.flatMap(f => f.c.map(c => porN ? c.n : c.h)));
  const tot = TIPOS.map((t, j) => M.reduce((a, f) => a + f.c[j].h, 0)), totN = TIPOS.map((t, j) => M.reduce((a, f) => a + f.c[j].n, 0));
  $('pMatriz').innerHTML = '<thead><tr><th>Máquina</th>' + TIPOS.map(t => '<th class="num">' + t.n + '</th>').join('') + '<th class="num">Total (h)</th></tr></thead><tbody>' +
    M.map(f => '<tr><td class="nombre clic" data-maq="' + f.e.id + '">' + esc(f.e.nombre) + '<div class="sub">' + f.e.topologia + '</div></td>' +
      f.c.map((c, j) => { const v = porN ? c.n : c.h, a = Math.min(0.55, v / max * 0.55);
        return '<td class="num celda-par" data-maq="' + f.e.id + '" data-t="' + TIPOS[j].k + '" style="background:rgba(255,84,112,' + a.toFixed(3) + ')">' + (porN ? n0(c.n) : h1(c.h) + ' h') + '<div class="sub">' + (porN ? h1(c.h) + ' h' : n0(c.n) + ' ev.') + '</div></td>'; }).join('') +
      '<td class="num"><b>' + h1(f.tot) + ' h</b></td></tr>').join('') +
    '<tr class="total"><td>Total horas-máquina</td>' + tot.map((h, j) => '<td class="num">' + h1(h) + ' h<div class="sub">' + n0(totN[j]) + ' ev.</div></td>').join('') + '<td class="num">' + h1(tot.reduce((a, b) => a + b, 0)) + ' h</td></tr></tbody>';
  $('pMatriz').querySelectorAll('.celda-par').forEach(td => td.onclick = () => detalle(r, td.dataset.maq, td.dataset.t));
  $('pMatriz').querySelectorAll('td[data-maq]:not(.celda-par)').forEach(td => td.onclick = () => detalleMaquina(r, td.dataset.maq));
  pareto(r);
}

function causas(t, lista) {
  const m = {};
  lista.forEach(o => { const k = t.causa(o.x) || '(sin causa)'; m[k] = m[k] || { causa: k, h: 0, n: 0 }; m[k].h += o.h; m[k].n++; });
  return Object.values(m).sort((a, b) => b.h - a.h);
}
function detalle(r, id, k) {
  const t = TIPOS.find(x => x.k === k), e = r.equipos.find(x => x.id === id), hTot = r.maquina[id].total.perdidas[t.hm];
  const totMaq = TIPOS.reduce((a, x) => a + r.maquina[id].total.perdidas[x.hm], 0);
  const mensual = '<div class="tabla-caja"><table><thead><tr><th>Mes</th><th class="num">Horas</th></tr></thead><tbody>' + r.meses.map(m => '<tr><td>' + etiquetaMes(m) + '</td><td class="num">' + h1(r.maquina[id][m].perdidas[t.hm]) + '</td></tr>').join('') + '</tbody></table></div>';
  let cuerpo;
  if (t.k === 'vacio') {
    const v = vacioDe(id, r);
    cuerpo = v ? '<div class="tabla-caja"><table><thead><tr><th>Origen</th><th class="num">Veces</th><th class="num">Min por vez</th><th class="num">Horas</th></tr></thead><tbody>' +
      '<tr><td>Arranque de jornada</td><td class="num">' + n0(v.arranques) + '</td><td class="num">' + v.minA + '</td><td class="num">' + h1(v.hA) + '</td></tr>' +
      '<tr><td>Después de cambio de formato</td><td class="num">' + n0(v.cambios) + '</td><td class="num">' + v.minP + '</td><td class="num">' + h1(v.hP) + '</td></tr></tbody></table></div><p class="nota">En la línea el vacío se cuenta por camino crítico (retraso + caldero + máximo de proceso), no como suma de máquinas.</p>' : '<p class="nota">Sin parámetros de vacío cargados para este equipo.</p>';
  } else {
    const lista = eventos(t, id, r), cs = causas(t, lista), n = conteo(t, lista), mx = lista.reduce((a, o) => Math.max(a, o.h), 0);
    cuerpo = '<div class="banda chica" style="margin-bottom:var(--s4)">' + [[n0(n), 'Eventos'], [h1(hTot) + ' h', 'Horas-máquina'], [n ? h1(hTot / n) + ' h' : '—', 'Duración media por evento'], [h1(mx) + ' h', 'Evento más largo'], [pc(totMaq ? hTot / totMaq : 0), 'De las paradas de la máquina']]
      .map(x => '<div class="m"><div class="v">' + x[0] + '</div><div class="k">' + x[1] + '</div></div>').join('') + '</div>' +
      '<h3>Causas principales</h3><div class="tabla-caja"><table><thead><tr><th>Causa</th><th class="num">Eventos</th><th class="num">Horas</th><th class="num">%</th></tr></thead><tbody>' +
      cs.slice(0, 10).map(c => '<tr><td>' + esc(c.causa) + '</td><td class="num">' + c.n + '</td><td class="num">' + h1(c.h) + '</td><td class="num">' + pc(hTot ? c.h / hTot : 0) + '</td></tr>').join('') + '</tbody></table></div>' +
      '<details class="fold" style="margin-top:var(--s3)"><summary>Ver los ' + lista.length + ' registros <span class="hint">los 50 más largos</span></summary><div class="cuerpo"><div class="tabla-caja"><table><thead><tr><th>Inicio</th><th class="num">Horas</th><th>Causa</th><th>Detalle</th></tr></thead><tbody>' +
      lista.slice().sort((a, b) => b.h - a.h).slice(0, 50).map(o => '<tr><td class="chico">' + fecha(o.x.inicio) + '</td><td class="num">' + h1(o.h) + '</td><td>' + esc(t.causa(o.x)) + '</td><td class="chico">' + esc(t.det(o.x)) + '</td></tr>').join('') + '</tbody></table></div>' +
      '<button class="btn btn-ghost btn-sm" data-xls style="margin-top:var(--s3)"><i class="fas fa-file-excel"></i> Descargar todos en Excel</button></div></details>';
  }
  const bot = [{ t: 'Cerrar', v: null }]; bot.onMontar = capa => { const b = capa.querySelector('[data-xls]'); if (b) b.onclick = () => {
    const lista = eventos(t, id, r); descargar(libroTabla('Eventos', ['Inicio', 'Horas', 'Causa', 'Detalle'], lista.map(o => [fecha(o.x.inicio), +o.h.toFixed(3), t.causa(o.x), t.det(o.x)]), t.n + ' · ' + e.nombre), 'Paradas_' + t.k + '_' + id + '_' + fechaArchivo() + '.xlsx', XLSX_MIME); }; };
  dialogo(t.n + ' · ' + e.nombre, '<div class="rejilla c2 det-par"><div>' + cuerpo + '</div><div><h3>Por mes</h3>' + mensual + '</div></div>', bot, 1000);
}
function detalleMaquina(r, id) {
  const e = r.equipos.find(x => x.id === id), tot = TIPOS.reduce((a, t) => a + r.maquina[id].total.perdidas[t.hm], 0);
  const filas = TIPOS.map(t => { const lista = t.reg ? eventos(t, id, r) : [], cs = t.reg ? causas(t, lista) : [];
    return '<tr class="clic" data-t="' + t.k + '"><td class="nombre">' + t.n + '</td><td class="num">' + h1(r.maquina[id].total.perdidas[t.hm]) + '</td><td class="num">' + pc(tot ? r.maquina[id].total.perdidas[t.hm] / tot : 0) + '</td><td class="chico">' + (cs[0] ? esc(cs[0].causa) + ' (' + h1(cs[0].h) + ' h)' : t.k === 'vacio' ? 'Arranques de jornada' : '—') + '</td></tr>'; }).join('');
  const bot = [{ t: 'Cerrar', v: null }]; bot.onMontar = capa => capa.querySelectorAll('[data-t]').forEach(tr => tr.onclick = () => { capa.querySelector('[data-x]').click(); detalle(r, id, tr.dataset.t); });
  dialogo('Paradas de ' + e.nombre, '<div class="tabla-caja"><table><thead><tr><th>Tipo</th><th class="num">Horas</th><th class="num">%</th><th>Causa principal</th></tr></thead><tbody>' + filas + '<tr class="total"><td>Total</td><td class="num">' + h1(tot) + '</td><td class="num">100 %</td><td></td></tr></tbody></table></div><p class="nota">Clic en un tipo para ver sus eventos y causas.</p>', bot, 820);
}

function datosPareto(r) {
  const cat = $('pCat').value, id = $('pEq').value, top = +$('pTop').value, m = {};
  TIPOS.filter(t => t.reg && (!cat || t.k === cat)).forEach(t => eventos(t, id || null, r).forEach(o => { const k = (cat ? '' : t.n + ': ') + (t.causa(o.x) || '(sin causa)'); m[k] = m[k] || { causa: k, h: 0, n: 0 }; m[k].h += o.h; m[k].n++; }));
  const orden = Object.values(m).sort((a, b) => b.h - a.h), tot = orden.reduce((a, x) => a + x.h, 0) || 1; let ac = 0;
  return orden.slice(0, top).map(x => { ac += x.h; return Object.assign(x, { acum: ac / tot }); });
}
function pareto(r) {
  const d = datosPareto(r), t = cssVar('--muted');
  if (gPar) gPar.destroy();
  gPar = new Chart($('gPPareto'), { type: 'bar', data: { labels: d.map(x => x.causa.length > 44 ? x.causa.slice(0, 42) + '…' : x.causa), datasets: [
    { type: 'bar', label: 'Horas', data: d.map(x => +x.h.toFixed(1)), backgroundColor: '#ff8a3d', yAxisID: 'y' },
    { type: 'line', label: '% acumulado', data: d.map(x => +(x.acum * 100).toFixed(1)), borderColor: cssVar('--lima'), backgroundColor: cssVar('--lima'), yAxisID: 'y2' }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: t } } },
      scales: { x: { ticks: { color: t, maxRotation: 60, minRotation: 30 } }, y: { ticks: { color: t, callback: v => v + ' h' } }, y2: { position: 'right', min: 0, max: 100, ticks: { color: t, callback: v => v + ' %' }, grid: { display: false } } } } });
}

function pdf() {
  const r = resultado(), M = matriz(r), f = filtros();
  const secc = [{ titulo: 'Paradas por máquina y tipo (horas-máquina)', html: tablaPDF([{ t: 'Máquina' }].concat(TIPOS.map(t => ({ t: t.n, n: true })), [{ t: 'Total', n: true }]),
    M.map(x => [x.e.nombre].concat(x.c.map(c => h1(c.h) + ' h · ' + c.n), [h1(x.tot) + ' h']))) + '<p class="nota">Cada celda: horas-máquina · número de eventos (en vacío: arranques + cambios de formato).</p>' }];
  TIPOS.filter(t => t.reg).forEach(t => { const cs = causas(t, eventos(t, null, r)); if (cs.length) secc.push({ titulo: t.n + ' · causas principales', html: tablaPDF([{ t: 'Causa' }, { t: 'Eventos', n: true }, { t: 'Horas', n: true }], cs.slice(0, 8).map(c => [c.causa, c.n, h1(c.h)])) }); });
  imprimir({ titulo: 'Análisis de', acento: 'paradas', subtitulo: 'Línea de láminas antiabrasivas · ' + E.periodo.nombre, archivo: 'Analisis_de_paradas',
    filtros: ['Meses: ' + etiquetaMes(r.meses[0]) + ' a ' + etiquetaMes(r.meses[r.meses.length - 1]), 'Turno: ' + (f.turno || 'ambos')],
    kpis: TIPOS.map(t => [h1(M.reduce((a, x) => a + x.c[TIPOS.indexOf(t)].h, 0)) + ' h', t.n]), secciones: secc });
}
