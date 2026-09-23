/* Asistente de IA del CMMS (botón flotante). Responde con los datos del propio sistema: se le entrega un
   resumen compacto de todo lo calculado (OEE de línea y de máquina, paradas por tipo, causas, calendario,
   programa, anomalías, simulación) y, cuando el visor lo permite, herramientas para consultar el detalle
   (registros, OEE con filtros, órdenes de trabajo). Usa la capacidad «sample» del artefacto de claude.ai:
   fuera del visor el botón no aparece. Cada consulta consume el uso de Claude de quien pregunta. */
import { $, esc } from './comun.js';
import { E, resultadoPara, registrosDelPeriodo, periodoVigente } from '../servicio.js';
import { REGISTROS } from '../../core/registros.js';
import { CATEGORIAS } from '../../core/oee.js';
import { etiquetaMes, enOmision } from '../../core/calendario.js';
import { TIPOS } from './paradas.js';

let sample = null, herramientas = false, turnos = [], ctl = null, ocupado = false;
const r1 = v => v == null || !isFinite(v) ? null : Math.round(v * 10) / 10;
const p2 = v => v == null || !isFinite(v) ? null : Math.round(v * 10000) / 100;
const nomEq = id => (E.equipos.find(e => e.id === id) || {}).nombre || id;

