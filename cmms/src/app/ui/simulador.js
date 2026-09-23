/* Interfaz del módulo de simulación de eventos discretos. */
import { $, esc, h1, n0, n2, pc, pp, soles, aviso, dialogo, confirmar, registrarExportador, cssVar } from './comun.js';
import { E, escuchar, ajustarModelo, modeloDesactualizado, guardarResultado, escenariosHabilitados, comparacion, guardarEscenario, borrarEscenario } from '../servicio.js';
import { ejecutar } from '../ejecutor.js';
import { emitir } from './pdf.js';
import { DISTRIBUCIONES } from '../../core/estadistica.js';

let tab = 'config', corriendo = false, gAjuste = null, gEsc = null;
const IND = { OEE: 'OEE', D: 'Disponibilidad', R: 'Rendimiento', Q: 'Calidad', produccion: 'Producción (láminas)' };

export function montar() {
  $('simTabs').querySelectorAll('.pest').forEach(b => b.onclick = () => { tab = b.dataset.t; pintar(); });
  $('simAjustar').onclick = async () => { await ajustarModelo(); aviso('Distribuciones ajustadas desde los registros; ejecute la validación de la línea base'); pintar(); };
  $('simValidar').onclick = () => correr(['E0']);
  $('simCorrerTodos').onclick = () => correr(E.escenarios.map(e => e.id));
  $('simNuevoEsc').onclick = nuevoEscenario;
  $('simDistSel').onchange = graficoAjuste;
  $('simIndicador').onchange = graficoEscenarios;
  $('simEscRec').onchange = pintarRecursos;
  $('simPdf').onclick = pdf;
  escuchar('datos', () => avisos());
  escuchar('modelo', () => avisos());
  registrarExportador('simDist', () => E.modelo && { titulo: 'Distribuciones ajustadas', encabezados: ['Equipo', 'Variable', 'Eventos', 'Validez', 'Tratamiento', 'Distribución', 'Parámetros', 'K-S D', 'p-valor'],
    filas: E.modelo.ajustes.map(a => [a.equipo, a.variable, a.n, a.validez, a.tratamiento, a.distribucion || '—', a.params ? JSON.stringify(a.params).slice(0, 120) : '—', a.ks == null ? '—' : +a.ks.toFixed(4), a.p == null ? '—' : +a.p.toFixed(4)]) });
  registrarExportador('simComp', () => { const f = filasComparacion(); return f && { titulo: 'Comparación de escenarios contra la línea base', encabezados: f.enc, filas: f.filas, canvas: null }; });
}

function avisos() {
  const m = E.modelo; let h = '';
  if (!m) h = '<div class="panel aviso-perm warn"><b>Modelo sin ajustar.</b> Ajuste las distribuciones desde los registros cargados antes de simular.</div>';
  else {
    if (modeloDesactualizado()) h += '<div class="panel aviso-perm warn"><b>Distribuciones desactualizadas:</b> se cargaron o editaron registros después del último ajuste (' + new Date(m.creado).toLocaleString('es-PE') + '). <button class="btn btn-primary btn-sm" id="simReajustar">Reajustar ahora</button></div>';
    const d = m.ajustes.filter(a => a.validez !== 'Suficiente' && /entre fallas|reparación/.test(a.variable));
    if (d.length) h += '<div class="panel aviso-perm bad"><b>Advertencia metodológica permanente:</b> ' + d.length + ' variables de confiabilidad se apoyan en muestras con validez limitada o insuficiente; se simulan con distribución empírica o determinística y sin intervalo propio: ' +
      d.map(a => esc(a.equipo) + ' (' + a.n + ' eventos, ' + a.validez.toLowerCase() + ')').join(' · ') + '. Los resultados que dependan de estos equipos deben leerse como órdenes de magnitud.</div>';
  }
  $('simAvisos').innerHTML = h;
  const b = $('simReajustar'); if (b) b.onclick = () => $('simAjustar').click();
}

