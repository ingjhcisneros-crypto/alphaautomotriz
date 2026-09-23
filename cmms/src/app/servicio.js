/* Servicio único de la aplicación: orquesta la base de datos y el motor de cálculo. Toda inserción, edición o
   borrado de un registro dispara el recálculo del OEE (sección 9) y marca el modelo de simulación como
   desactualizado. Ningún indicador se almacena: todos son función de los registros. */
import * as BD from './db.js';
import { REGISTROS, claveDuplicado } from '../core/registros.js';
import { calcularOEE } from '../core/oee.js';
import { validarFilas, separarDuplicados } from '../core/validacion.js';
import { procesarArchivo } from '../core/lector.js';
import { construirModelo } from '../core/modelo.js';
import { validarBase, comparar } from '../core/simulacion.js';
import { EQUIPOS_SEMILLA, LISTAS_SEMILLA, CODIGOS_CAUSA_SEMILLA, PRODUCTOS_SEMILLA, periodoSemilla, CONFIG_SEMILLA, SIM_SEMILLA, ESCENARIOS_SEMILLA } from '../core/catalogos.js';
import { copia, huella } from '../core/util.js';

export const E = {
  periodo: null, config: null, sim: null, equipos: [], listas: {}, codigos: [], productos: [], escenarios: [],
  registros: {}, filtros: {}, resultado: null, total: null, ultimoRecalculo: null, duracionRecalculo: 0,
  modelo: null, validacion: null, resultadosSim: {}, versionDatos: 0
};
const oyentes = {};
export const escuchar = (ev, fn) => (oyentes[ev] = oyentes[ev] || []).push(fn);
const emitir = (ev, x) => (oyentes[ev] || []).forEach(fn => { try { fn(x); } catch (e) { console.error(e); } });

export async function bitacora(accion, detalle) {
  const s = globalThis.LEGADO && globalThis.LEGADO.sesion ? globalThis.LEGADO.sesion() : null;
  await BD.poner('bitacora', { fecha: new Date().toISOString(), usuario: s ? s.user : 'sistema', accion, detalle: detalle || '' });
}

/* Instalación: solo catálogos y parámetros. Ningún registro operativo. */
async function sembrar() {
  await BD.ponerVarios('equipos', copia(EQUIPOS_SEMILLA));
  await BD.ponerVarios('listas', Object.entries(LISTAS_SEMILLA).map(([nombre, valores]) => ({ nombre, valores })));
  await BD.ponerVarios('codigos_causa', copia(CODIGOS_CAUSA_SEMILLA));
  await BD.ponerVarios('productos', copia(PRODUCTOS_SEMILLA));
  await BD.poner('periodos', periodoSemilla());
  await BD.poner('config', copia(CONFIG_SEMILLA));
  await BD.poner('config', copia(SIM_SEMILLA));
  await BD.ponerVarios('escenarios', copia(ESCENARIOS_SEMILLA));
  await BD.poner('config', { id: 'estado', instalado: new Date().toISOString(), versionDatos: 0 });
  await bitacora('Instalación', 'Catálogos y parámetros del periodo sembrados; sin registros operativos');
}

export async function iniciar() {
  await BD.abrir();
  if (!(await BD.uno('config', 'general'))) await sembrar();
  await cargarTodo();
  recalcular('inicio');
}

async function cargarTodo() {
  const periodos = await BD.todos('periodos');
  E.periodo = periodos.find(p => p.activo) || periodos[0];
  E.config = await BD.uno('config', 'general');
  /* Bases anteriores a v6.1: se agrega el calendario de operación (omisiones y programa) una sola vez. */
  if (E.config && (!E.config.omisiones || !E.config.programa)) {
    E.config = Object.assign({ omisiones: copia(CONFIG_SEMILLA.omisiones), programa: copia(CONFIG_SEMILLA.programa) }, E.config);
    await BD.poner('config', E.config);
  }
  E.sim = Object.assign(copia(SIM_SEMILLA), await BD.uno('config', 'simulacion'));
  E.estado = (await BD.uno('config', 'estado')) || { id: 'estado', versionDatos: 0 };
  E.versionDatos = E.estado.versionDatos || 0;
  E.equipos = (await BD.todos('equipos')).sort((a, b) => a.orden - b.orden);
  E.listas = {}; (await BD.todos('listas')).forEach(l => E.listas[l.nombre] = l.valores);
  E.codigos = await BD.todos('codigos_causa');
  E.productos = await BD.todos('productos');
  E.escenarios = (await BD.todos('escenarios')).sort((a, b) => a.id < b.id ? -1 : 1);
  for (const def of Object.values(REGISTROS)) E.registros[def.id] = await BD.todos(def.tabla);
  const m = await BD.uno('modelo_sim', 'actual');
  E.modelo = m ? m.modelo : null; E.validacion = m ? m.validacion : null;
  E.resultadosSim = {}; (await BD.todos('resultados_sim')).forEach(r => E.resultadosSim[r.id] = r);
}