/* ===== Contexto: lo que el sistema sabe, en poco espacio ===== */
function resumenOEE(r) {
  const L = r.linea.total;
  return {
    linea: { D: p2(L.D), R: p2(L.R), C: p2(L.Q), OEE: p2(L.OEE), carga_h: r1(L.carga), bruto_h: r1(L.bruto), neto_h: r1(L.neto), valor_anadido_h: r1(L.va), produccion_laminas: Math.round(L.produccion),
      brecha_pp: p2(L.brecha), impacto_soles: Math.round(L.impacto || 0), mtto_programa_h: r1(L.mttoPrograma || 0),
      perdidas_horas_linea: Object.fromEntries(CATEGORIAS.map(c => [c.nombre, r1(L.perdidas[c.k])])),
      perdidas_horas_maquina: Object.fromEntries(CATEGORIAS.map(c => [c.nombre, r1(r.lineaHM.total[c.k])])) },
    linea_por_mes: r.meses.map(m => ({ mes: etiquetaMes(m), D: p2(r.linea[m].D), R: p2(r.linea[m].R), C: p2(r.linea[m].Q), OEE: p2(r.linea[m].OEE), produccion: Math.round(r.linea[m].produccion) })),
    maquinas: r.equipos.filter(e => r.seleccion.indexOf(e.id) >= 0).map(e => {
      const x = r.maquina[e.id].total, c = r.confiabilidad.find(k => k.id === e.id) || {};
      return { maquina: e.nombre, id: e.id, etapa: e.etapa, topologia: e.topologia, D: p2(x.D), R: p2(x.R), C: p2(x.Q), OEE: p2(x.OEE), carga_h: r1(x.carga),
        perdidas_h: Object.fromEntries(CATEGORIAS.map(k => [k.k, r1(x.perdidas[k.k])])), fallas: c.n, MTBF_h: r1(c.mtbf), MTTR_h: c.mttr == null ? null : Math.round(c.mttr * 100) / 100, validez: c.validez,
        OEE_por_mes: Object.fromEntries(r.meses.map(m => [etiquetaMes(m), p2(r.maquina[e.id][m].OEE)])) };
    })
  };
}
function causasPrincipales(r, n) {
  const g = {};
  r.pareto.forEach(p => { const k = p.cat + ' | ' + p.causa; g[k] = g[k] || { tipo: p.cat, causa: p.causa, horas: 0, eventos: 0 }; g[k].horas += p.horas; g[k].eventos++; });
  return Object.values(g).sort((a, b) => b.horas - a.horas).slice(0, n).map(x => Object.assign(x, { horas: r1(x.horas) }));
}
function programa() {
  const L = globalThis.LEGADO; if (!L) return null;
  const s = L.instantanea(), hoy = s.FECHA_SIS || new Date().toISOString().slice(0, 10), ots = s.OTS || [];
  const por = {};
  ots.forEach(o => { const k = o.tipo; por[k] = por[k] || { total: 0, ejecutadas: 0, no_cumplidas: 0, vencidas: 0, programadas: 0 }; por[k].total++;
    if (o.estado === 'Ejecutada') por[k].ejecutadas++; else if (o.estado === 'No cumplida') por[k].no_cumplidas++; else if (o.fecha < hoy) por[k].vencidas++; else por[k].programadas++; });
  const tareas = {}; Object.keys(s.PLANES || {}).forEach(f => (s.PLANES[f] || []).forEach(t => { const k = f + ' · ' + t.tipo; tareas[k] = (tareas[k] || 0) + 1; }));
  const anom = s.ANOM || [];
  return { inicio: s.PROG && s.PROG.ini, meses: s.PROG && s.PROG.meses, fecha_del_sistema: hoy, ordenes_por_pilar: por, tareas_del_plan_por_equipo_y_pilar: tareas,
    proximas_ordenes: ots.filter(o => o.fecha >= hoy && o.estado !== 'Ejecutada').slice(0, 12).map(o => ({ ot: o.id, fecha: o.fecha, equipo: o.eqId, pilar: o.tipo, actividad: o.act, min: o.min })),
    anomalias: { total: anom.length, no_conformidades: anom.filter(a => a.clase === 'No conformidad').length, sin_revisar: anom.filter(a => !a.revisado).length, ultimas: anom.slice(-8).map(a => ({ fecha: a.fecha, equipo: a.eqId, clase: a.clase, detalle: a.punto })) } };
}
function simulacion() {
  const b = E.resultadosSim.E0; if (!b) return { estado: E.validacion ? 'validada, sin escenarios corridos' : 'sin validar' };
  return E.escenarios.filter(e => E.resultadosSim[e.id]).map(e => { const o = E.resultadosSim[e.id].resumen;
    return { escenario: e.nombre, OEE_media: p2(o.OEE.media), IC95: [p2(o.OEE.li), p2(o.OEE.ls)], delta_pp: e.id === 'E0' ? 0 : p2(o.OEE.media - b.resumen.OEE.media), produccion: Math.round(o.produccion.media) }; });
}
function contexto() {
  const r = E.total, P = periodoVigente(), s = globalThis.LEGADO ? globalThis.LEGADO.sesion() : null;
  const ctx = {
    sistema: 'CMMS 4.0 · Línea de láminas antiabrasivas (LEXACAUCHO). Motor Nakajima: A total de producción → B carga → C bruto (D) → D neto (R) → E valor añadido (C).',
    usuario: s ? s.nombre + ' (' + s.rol + ')' : null,
    periodo_de_datos: { nombre: P.nombre, desde: P.fecha_inicio, hasta: P.fecha_fin, turnos: P.turnos_dia, horas_turno: P.horas_turno, benchmark: P.benchmark_oee, cuello_botella: P.equipo_cuello_botella, capacidad_cuello: P.capacidad_cuello_botella, margen_soles_lamina: P.margen_unitario },
    periodos_omitidos: P.omisiones, programa_mantenimiento: E.config.programa,
    calendario: { dias: r.cal.total.dias, omitidos: r.cal.total.omitidos, domingos: r.cal.total.domingos, feriados: r.cal.total.feriados, laborables: r.cal.total.laborables, total_produccion_h: r1(r.cal.total.totalProduccion) },
    registros_en_el_periodo: r.conteos,
    oee: resumenOEE(r),
    paradas_por_maquina_y_tipo_h: Object.fromEntries(r.equipos.filter(e => e.activo).map(e => [e.nombre, Object.fromEntries(TIPOS.map(t => [t.n, r1(r.maquina[e.id].total.perdidas[t.hm])]))])),
    causas_principales: causasPrincipales(r, 20),
    mantenimiento: programa(),
    simulacion: simulacion()
  };
  return JSON.stringify(ctx);
}