export function pintar() {
  $('simTabs').querySelectorAll('.pest').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  document.querySelectorAll('#v-simdes .sub-vista').forEach(v => v.classList.toggle('on', v.id === 'sim-' + tab));
  avisos();
  if (tab === 'config') pintarConfig();
  if (tab === 'validacion') pintarValidacion();
  if (tab === 'escenarios') pintarEscenarios();
  if (tab === 'resultados') pintarResultados();
}

function pintarConfig() {
  const m = E.modelo;
  if (!m) { $('simEstadoModelo').innerHTML = '<p class="nota">Aún no hay modelo. Pulse «Ajustar distribuciones desde los registros».</p>'; $('simDist').innerHTML = ''; return; }
  const P = m.proceso;
  $('simEstadoModelo').innerHTML = '<div class="banda chica">' + [
    [new Date(m.creado).toLocaleString('es-PE'), 'Último ajuste'], [modeloDesactualizado() ? 'Desactualizado' : 'Vigente', 'Estado respecto de los registros'],
    [h1(m.carga) + ' h', 'Tiempo de carga del periodo'], [n0(m.dias), 'Días laborables simulados'], [P.calentamiento_dias + ' d', 'Calentamiento descartado'],
    [n2(P.autoclave_ciclo_min) + ' min', 'Ciclo del autoclave (' + (P.ciclo_cuello_segun === 'demostrada' ? 'capacidad demostrada' : 'ficha') + ')'],
    [P.acople_serie === 'flujo' ? 'Flujo con buffers' : 'Rígido', 'Acople de equipos en serie'], [P.replicas + ' – ' + P.replicas_max, 'Réplicas (mín – tope)']
  ].map(x => '<div class="m"><div class="v" style="font-size:1rem">' + x[0] + '</div><div class="k">' + x[1] + '</div></div>').join('') + '</div>' +
    '<p class="nota">Flujo: molino ' + P.molino_lote_kg + ' kg / ' + P.molino_ciclo_min + ' min → extrusora ' + P.extrusora_kg_h + ' kg/h → ' + m.estaciones.filter(e => e.topologia === 'paralelo').length + ' prensas de ' + P.prensa_ciclo_min +
    ' min → buffer de ' + P.buffer_curado + ' → autoclave ' + P.autoclave_lote + ' láminas → acabado ' + P.acabado_lam_h + ' lám/h. Probabilidad diaria de cambio de formato ' + pc(m.probCambio) + ' (' + m.cambios + ' cambios; ' + (m.tiposCambio ? m.tiposCambio.length : 0) + ' tipos de cambio sorteados según su frecuencia, con setup triangular por equipo y tipo cuando hay 3 o más cambios de ese tipo). SMED: interno ' + h1(m.smed.actual) + ' h → ' + h1(m.smed.propuesta) + ' h propuesto (' + pc(m.smed.reduccion) + ' de reducción). Calidad atribuible a variación térmica del vapor: ' + pc(m.calidadTermica.proporcion) + ' de las horas.</p>';
  $('simDist').innerHTML = '<div class="tabla-caja alta"><table><thead><tr><th>Equipo o grupo</th><th>Variable</th><th class="num">Eventos</th><th>Validez</th><th>Tratamiento</th><th>Distribución</th><th>Parámetros</th><th class="num">K-S D</th><th class="num">p-valor</th><th>Candidatos (D)</th></tr></thead><tbody>' +
    m.ajustes.map(a => { const cls = a.validez === 'Suficiente' ? 'm-ok' : a.validez === 'Limitada' ? 'm-warn' : 'm-bad';
      const par = a.distribucion && DISTRIBUCIONES[a.distribucion] ? DISTRIBUCIONES[a.distribucion].texto(a.params) : a.distribucion === 'bernoulli' ? 'p = ' + a.params.p.toFixed(4) : '—';
      return '<tr><td class="nombre">' + esc(a.equipo) + '</td><td>' + esc(a.variable) + '</td><td class="num">' + a.n + '</td><td><span class="marcador ' + cls + '">' + a.validez + '</span></td><td class="chico">' + esc(a.tratamiento) + (a.usada ? ' · usada: ' + esc(a.usada) : '') +
        '</td><td>' + (a.distribucion || '—') + '</td><td class="chico">' + esc(par) + '</td><td class="num">' + (a.ks == null ? '—' : a.ks.toFixed(3)) + '</td><td class="num">' + (a.p == null ? '—' : (a.p < 0.001 ? '< 0.001' : a.p.toFixed(3))) + '</td><td class="chico">' +
        (a.candidatos ? a.candidatos.map(c => c.tipo + ' ' + c.ks.toFixed(3)).join(' · ') : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<p class="nota">Tiempos entre fallas medidos sobre el reloj de planta (ventana operativa de días laborables) y reescalados a MTBF = (tiempo de carga − reparación) ÷ fallas. Un p-valor bajo en duraciones indica que el registro redondea a décimas de hora: el ajuste se reporta igual, pero la media se preserva exactamente.</p>';
  const conMuestra = m.ajustes.map((a, i) => ({ a, i })).filter(x => x.a.muestra && x.a.muestra.length > 1 && x.a.distribucion && DISTRIBUCIONES[x.a.distribucion]);
  const sel = $('simDistSel').value;
  $('simDistSel').innerHTML = conMuestra.map(x => '<option value="' + x.i + '">' + esc(x.a.equipo + ' · ' + x.a.variable + ' (' + x.a.distribucion + ')') + '</option>').join('');
  if (sel && conMuestra.some(x => String(x.i) === sel)) $('simDistSel').value = sel;
  graficoAjuste();
}

function graficoAjuste() {
  const m = E.modelo; if (!m) return; const a = m.ajustes[+$('simDistSel').value]; if (!a) return;
  const xs = a.muestra.slice().sort((p, q) => p - q), n = xs.length, D = DISTRIBUCIONES[a.distribucion];
  const emp = xs.map((x, i) => ({ x, y: (i + 1) / n })), max = xs[n - 1], pts = [];
  for (let i = 0; i <= 80; i++) { const x = max * i / 80; pts.push({ x, y: D.cdf(a.params, x) }); }
  if (gAjuste) gAjuste.destroy();
  const t = cssVar('--muted');
  gAjuste = new Chart($('gAjuste'), { type: 'scatter', data: { datasets: [
    { label: 'Empírica (' + n + ' datos)', data: emp, showLine: true, stepped: true, borderColor: cssVar('--lima'), pointRadius: 0, borderWidth: 2 },
    { label: 'Ajustada: ' + a.distribucion + (a.ks != null ? ' · D = ' + a.ks.toFixed(3) : ''), data: pts, showLine: true, borderColor: '#8b7bff', pointRadius: 0, borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: t } } }, scales: { x: { title: { display: true, text: 'horas', color: t }, ticks: { color: t } }, y: { min: 0, max: 1, ticks: { color: t } } } } });
}

async function correr(ids) {
  if (corriendo) return;
  if (!E.modelo) return aviso('Primero ajuste las distribuciones', 'warn');
  if (modeloDesactualizado()) { if (!(await confirmar('Modelo desactualizado', '<p>Hay registros nuevos desde el último ajuste. ¿Reajustar las distribuciones antes de simular?</p>', 'Reajustar y continuar'))) return; await ajustarModelo(); }
  const orden = ids.indexOf('E0') >= 0 ? ['E0'].concat(ids.filter(i => i !== 'E0')) : ids;
  corriendo = true;
  const barra = tab === 'validacion' ? $('simProgV') : $('simProgE');
  barra.classList.add('on');
  try {
    for (const id of orden) {
      if (id !== 'E0' && !escenariosHabilitados()) { aviso('Escenarios de mejora bloqueados: la línea base no reproduce la realidad dentro de tolerancia', 'bad', 7000); break; }
      const esc_ = E.escenarios.find(e => e.id === id);
      const t0 = performance.now();
      const res = await ejecutar(E.modelo, esc_, E.escenarios, (h, o) => { barra.querySelector('i').style.width = (h / o * 100).toFixed(1) + '%'; barra.querySelector('span').textContent = esc_.nombre + ' · réplica ' + h + ' de ' + o; });
      res.duracionMs = Math.round(performance.now() - t0);
      await guardarResultado(res);
    }
  } catch (e) { aviso('Error en la simulación: ' + e.message, 'bad', 8000); console.error(e); }
  corriendo = false; barra.classList.remove('on');
  pintar();
}

function pintarValidacion() {
  const v = E.validacion, r = E.resultadosSim.E0;
  if (!v || !r) { $('simValidacion').innerHTML = '<p class="nota">La simulación no es válida hasta reproducir la realidad medida. Ejecute la línea base: se compararán sus intervalos de confianza con el OEE real calculado desde los registros.</p>'; return; }
  const fmtV = (f, x) => f.unidad === 'pp' ? pc(x) : n0(x);
  $('simValidacion').innerHTML = '<p><span class="marcador ' + (v.ok ? 'm-ok' : 'm-bad') + '">' + (v.ok ? 'Línea base VALIDADA · escenarios de mejora habilitados' : 'Línea base FUERA DE TOLERANCIA · escenarios de mejora bloqueados') + '</span> <span class="chico tenue">' + r.replicas + ' réplicas · ' + new Date(v.fecha).toLocaleString('es-PE') + (r.duracionMs ? ' · ' + (r.duracionMs / 1000).toFixed(1) + ' s' : '') + '</span></p>' +
    '<div class="tabla-caja"><table><thead><tr><th>Indicador</th><th class="num">Valor real</th><th class="num">Simulado (media)</th><th class="num">IC 95 %</th><th class="num">Desviación</th><th class="num">Tolerancia</th><th>Dentro de tolerancia</th><th>IC contiene el real</th></tr></thead><tbody>' +
    v.filas.map(f => '<tr><td class="nombre">' + f.indicador + '</td><td class="num">' + fmtV(f, f.real) + '</td><td class="num">' + fmtV(f, f.simulado) + '</td><td class="num">' + fmtV(f, f.li) + ' – ' + fmtV(f, f.ls) + '</td><td class="num">' + (f.desvio >= 0 ? '+' : '') + f.desvio.toFixed(2) + ' ' + f.unidad +
      '</td><td class="num">± ' + f.tolerancia + ' ' + f.unidad + '</td><td><span class="marcador ' + (f.ok ? 'm-ok' : 'm-bad') + '">' + (f.ok ? 'Sí' : 'No') + '</span></td><td><span class="marcador ' + (f.icContiene ? 'm-ok' : 'm-warn') + '">' + (f.icContiene ? 'Sí' : 'No') + '</span></td></tr>').join('') + '</tbody></table></div>' +
    '<h3 style="margin-top:var(--s4)">Verificación del modelo</h3><ul class="lista-ver">' + v.verificaciones.map(x => '<li><span class="marcador ' + (x.ok ? 'm-ok' : 'm-bad') + '">' + (x.ok ? 'Cumple' : 'No cumple') + '</span> ' + esc(x.verificacion) + '<div class="chico tenue">' + esc(x.detalle) + '</div></li>').join('') + '</ul>' +
    (v.ok ? '' : '<div class="panel aviso-perm bad"><b>Informe de desviación:</b> ' + v.filas.filter(f => !f.ok).map(f => f.indicador + ' se desvía ' + f.desvio.toFixed(2) + ' ' + f.unidad + ' (tolerancia ± ' + f.tolerancia + ')').concat(v.verificaciones.filter(x => !x.ok).map(x => x.verificacion)).join(' · ') + '</div>');
}

const CAMPOS_ESC = [
  ['mtbf_mejora.EXT', 'Mejora de MTBF · extrusora (%)', 100], ['mtbf_mejora.AUT', 'Mejora de MTBF · autoclave (%)', 100],
  ['preventivo_h_mes.EXT', 'Preventivo programado · extrusora (h/mes)', 1], ['preventivo_h_mes.AUT', 'Preventivo programado · autoclave (h/mes)', 1],
  ['setup_reduccion', 'Reducción del setup interno (% · «datos» = según SMED del registro)', 100], ['nc_termica_eficacia', 'Eficacia del control térmico sobre la NC de origen térmico (%)', 100],
  ['micro_reduccion.MOL', 'Reducción de microparadas · molino (%)', 100], ['encendido_adelanto_min', 'Encendido anticipado de calderos (min)', 1], ['elimina_retraso', 'Elimina el retraso de encendido (sí/no)', 0]
];
const leerP = (p, ruta) => ruta.split('.').reduce((o, k) => o == null ? undefined : o[k], p);
function escribirP(p, ruta, v) { const k = ruta.split('.'); let o = p; for (let i = 0; i < k.length - 1; i++) o = o[k[i]] = o[k[i]] || {}; if (v === undefined) delete o[k[k.length - 1]]; else o[k[k.length - 1]] = v; }

function pintarEscenarios() {
  const hab = escenariosHabilitados();
  $('simEscenarios').innerHTML = (hab ? '' : '<p class="marcador m-warn" style="display:inline-block">Escenarios de mejora bloqueados hasta validar la línea base (pestaña 2).</p>') + E.escenarios.map(e => {
    const r = E.resultadosSim[e.id], comb = e.params && e.params.combinar;
    const campos = comb ? '<div class="chico">Combina: ' + E.escenarios.filter(x => x.id !== e.id && x.id !== 'E0' && !(x.params || {}).combinar).map(x => '<label class="chip"><input type="checkbox" data-comb="' + x.id + '"' + (comb.indexOf(x.id) >= 0 ? ' checked' : '') + '> ' + esc(x.id) + '</label>').join(' ') + '<p class="nota">Se simulan en conjunto, no como suma de efectos.</p></div>'
      : e.id === 'E0' ? '<p class="chico tenue">Reproduce la situación actual con las distribuciones ajustadas.</p>'
        : '<div class="rejilla c3">' + CAMPOS_ESC.map(([ruta, n, f]) => { let v = leerP(e.params || {}, ruta); if (v === 'datos') v = 'datos'; else if (typeof v === 'boolean') v = v ? 'sí' : 'no'; else if (v != null && f === 100) v = +(v * 100).toFixed(2);
          return '<div class="campo"><label>' + n + '</label><input data-ruta="' + ruta + '" data-f="' + f + '" value="' + (v == null ? '' : v) + '" placeholder="sin cambio"></div>'; }).join('') + '</div>';
    return '<div class="esc-tarjeta" data-id="' + e.id + '"><div class="fila" style="justify-content:space-between"><div><b>' + esc(e.nombre) + '</b><div class="chico tenue">' + esc(e.intervencion || '') + '</div></div>' +
      '<div class="fila"><button class="btn btn-ghost btn-sm" data-g="' + e.id + '"><i class="fas fa-floppy-disk"></i> Guardar</button><button class="btn btn-primary btn-sm" data-run="' + e.id + '"' + (e.id !== 'E0' && !hab ? ' disabled' : '') + '><i class="fas fa-play"></i> Ejecutar</button>' +
      (/^E[0-6]$/.test(e.id) ? '' : '<button class="btn btn-danger btn-sm" data-del="' + e.id + '"><i class="fas fa-trash"></i></button>') + '</div></div>' + campos +
      (r ? '<p class="chico" style="margin-top:var(--s2)">Última ejecución ' + new Date(r.fecha).toLocaleString('es-PE') + ' · ' + r.replicas + ' réplicas · OEE ' + pc(r.resumen.OEE.media) + ' [' + pc(r.resumen.OEE.li) + ' – ' + pc(r.resumen.OEE.ls) + '] · producción ' + n0(r.resumen.produccion.media) +
        ' láminas' + (r.parametrosModelo && E.modelo && r.parametrosModelo.huellaDatos !== E.modelo.huellaDatos ? ' <span class="marcador m-warn">ejecutado con otros datos</span>' : '') + '</p>' : '') + '</div>';
  }).join('');
  $('simEscenarios').querySelectorAll('[data-run]').forEach(b => b.onclick = async () => { await guardarDesdeTarjeta(b.dataset.run, true); correr([b.dataset.run]); });
  $('simEscenarios').querySelectorAll('[data-g]').forEach(b => b.onclick = async () => { await guardarDesdeTarjeta(b.dataset.g); aviso('Escenario guardado'); });
  $('simEscenarios').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (await confirmar('Eliminar escenario', '<p>Se elimina el escenario y sus resultados.</p>', 'Eliminar', true)) { await borrarEscenario(b.dataset.del); pintarEscenarios(); } });
}
async function guardarDesdeTarjeta(id, silencioso) {
  const e = JSON.parse(JSON.stringify(E.escenarios.find(x => x.id === id))), t = $('simEscenarios').querySelector('[data-id="' + id + '"]');
  if (!t || id === 'E0') return;
  if (e.params && e.params.combinar) e.params.combinar = Array.from(t.querySelectorAll('[data-comb]:checked')).map(i => i.dataset.comb);
  else {
    e.params = e.params || {};
    t.querySelectorAll('[data-ruta]').forEach(i => {
      const v = i.value.trim(), f = +i.dataset.f, ruta = i.dataset.ruta;
      if (v === '') return escribirP(e.params, ruta, undefined);
      if (ruta === 'setup_reduccion' && /^datos$/i.test(v)) return escribirP(e.params, ruta, 'datos');
      if (ruta === 'elimina_retraso') return escribirP(e.params, ruta, /^s[ií]|true|1$/i.test(v));
      const n = +v.replace(',', '.'); if (isNaN(n)) return aviso('Valor no numérico en ' + ruta, 'bad');
      escribirP(e.params, ruta, f === 100 ? n / 100 : n);
    });
  }
  await guardarEscenario(e);
}
async function nuevoEscenario() {
  const n = await dialogo('Nuevo escenario', '<div class="campo"><label>Nombre</label><input id="nvNom" placeholder="E7 — Mi escenario"></div><div class="campo" style="margin-top:var(--s3)"><label>Intervención</label><input id="nvInt"></div>',
    [{ t: 'Cancelar', v: null }, { t: 'Crear', v: c => ({ nombre: c.querySelector('#nvNom').value.trim(), intervencion: c.querySelector('#nvInt').value.trim() }) }]);
  if (!n || !n.nombre) return;
  let k = 7; while (E.escenarios.some(e => e.id === 'E' + k)) k++;
  await guardarEscenario({ id: 'E' + k, nombre: n.nombre, intervencion: n.intervencion, params: {} }); pintarEscenarios();
}