/* Órdenes del programa de mantenimiento (módulo heredado) cumplidas dentro de la jornada y del periodo:
   pilares Planificado y Calidad. Son parada planificada y se descuentan del tiempo de carga. */
const LEG_A_ID = { molino: 'MOL', extruder: 'EXT', prensa1: 'PR1', prensa2: 'PR2', prensa3: 'PR3', prensa4: 'PR4', prensa5: 'PR5', autoclave: 'AUT', caldero1: 'CAL1', caldero2: 'CAL2' };
export function mantenimientoEjecutado() {
  const L = globalThis.LEGADO; if (!L || !E.periodo) return [];
  const P = E.periodo;
  return (L.instantanea().OTS || []).filter(o => o.estado === 'Ejecutada' && (o.tipo === 'Planificado' || o.tipo === 'Calidad') && o.enJornada !== false && o.fecha >= P.fecha_inicio && o.fecha <= P.fecha_fin && LEG_A_ID[o.eqId])
    .map(o => ({ equipo_id: LEG_A_ID[o.eqId], dia: o.fecha, horas: (o.real != null ? o.real : o.min) / 60, tipo: o.tipo, ot: o.id, act: o.act }));
}
let huellaMtto = '';
/* Llamado cuando cambia el estado del programa (cierre de órdenes): recalcula solo si cambió el mantenimiento ejecutado. */
export function alCambiarPrograma() {
  const h = huella(mantenimientoEjecutado().map(x => x.ot + x.horas));
  if (h === huellaMtto) return false;
  huellaMtto = h; E.versionDatos++; if (E.estado) { E.estado.versionDatos = E.versionDatos; BD.poner('config', E.estado); }
  recalcular('programa'); return true;
}
/* El periodo con los rangos omitidos aplicados: es lo que ven el motor, la validación, la simulación y las vistas. */
export const periodoVigente = () => E.periodo ? Object.assign({}, E.periodo, { omisiones: (E.config && E.config.omisiones) || [] }) : null;
export const ctx = () => ({ periodo: periodoVigente(), config: E.config, equipos: E.equipos, listas: E.listas, codigos: E.codigos, mantenimiento: mantenimientoEjecutado() });
const registrosPeriodo = () => { const o = {}; Object.keys(E.registros).forEach(k => o[k] = E.registros[k].filter(r => r.periodo_id === E.periodo.id)); return o; };

/* Recálculo (sección 9.1): horas por equipo y mes → OEE por máquina → factores topológicos → OEE de línea →
   confiabilidad → producción, brecha e impacto → invalidación de la caché del tablero. Idempotente. */
export function recalcular(motivo) {
  const t0 = performance.now();
  emitir('recalculando', motivo);
  const base = Object.assign(ctx(), { registros: registrosPeriodo() });
  huellaMtto = huella(base.mantenimiento.map(x => x.ot + x.horas));
  E.total = calcularOEE(Object.assign({}, base, { filtros: {} }));
  const hayFiltro = Object.values(E.filtros || {}).some(v => Array.isArray(v) ? v.length : v);
  E.resultado = hayFiltro ? calcularOEE(Object.assign({}, base, { filtros: E.filtros })) : E.total;
  E.ultimoRecalculo = new Date();
  E.duracionRecalculo = performance.now() - t0;
  emitir('recalculo', { motivo, resultado: E.resultado });
  return E.resultado;
}
/* Si el recálculo supera 2 s se ejecuta en segundo plano con indicador. */
export function recalcularAsincrono(motivo) {
  if (E.duracionRecalculo < 2000) return Promise.resolve(recalcular(motivo));
  emitir('recalculando', motivo);
  return new Promise(ok => setTimeout(() => ok(recalcular(motivo)), 30));
}
export function fijarFiltros(f) { E.filtros = f; return recalcular('filtros'); }
/* Cada vista pide su propio cálculo filtrado; se memoriza por combinación de filtros y se invalida en cada recálculo. */
let cache = new Map(), cacheVersion = -1;
export function resultadoPara(filtros) {
  const f = filtros || {};
  if (!Object.values(f).some(v => Array.isArray(v) ? v.length : v)) return E.total;
  if (cacheVersion !== E.ultimoRecalculo) { cache = new Map(); cacheVersion = E.ultimoRecalculo; }
  const k = JSON.stringify(f);
  if (!cache.has(k)) cache.set(k, calcularOEE(Object.assign(ctx(), { registros: registrosPeriodo(), filtros: f })));
  return cache.get(k);
}
export const registrosDelPeriodo = () => registrosPeriodo();