/* ===== Herramientas: detalle a pedido ===== */
const HERRAMIENTAS = [
  { name: 'consultar_registros', description: 'Devuelve filas de un registro operativo del periodo (máx. 60, las de mayor duración primero) y el total de filas y horas que cumplen el filtro. Úsala para preguntas sobre eventos, fechas, causas o turnos concretos.',
    inputSchema: { type: 'object', properties: { registro: { type: 'string', enum: Object.keys(REGISTROS) }, equipo_id: { type: 'string', description: 'MOL, EXT, PR1..PR5, AUT, CAL1, CAL2 (opcional)' }, desde: { type: 'string', description: 'AAAA-MM-DD (opcional)' }, hasta: { type: 'string' }, turno: { type: 'string' }, texto: { type: 'string', description: 'filtra por texto en cualquier campo (opcional)' } }, required: ['registro'] },
    execute(i) {
      const d = REGISTROS[String(i.registro)]; if (!d) throw new Error('Registro desconocido');
      const tx = i.texto ? String(i.texto).toLowerCase() : '';
      const om = periodoVigente().omisiones;
      let f = registrosDelPeriodo()[d.id].filter(x => !enOmision(x.dia_prod || '', om) && (!i.equipo_id || x.equipo_id === i.equipo_id) && (!i.desde || (x.dia_prod || '') >= i.desde) && (!i.hasta || (x.dia_prod || '') <= i.hasta) && (!i.turno || String(x.turno) === String(i.turno)) && (!tx || JSON.stringify(x).toLowerCase().indexOf(tx) >= 0));
      const dur = x => +(x.horas != null ? x.horas : x.duracion_actividad_h) || 0;
      const total = f.length, horas = f.reduce((a, x) => a + dur(x), 0);
      f = f.slice().sort((a, b) => dur(b) - dur(a)).slice(0, 60).map(x => { const o = {}; d.columnas.forEach(c => { if (x[c.k] != null && x[c.k] !== '') o[c.k] = c.tipo === 'equipo' ? nomEq(x[c.k]) : x[c.k]; }); return o; });
      return { registro: d.nombre, total_filas: total, total_horas: r1(horas), filas: f };
    } },
  { name: 'oee_filtrado', description: 'Calcula el OEE (línea y máquinas) con filtros de meses, turno, equipos, etapa o topología. Devuelve el mismo resumen que el contexto pero filtrado.',
    inputSchema: { type: 'object', properties: { desde: { type: 'string', description: 'AAAA-MM' }, hasta: { type: 'string', description: 'AAAA-MM' }, turno: { type: 'string', enum: ['1', '2'] }, equipos: { type: 'array', items: { type: 'string' } }, etapa: { type: 'string' }, topologia: { type: 'string', enum: ['serie', 'paralelo', 'soporte'] } } },
    execute(i) { const f = {}; ['desde', 'hasta', 'turno', 'etapa', 'topologia'].forEach(k => { if (i[k]) f[k] = String(i[k]); }); if (Array.isArray(i.equipos) && i.equipos.length) f.equipos = i.equipos.map(String); return resumenOEE(resultadoPara(f)); } },
  { name: 'ordenes_de_trabajo', description: 'Lista órdenes de trabajo del programa de mantenimiento (máx. 80) con su estado, filtrando por fechas, equipo (molino, extruder, prensa1..5, autoclave, caldero1, caldero2), pilar (Planificado, Autónomo, Calidad) o estado.',
    inputSchema: { type: 'object', properties: { desde: { type: 'string' }, hasta: { type: 'string' }, equipo: { type: 'string' }, pilar: { type: 'string' }, estado: { type: 'string', enum: ['Programada', 'Ejecutada', 'No cumplida'] } } },
    execute(i) {
      const s = globalThis.LEGADO ? globalThis.LEGADO.instantanea() : { OTS: [] };
      const f = s.OTS.filter(o => (!i.desde || o.fecha >= i.desde) && (!i.hasta || o.fecha <= i.hasta) && (!i.equipo || o.eqId === i.equipo) && (!i.pilar || o.tipo === i.pilar) && (!i.estado || o.estado === i.estado));
      return { total: f.length, ordenes: f.slice(0, 80).map(o => ({ ot: o.id, fecha: o.fecha, equipo: o.eqId, pilar: o.tipo, frecuencia: o.frec, actividad: o.act, min: o.min, estado: o.estado, real_min: o.real, en_jornada: o.enJornada, motivo_no: o.motivoNo || undefined })) };
    } }
];