function filasComparacion() {
  const base = E.resultadosSim.E0; if (!base) return null;
  const enc = ['Escenario', 'Réplicas', 'OEE (media)', 'IC 95 % OEE', 'Δ OEE (pp)', 'p-valor', 'Significativa', 'Δ Disponibilidad (pp)', 'Δ Rendimiento (pp)', 'Δ Calidad (pp)', 'Producción', 'Δ Producción', 'Δ margen S/ (IC 95 %)'];
  const filas = [];
  E.escenarios.forEach(e => {
    const r = E.resultadosSim[e.id]; if (!r) return;
    const c = e.id === 'E0' ? null : comparacion(e.id), o = r.resumen;
    filas.push([e.nombre, r.replicas, pc(o.OEE.media), pc(o.OEE.li) + ' – ' + pc(o.OEE.ls), c ? pp(c.filas[0].delta) : '—', c ? (c.filas[0].p < 0.001 ? '< 0.001' : c.filas[0].p.toFixed(3)) : '—', c ? (c.filas[0].significativa ? 'Sí' : 'No') : '—',
      c ? pp(c.filas[1].delta) : '—', c ? pp(c.filas[2].delta) : '—', c ? pp(c.filas[3].delta) : '—', n0(o.produccion.media), c ? (c.filas[4].delta >= 0 ? '+' : '') + n0(c.filas[4].delta) : '—',
      c ? soles(c.economico.delta) + ' (' + soles(c.economico.li) + ' a ' + soles(c.economico.ls) + ')' : '—']);
  });
  return { enc, filas };
}
function pintarResultados() {
  const f = filasComparacion();
  if (!f) { $('simComp').innerHTML = '<p class="nota">Sin resultados. Valide la línea base y ejecute los escenarios.</p>'; return; }
  $('simComp').innerHTML = '<div class="tabla-caja"><table><thead><tr>' + f.enc.map((h, i) => '<th' + (i ? ' class="num"' : '') + '>' + h + '</th>').join('') + '</tr></thead><tbody>' +
    f.filas.map(r => '<tr>' + r.map((v, i) => i ? '<td class="num">' + (v === 'Sí' ? '<span class="marcador m-ok">Sí</span>' : v === 'No' ? '<span class="marcador m-warn">No</span>' : esc(v)) + '</td>' : '<td class="nombre">' + esc(v) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' +
    '<p class="nota">Δ respecto de E0 con números aleatorios comunes (mismas semillas) y prueba t pareada al 95 %; si el número de réplicas difiere se usa t de Welch. Traducción económica: láminas adicionales × margen unitario de S/ ' + E.periodo.margen_unitario + '.</p>';
  $('simEscRec').innerHTML = E.escenarios.filter(e => E.resultadosSim[e.id]).map(e => '<option value="' + e.id + '">' + esc(e.nombre) + '</option>').join('');
  graficoEscenarios(); pintarRecursos();
}
function graficoEscenarios() {
  const k = $('simIndicador').value, lst = E.escenarios.filter(e => E.resultadosSim[e.id]);
  const f = k === 'produccion' ? 1 : 100, t = cssVar('--muted');
  const med = lst.map(e => +(E.resultadosSim[e.id].resumen[k].media * f).toFixed(2));
  const li = lst.map(e => +(E.resultadosSim[e.id].resumen[k].li * f).toFixed(2)), ls = lst.map(e => +(E.resultadosSim[e.id].resumen[k].ls * f).toFixed(2));
  if (gEsc) gEsc.destroy();
  gEsc = new Chart($('gEscenarios'), { type: 'bar', data: { labels: lst.map(e => e.id), datasets: [
    { label: IND[k] + ' (media)', data: med, backgroundColor: lst.map((e, i) => i === 0 ? '#8b9aab' : cssVar('--lima')) },
    { type: 'line', label: 'IC 95 % inferior', data: li, borderColor: '#ff5470', showLine: false, pointStyle: 'line', pointRadius: 12 },
    { type: 'line', label: 'IC 95 % superior', data: ls, borderColor: '#8b7bff', showLine: false, pointStyle: 'line', pointRadius: 12 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: t } } }, scales: { x: { ticks: { color: t } }, y: { ticks: { color: t } } } } });
  registrarExportador('simGraf', () => ({ titulo: IND[k] + ' por escenario', canvas: $('gEscenarios'), encabezados: ['Escenario', 'Media', 'IC inferior', 'IC superior'], filas: lst.map((e, i) => [e.nombre, med[i], li[i], ls[i]]) }));
}
function pintarRecursos() {
  const r = E.resultadosSim[$('simEscRec').value]; if (!r) { $('simRecursos').innerHTML = ''; return; }
  const s = r.resumen;
  $('simRecursos').innerHTML = '<div class="tabla-caja"><table><thead><tr><th>Recurso</th><th class="num">Utilización</th><th class="num">Productivo (h)</th><th class="num">Parada (h)</th><th class="num">Vacío (h)</th><th class="num">Bloqueado por buffer lleno (h)</th><th class="num">Espera de material (h)</th><th class="num">Balance vs carga</th></tr></thead><tbody>' +
    Object.entries(s.recursos).sort((a, b) => b[1].utilizacion.media - a[1].utilizacion.media).map(([id, x]) => '<tr><td class="nombre">' + esc(x.nombre) + '</td><td class="num">' + pc(x.utilizacion.media) + ' ± ' + (x.utilizacion.semiancho * 100).toFixed(2) +
      '</td><td class="num">' + h1(x.productivo.media) + '</td><td class="num">' + h1(x.parada.media) + '</td><td class="num">' + h1(x.vacio.media) + '</td><td class="num">' + h1(x.bloqueado.media) + '</td><td class="num">' + h1(x.espera.media) + '</td><td class="num">' + (x.balance.media * 100).toFixed(4) + ' %</td></tr>').join('') + '</tbody></table></div>' +
    '<div class="banda chica" style="margin-top:var(--s4)">' + [[n2(s.bufferMedio.media), 'Longitud media del buffer de curado'], [n0(s.bufferMax.media), 'Longitud máxima del buffer'], [h1(s.esperaAutoclave.media) + ' min', 'Espera media antes del autoclave'],
      [h1(s.horasLinea.correctivo.media) + ' h', 'Correctivo (línea)'], [h1(s.horasLinea.setup.media) + ' h', 'Setup interno (línea)'], [h1(s.horasLinea.vacio.media) + ' h', 'Vacío (línea)']].map(x => '<div class="m"><div class="v">' + x[0] + '</div><div class="k">' + x[1] + '</div></div>').join('') + '</div>' +
    '<p class="nota">Horas de parada por categoría (media de réplicas, horas de línea): ' + Object.entries(s.horasLinea).map(([k, v]) => k + ' ' + h1(v.media) + ' ± ' + h1(v.semiancho)).join(' · ') + '.</p>';
}

/* PDF: documento imprimible con la comparación, la validación y los recursos (el navegador lo guarda en PDF). */
function pdf() {
  const f = filasComparacion(); if (!f) return aviso('Sin resultados para exportar', 'warn');
  const w = { document: { write: h => { w.html = h; } } };
  const v = E.validacion;
  const tabla = (enc, filas) => '<table><thead><tr>' + enc.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + filas.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  w.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Resultados de simulación</title><style>body{font-family:Arial,sans-serif;font-size:10pt;color:#16202b;margin:14mm}h1{font-size:15pt;color:#1f5c10}h2{font-size:11pt;margin-top:8mm;color:#1f5c10}table{border-collapse:collapse;width:100%;font-size:8.5pt}th,td{border:1px solid #ccd;padding:3px 5px;text-align:left}th{background:#eef7ea}@page{size:A4 landscape;margin:10mm}</style></head><body>' +
    '<h1>CMMS 4.0 · Simulación de escenarios de la línea de láminas antiabrasivas</h1><p>Periodo ' + esc(E.periodo.nombre) + ' · emitido ' + new Date().toLocaleString('es-PE') + '</p>' +
    (v ? '<h2>Validación de la línea base</h2>' + tabla(['Indicador', 'Real', 'Simulado', 'IC 95 %', 'Desviación', 'Tolerancia', 'Resultado'], v.filas.map(x => [x.indicador, x.unidad === 'pp' ? (x.real * 100).toFixed(2) + ' %' : Math.round(x.real), x.unidad === 'pp' ? (x.simulado * 100).toFixed(2) + ' %' : Math.round(x.simulado), x.unidad === 'pp' ? (x.li * 100).toFixed(2) + ' – ' + (x.ls * 100).toFixed(2) + ' %' : Math.round(x.li) + ' – ' + Math.round(x.ls), x.desvio.toFixed(2) + ' ' + x.unidad, '± ' + x.tolerancia + ' ' + x.unidad, x.ok ? 'Cumple' : 'No cumple'])) : '') +
    '<h2>Comparación contra la línea base</h2>' + tabla(f.enc, f.filas) +
    (E.modelo ? '<h2>Advertencias de validez estadística</h2><ul>' + E.modelo.advertencias.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>' : '') +
    '</body></html>');
  emitir(w.html, 'Resultados_simulacion', true);
}