async function datosCambiaron(defId, detalle) {
  E.versionDatos++;
  E.estado.versionDatos = E.versionDatos;
  await BD.poner('config', E.estado);
  E.registros[defId] = await BD.todos(REGISTROS[defId].tabla);
  await bitacora('Registro ' + REGISTROS[defId].nombre, detalle);
  await recalcularAsincrono('datos');
  emitir('datos', defId);
}
export const modeloDesactualizado = () => !E.modelo || E.modelo.versionDatos !== E.versionDatos;

/* ===== Registros ===== */
export function validarArchivo(defId, datos, XLSX, opciones) { return procesarArchivo(XLSX, datos, defId, ctx(), opciones); }

export function existentes(defId) { return E.registros[defId].filter(r => r.periodo_id === E.periodo.id); }

export async function insertar(defId, validos, modo) {
  const def = REGISTROS[defId];
  const limpiar = r => { const o = Object.assign({}, r); delete o.id; o._clave = claveDuplicado(defId, o); o.cargado = new Date().toISOString(); return o; };
  if (modo === 'completa') {
    const previos = existentes(defId);
    const respaldoId = await BD.poner('respaldos', { fecha: new Date().toISOString(), tabla: def.tabla, registro: defId, periodo: E.periodo.id, motivo: 'Carga completa', registros: previos });
    const nuevos = separarDuplicados(defId, validos, []);
    await BD.reemplazarPeriodo(def.tabla, E.periodo.id, nuevos.nuevos.map(limpiar));
    await datosCambiaron(defId, 'Carga completa: ' + previos.length + ' eliminados, ' + nuevos.nuevos.length + ' insertados, ' + nuevos.duplicados.length + ' duplicados internos omitidos');
    return { insertados: nuevos.nuevos.length, eliminados: previos.length, duplicados: nuevos.duplicados.length, respaldoId };
  }
  const { nuevos, duplicados } = separarDuplicados(defId, validos, existentes(defId));
  if (nuevos.length) await BD.ponerVarios(def.tabla, nuevos.map(limpiar));
  await datosCambiaron(defId, 'Carga incremental: ' + nuevos.length + ' insertados, ' + duplicados.length + ' duplicados omitidos');
  return { insertados: nuevos.length, duplicados: duplicados.length, eliminados: 0 };
}

/* Alta o edición manual: pasa por la misma validación que la carga por Excel. */
export async function guardarManual(defId, valores, id, forzar) {
  const def = REGISTROS[defId];
  const enc = def.columnas.map(c => c.h), fila = def.columnas.map(c => valores[c.k]);
  const inf = validarFilas(defId, enc, [fila], ctx(), { forzar, filaBase: 1 });
  if (!inf.validos.length) return { ok: false, informe: inf };
  const r = inf.validos[0];
  const dups = existentes(defId).filter(x => x.id !== id && (x._clave || claveDuplicado(defId, x)) === r._clave);
  if (dups.length) return { ok: false, informe: Object.assign(inf, { errores: [{ fila: 1, columna: '—', motivo: 'Ya existe un registro con la misma fecha y hora, equipo y duración', severidad: 'Rechazado' }] }) };
  if (id != null) r.id = id;
  r.cargado = new Date().toISOString(); r.manual = true;
  await BD.poner(def.tabla, r);
  await datosCambiaron(defId, (id != null ? 'Edición' : 'Alta') + ' manual de un registro');
  return { ok: true, informe: inf };
}
export async function borrarRegistros(defId, ids) {
  await BD.borrarVarios(REGISTROS[defId].tabla, ids);
  await datosCambiaron(defId, 'Borrado de ' + ids.length + ' registro(s)');
}
export async function vaciarRegistro(defId) {
  const previos = existentes(defId);
  await BD.poner('respaldos', { fecha: new Date().toISOString(), tabla: REGISTROS[defId].tabla, registro: defId, periodo: E.periodo.id, motivo: 'Vaciado', registros: previos });
  await BD.reemplazarPeriodo(REGISTROS[defId].tabla, E.periodo.id, []);
  await datosCambiaron(defId, 'Vaciado del registro (' + previos.length + ' eliminados, respaldo guardado)');
}