const REGLAS = 'Eres el asistente del CMMS 4.0 de la línea de láminas antiabrasivas de LEXACAUCHO. Respondes en español, claro y breve, como ingeniero de mantenimiento experto en OEE (Nakajima), TPM y confiabilidad.\n' +
  'Reglas: 1) Usa SOLO los datos del sistema que siguen (y las herramientas, si las tienes); no inventes cifras. Si un dato no está, dilo y di en qué módulo se carga. 2) Da cifras con unidades (%, h, láminas, S/) y el periodo al que corresponden. ' +
  '3) Distingue OEE de línea (horas de línea, según topología) de OEE por máquina (horas-máquina frente a su propia carga). 4) Cuando convenga, termina con una recomendación concreta y el módulo del sistema donde verla (OEE de línea, OEE por máquina, Análisis de paradas, Registros y carga, Escenarios, Programa, Agenda, Anomalías, Parámetros). ' +
  '5) Si te preguntan cómo usar el sistema, explica los pasos en el menú. 6) Formato: párrafos cortos y viñetas con «- »; negritas con **texto**; sin tablas anchas.\n\nDATOS DEL SISTEMA (JSON):\n';

/* ===== Interfaz ===== */
function formato(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n/).map(l => /^\s*[-•]\s+/.test(l) ? '<li>' + l.replace(/^\s*[-•]\s+/, '') + '</li>' : l ? '<p>' + l + '</p>' : '').join('').replace(/(<li>.*?<\/li>)+/g, m => '<ul>' + m + '</ul>');
}
function burbuja(rol, html) {
  const d = document.createElement('div'); d.className = 'ia-msg ' + rol; d.innerHTML = html; $('iaLista').appendChild(d); $('iaLista').scrollTop = $('iaLista').scrollHeight; return d;
}
const MENSAJES = { not_granted: 'El asistente no tiene permiso para usar Claude en esta sesión.', sampling_disabled: 'Claude no está disponible para esta cuenta u organización.', rate_limited: 'Demasiadas consultas seguidas o límite de uso alcanzado. Intente en unos minutos.',
  session_expired: 'La sesión de claude.ai expiró: vuelva a iniciar sesión.', prompt_too_large: 'La consulta es demasiado grande. Acote la pregunta (un equipo o un rango de meses).', refused: 'Claude no respondió esa consulta. Reformúlela.', empty_completion: 'No hubo respuesta. Intente con una pregunta más concreta.' };

async function preguntar(texto) {
  if (ocupado || !texto.trim()) return;
  if (!E.total) { burbuja('ia', '<p>El sistema aún está cargando.</p>'); return; }
  ocupado = true; $('iaEnviar').hidden = true; $('iaParar').hidden = false; $('iaTexto').value = '';
  burbuja('yo', '<p>' + esc(texto) + '</p>');
  const salida = burbuja('ia', '<p class="ia-pensando">Pensando…</p>');
  turnos.push({ role: 'user', content: texto });
  while (turnos.length > 12) turnos.shift();
  if (turnos[0].role !== 'user') turnos.shift();
  ctl = new AbortController();
  try {
    const opts = { cache: false, signal: ctl.signal, onText: ({ text }) => { salida.innerHTML = formato(text); $('iaLista').scrollTop = $('iaLista').scrollHeight; } };
    if (herramientas) opts.tools = HERRAMIENTAS;
    const { text, truncated } = await sample([{ role: 'user', content: REGLAS + contexto() }].concat(turnos), opts);
    salida.innerHTML = formato(text) + (truncated ? '<p class="ia-nota">Respuesta cortada: pida menos detalle a la vez.</p>' : '');
    turnos.push({ role: 'assistant', content: text });
  } catch (e) {
    turnos.pop();
    if (e.code === 'cancelled') salida.innerHTML = e.text ? formato(e.text) + '<p class="ia-nota">Detenido.</p>' : '<p class="ia-nota">Detenido.</p>';
    else {
      salida.innerHTML = (e.text ? formato(e.text) : '') + '<p class="ia-nota">' + esc(MENSAJES[e.code] || 'No se pudo completar la consulta. Intente de nuevo.') + '</p>';
      if (e.code === 'tools_unavailable') herramientas = false;
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].indexOf(e.code) >= 0) $('iaTexto').disabled = true;
    }
  } finally { ocupado = false; ctl = null; $('iaEnviar').hidden = false; $('iaParar').hidden = true; }
}

const SUGERENCIAS = ['¿Cuál es el OEE de la línea y qué lo está bajando más?', '¿Qué máquina tiene peor OEE y por qué?', 'Analiza las paradas del autoclave por tipo', '¿Cuáles son las 5 causas que más horas quitan?', '¿Cómo va el cumplimiento del programa de mantenimiento?', '¿Qué escenario de mejora recomiendas?'];

export async function montar() {
  const c = globalThis.claude;
  if (!c || typeof c.use !== 'function') return;
  try { sample = await c.use('sample'); } catch (e) { sample = null; }
  if (!sample) return;
  try { const l = await sample.limits(); herramientas = !!(l && l.tools); } catch (e) { herramientas = false; }
  const raiz = document.createElement('div'); raiz.id = 'ia';
  raiz.innerHTML = '<button class="ia-fab" id="iaAbrir" aria-label="Abrir el asistente de IA" title="Asistente de IA"><i class="fas fa-wand-magic-sparkles"></i></button>' +
    '<section class="ia-panel" id="iaPanel" hidden aria-label="Asistente de IA del CMMS"><header><div><b>Asistente CMMS</b><span>Responde con los datos del sistema</span></div>' +
    '<button class="ia-x" id="iaNuevo" title="Nueva conversación"><i class="fas fa-rotate-left"></i></button><button class="ia-x" id="iaCerrar" title="Cerrar"><i class="fas fa-xmark"></i></button></header>' +
    '<div class="ia-lista" id="iaLista"><div class="ia-msg ia"><p>Hola. Pregúnteme sobre el OEE de la línea o de cada máquina, las paradas por tipo, las causas, el calendario, el programa de mantenimiento o la simulación.</p></div>' +
    '<div class="ia-sug" id="iaSug">' + SUGERENCIAS.map(s => '<button>' + esc(s) + '</button>').join('') + '</div></div>' +
    '<form class="ia-form" id="iaForm"><textarea id="iaTexto" rows="2" placeholder="Escriba su pregunta…"></textarea><button class="btn btn-primary" id="iaEnviar" type="submit" aria-label="Enviar"><i class="fas fa-paper-plane"></i></button><button class="btn btn-ghost" id="iaParar" type="button" hidden>Detener</button></form>' +
    '<p class="ia-pie">Cada consulta usa su cuenta de Claude. Verifique las cifras en el módulo indicado.</p></section>';
  document.body.appendChild(raiz);
  const abrir = v => { $('iaPanel').hidden = !v; $('iaAbrir').hidden = v; if (v) $('iaTexto').focus(); };
  $('iaAbrir').onclick = () => abrir(true); $('iaCerrar').onclick = () => abrir(false);
  $('iaNuevo').onclick = () => { if (ctl) ctl.abort(); turnos = []; $('iaLista').querySelectorAll('.ia-msg.yo, .ia-msg.ia:not(:first-child)').forEach(n => n.remove()); $('iaSug').hidden = false; };
  $('iaParar').onclick = () => { if (ctl) ctl.abort(); };
  $('iaSug').querySelectorAll('button').forEach(b => b.onclick = () => { $('iaSug').hidden = true; preguntar(b.textContent); });
  $('iaForm').addEventListener('submit', e => { e.preventDefault(); $('iaSug').hidden = true; preguntar($('iaTexto').value); });
  $('iaTexto').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('iaForm').requestSubmit(); } });
}