/* ===== Configuración ===== */
export async function guardarPeriodo(p) { E.periodo = p; await BD.poner('periodos', p); await bitacora('Parámetros del periodo', 'Actualizados'); E.versionDatos++; E.estado.versionDatos = E.versionDatos; await BD.poner('config', E.estado); recalcular('parámetros'); emitir('config'); }
export async function guardarEquipos(lista) { E.equipos = lista.slice().sort((a, b) => a.orden - b.orden); await BD.ponerVarios('equipos', lista); await bitacora('Catálogo de equipos', 'Actualizado'); E.versionDatos++; E.estado.versionDatos = E.versionDatos; await BD.poner('config', E.estado); recalcular('equipos'); emitir('config'); }
export async function guardarConfig(c) { E.config = c; await BD.poner('config', c); await bitacora('Factores topológicos', 'Actualizados'); recalcular('configuración'); emitir('config'); }
/* Calendario de operación: rangos omitidos (uno o varios) e inicio del programa de mantenimiento. */
export function validarOmisiones(lista) {
  const o = lista.slice().sort((a, b) => a.desde < b.desde ? -1 : 1);
  for (let i = 0; i < o.length; i++) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o[i].desde || '') || !/^\d{4}-\d{2}-\d{2}$/.test(o[i].hasta || '')) return 'Fechas incompletas en el rango ' + (i + 1);
    if (o[i].hasta < o[i].desde) return 'El rango ' + o[i].desde + ' – ' + o[i].hasta + ' termina antes de empezar';
    if (i && o[i].desde <= o[i - 1].hasta) return 'Los rangos ' + o[i - 1].desde + ' – ' + o[i - 1].hasta + ' y ' + o[i].desde + ' – ' + o[i].hasta + ' se superponen';
  }
  return null;
}
export async function guardarCalendario(omisiones, programa) {
  const err = validarOmisiones(omisiones); if (err) throw new Error(err);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(programa.inicio || '') || !(programa.meses >= 1 && programa.meses <= 36)) throw new Error('Programa: indique fecha de inicio y de 1 a 36 meses');
  E.config = Object.assign({}, E.config, { omisiones: omisiones.slice().sort((a, b) => a.desde < b.desde ? -1 : 1).map(o => ({ desde: o.desde, hasta: o.hasta, motivo: o.motivo || 'Periodo omitido' })), programa: { inicio: programa.inicio, meses: +programa.meses } });
  await BD.poner('config', E.config);
  await bitacora('Calendario de operación', E.config.omisiones.map(o => o.desde + '→' + o.hasta).join(', ') + ' · programa desde ' + programa.inicio);
  E.versionDatos++; E.estado.versionDatos = E.versionDatos; await BD.poner('config', E.estado);
  recalcular('calendario'); emitir('config');
}
export async function guardarSim(s) { E.sim = s; await BD.poner('config', s); await bitacora('Parámetros de simulación', 'Actualizados'); emitir('config'); }
export async function guardarListas(obj) { E.listas = obj; await BD.ponerVarios('listas', Object.entries(obj).map(([nombre, valores]) => ({ nombre, valores }))); await bitacora('Catálogos', 'Listas actualizadas'); emitir('config'); }
export async function guardarEscenario(e) { await BD.poner('escenarios', e); E.escenarios = (await BD.todos('escenarios')).sort((a, b) => a.id < b.id ? -1 : 1); emitir('escenarios'); }
export async function borrarEscenario(id) { await BD.borrar('escenarios', id); await BD.borrar('resultados_sim', id); delete E.resultadosSim[id]; E.escenarios = E.escenarios.filter(e => e.id !== id); emitir('escenarios'); }

/* ===== Periodos ===== */
export const periodos = () => BD.todos('periodos');
export async function crearPeriodo(p) {
  const todos = await BD.todos('periodos');
  if (todos.some(x => x.id === p.id)) throw new Error('Ya existe un periodo con ese identificador');
  for (const x of todos) if (x.activo) { x.activo = false; await BD.poner('periodos', x); }
  p.activo = true; await BD.poner('periodos', p);
  await bitacora('Periodo', 'Creado y activado ' + p.nombre + ' (' + p.fecha_inicio + ' a ' + p.fecha_fin + ')');
  await cambioDePeriodo(p);
}
export async function activarPeriodo(id) {
  const todos = await BD.todos('periodos'); let act = null;
  for (const x of todos) { x.activo = x.id === id; if (x.activo) act = x; await BD.poner('periodos', x); }
  if (!act) throw new Error('Periodo inexistente');
  await bitacora('Periodo', 'Activado ' + act.nombre);
  await cambioDePeriodo(act);
}
/* Días no laborables adicionales (paro de planta, obra civil): se agregan al mismo listado de feriados. */
export function rangoNoLaborable(periodo, desde, hasta, motivo) {
  const p = copia(periodo), existe = new Set(p.feriados.map(f => f.fecha));
  for (let d = new Date(desde + 'T12:00:00Z'); d.toISOString().slice(0, 10) <= hasta; d = new Date(d.getTime() + 86400000)) {
    const f = d.toISOString().slice(0, 10); if (!existe.has(f)) p.feriados.push({ fecha: f, motivo });
  }
  p.feriados.sort((a, b) => a.fecha < b.fecha ? -1 : 1); return p;
}
async function cambioDePeriodo(p) {
  E.periodo = p; E.filtros = {};
  E.versionDatos++; E.estado.versionDatos = E.versionDatos; await BD.poner('config', E.estado);
  recalcular('periodo'); emitir('config'); emitir('datos', null);
}

/* ===== Simulación ===== */
export async function ajustarModelo() {
  const m = construirModelo(Object.assign(ctx(), { registros: registrosPeriodo() }), E.sim);
  m.versionDatos = E.versionDatos;
  E.modelo = m; E.validacion = null;
  await BD.poner('modelo_sim', { id: 'actual', fecha: m.creado, modelo: m, validacion: null });
  await bitacora('Ajuste de distribuciones', m.ajustes.length + ' ajustes · ' + m.ajustes.filter(a => a.ks != null).map(a => a.equipo + '/' + a.variable + ' ' + a.distribucion + ' D=' + a.ks.toFixed(3)).join('; '));
  emitir('modelo');
  return m;
}
export async function guardarResultado(res) {
  const r = Object.assign({ id: res.escenario.id }, res);
  E.resultadosSim[r.id] = r; await BD.poner('resultados_sim', r);
  if (r.id === 'E0' && E.modelo) {
    E.validacion = validarBase(r, E.modelo);
    await BD.poner('modelo_sim', { id: 'actual', fecha: E.modelo.creado, modelo: E.modelo, validacion: E.validacion });
    await bitacora('Validación de la línea base', E.validacion.ok ? 'Aprobada' : 'Fuera de tolerancia');
  }
  emitir('simulacion', r);
}
export const escenariosHabilitados = () => !!(E.validacion && E.validacion.ok && !modeloDesactualizado() && E.validacion.huellaDatos === E.modelo.huellaDatos);
export function comparacion(id) { const b = E.resultadosSim.E0, o = E.resultadosSim[id]; return b && o && E.modelo ? comparar(b, o, E.modelo) : null; }

/* ===== Respaldo completo ===== */
export async function respaldoCompleto() {
  const out = { sistema: 'CMMS 4.0 · LEXACAUCHO', version: 1, fecha: new Date().toISOString(), tablas: {} };
  for (const t of BD.nombresTablas()) if (t !== 'respaldos') out.tablas[t] = await BD.todos(t);
  return out;
}
export async function restaurar(obj) {
  if (!obj || !obj.tablas) throw new Error('El archivo no es un respaldo del CMMS');
  for (const [t, filas] of Object.entries(obj.tablas)) { if (BD.nombresTablas().indexOf(t) < 0) continue; await BD.vaciar(t); if (filas.length) await BD.ponerVarios(t, filas); }
  await cargarTodo(); await bitacora('Restauración', 'Respaldo del ' + obj.fecha); recalcular('restauración'); emitir('config'); emitir('datos', null);
}
export const BDexp = BD;
export { huella };
