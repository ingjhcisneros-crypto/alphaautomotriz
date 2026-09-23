/* Parámetros editables: periodo, feriados, equipos, factores topológicos, simulación y catálogos. */
import { $, esc, h1, n0, aviso, confirmar } from './comun.js';
import { E, escuchar, guardarPeriodo, guardarEquipos, guardarConfig, guardarSim, guardarListas, periodos, crearPeriodo, activarPeriodo } from '../servicio.js';
import { feriadosPeru } from '../../core/calendario.js';
import { dialogo } from './comun.js';
import { calendarioOEE } from '../../core/oee.js';
import { copia } from '../../core/util.js';

const CAMPOS_PERIODO = [
  ['nombre', 'Nombre del periodo', 'text'], ['fecha_inicio', 'Inicio', 'date'], ['fecha_fin', 'Fin', 'date'],
  ['hora_inicio', 'Inicio del turno 1', 'time'], ['hora_corte', 'Fin del turno 2 (día siguiente)', 'time'], ['turnos_dia', 'Turnos por día', 'number'], ['horas_turno', 'Horas por turno', 'number'],
  ['horas_almuerzo', 'Almuerzo por turno (h)', 'number'], ['horas_capacitacion', 'Capacitación semanal por turno (h)', 'number'], ['semanas_capacitacion', 'Semanas de capacitación', 'number'],
  ['horas_mtto_planificado', 'Mantenimiento planificado (h del periodo)', 'number'], ['retraso_encendido_min', 'Retraso de encendido de calderos (min)', 'number'],
  ['capacidad_cuello_botella', 'Capacidad del cuello de botella (lám/h)', 'number'], ['equipo_cuello_botella', 'Equipo cuello de botella', 'equipo'],
  ['masa_unitaria_kg', 'Masa unitaria (kg por lámina)', 'number'], ['costo_unitario', 'Costo unitario (S/)', 'number'], ['precio_venta', 'Precio de venta (S/)', 'number'],
  ['margen_unitario', 'Margen unitario (S/)', 'number'], ['benchmark_oee', 'Benchmark OEE (fracción)', 'number'], ['benchmark_fuente', 'Fuente del benchmark', 'text'], ['objetivo_oee', 'Objetivo de la empresa (fracción)', 'number']
];
const CAMPOS_SIM = [
  ['molino_lote_kg', 'Lote del molino (kg)'], ['molino_ciclo_min', 'Ciclo del molino (min)'], ['extrusora_kg_h', 'Extrusora (kg/h)'], ['tolva_extrusora_kg', 'Tolva de la extrusora (kg)'],
  ['prensa_ciclo_min', 'Ciclo de prensa (min por lámina)'], ['buffer_curado', 'Buffer de curado (láminas)'], ['autoclave_lote', 'Lote del autoclave (láminas)'], ['autoclave_ciclo_min', 'Ciclo nominal del autoclave (min)'],
  ['ciclo_cuello_segun', 'Ciclo real del cuello de botella', ['demostrada', 'ficha']], ['acople_serie', 'Acople de equipos en serie', ['rigido', 'flujo']], ['sincronizar_al_cuello', 'Liberar material al takt del cuello', ['false', 'true']],
  ['acabado_lam_h', 'Acabado (lám/h agregado)'], ['acabado_operarios', 'Operarios de acabado'], ['calderos_minimos', 'Calderos mínimos para vapor'],
  ['calentamiento_dias', 'Calentamiento (días descartados)'], ['replicas', 'Réplicas mínimas'], ['replicas_max', 'Tope de réplicas'], ['semilla', 'Semilla'], ['semilla_fija', 'Semilla fija', ['true', 'false']],
  ['confianza', 'Nivel de confianza'], ['precision_relativa', 'Precisión relativa (semiancho ÷ media)']
];
const NOM_LISTAS = { turno: 'Turno', maquina: 'Máquina', maquina_producto: 'Máquina (calidad)', sistema_afectado: 'Sistema afectado', modo_falla: 'Modo de falla', causa_raiz: 'Causa raíz', tipo_evento: 'Tipo de evento',
  actividad_cil: 'Actividad CIL', operador_responsable: 'Operador responsable', formato: 'Formato', clasificacion: 'Clasificación de setup', tecnica_conversion: 'Técnica de conversión', si_no: 'Sí / No',
  tipo_nc: 'Tipo de no conformidad', unidad_nc: 'Unidad', origen_causa: 'Origen de la causa', equipo_auxiliar: 'Equipo auxiliar', etapa_afectada: 'Etapa afectada', alcance_reunion: 'Alcance de reunión' };

let borrador = null;
const puede = () => { const s = globalThis.LEGADO && globalThis.LEGADO.sesion(); return !s || s.rol === 'Administrador' || s.rol === 'Ingeniero de mantenimiento'; };

export function montar() {
  $('parGuardar').onclick = async () => {
    if (!puede()) return aviso('Su perfil no permite modificar parámetros', 'warn');
    const p = leerPeriodo(); if (!p) return;
    await guardarPeriodo(p); aviso('Parámetros guardados; OEE recalculado'); pintar();
  };
  $('parFerAdd').onclick = () => {
    const f = $('parFerFecha').value, m = $('parFerMotivo').value.trim();
    if (!f || !m) return aviso('Indique fecha y motivo', 'warn');
    borrador = borrador || copia(E.periodo);
    if (borrador.feriados.some(x => x.fecha === f)) return aviso('Esa fecha ya es feriado', 'warn');
    borrador.feriados.push({ fecha: f, motivo: m }); borrador.feriados.sort((a, b) => a.fecha < b.fecha ? -1 : 1);
    pintarFeriados(); pintarResumen(); aviso('Feriado agregado; pulse «Guardar y recalcular»', 'warn');
  };
  $('parEqGuardar').onclick = async () => {
    if (!puede()) return aviso('Su perfil no permite modificar equipos', 'warn');
    const lista = E.equipos.map(e => Object.assign({}, e));
    $('parEquipos').querySelectorAll('tr[data-id]').forEach(tr => {
      const e = lista.find(x => x.id === tr.dataset.id);
      tr.querySelectorAll('[data-c]').forEach(i => { const k = i.dataset.c; e[k] = i.type === 'checkbox' ? i.checked : i.type === 'number' ? (i.value === '' ? null : +i.value) : i.value; });
    });
    await guardarEquipos(lista); aviso('Catálogo de equipos guardado; OEE recalculado');
  };
  $('parFacGuardar').onclick = async () => {
    if (!puede()) return aviso('Su perfil no permite modificar factores', 'warn');
    const c = copia(E.config);
    $('parFactores').querySelectorAll('[data-t]').forEach(i => { const f = c.factores[i.dataset.t]; f[i.dataset.k] = i.type === 'checkbox' ? i.checked : +i.value; });
    c.factor_auxiliares_linea = +$('facAux').value; c.reparto_auxiliares = $('facReparto').value;
    c.probabilidad_coincidencia_paralelo = +$('facCoin').value;
    Object.keys(c.etapas_afectadas).forEach(k => c.etapas_afectadas[k] = Array.from($('parFactores').querySelectorAll('[data-et="' + k + '"]:checked')).map(i => i.value));
    await guardarConfig(c); aviso('Factores guardados; OEE recalculado');
  };
  $('parSimGuardar').onclick = async () => {
    if (!puede()) return aviso('Su perfil no permite modificar la simulación', 'warn');
    const s = copia(E.sim);
    $('parSim').querySelectorAll('[data-k]').forEach(i => { const v = i.value; s[i.dataset.k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) || v === '' ? v : +v; });
    await guardarSim(s); aviso('Parámetros de simulación guardados. Reajuste el modelo para aplicarlos.', 'warn');
  };
  $('parListGuardar').onclick = async () => {
    if (!puede()) return aviso('Su perfil no permite modificar catálogos', 'warn');
    const o = {}; $('parListas').querySelectorAll('textarea').forEach(t => o[t.dataset.l] = t.value.split('\n').map(x => x.trim()).filter(Boolean));
    if (Object.values(o).some(v => !v.length)) return aviso('Ninguna lista puede quedar vacía', 'bad');
    if (await confirmar('Guardar catálogos', '<p>Los cambios afectan las validaciones de carga y las plantillas nuevas. Los registros ya cargados no se modifican.</p>')) { await guardarListas(o); aviso('Catálogos guardados'); }
  };
  $('parPeriodoSel').onchange = async () => {
    if (!puede()) return aviso('Su perfil no permite cambiar el periodo', 'warn');
    const id = $('parPeriodoSel').value;
    if (id === E.periodo.id) return;
    if (await confirmar('Cambiar de periodo', '<p>El tablero, el cálculo y la simulación pasarán a usar solo los registros del periodo seleccionado. Los registros del periodo actual se conservan.</p>', 'Activar')) { await activarPeriodo(id); aviso('Periodo activado; OEE recalculado'); pintar(); }
    else $('parPeriodoSel').value = E.periodo.id;
  };
  $('parNuevoPer').onclick = async () => {
    if (!puede()) return aviso('Su perfil no permite crear periodos', 'warn');
    const f0 = E.periodo.fecha_fin, ini = new Date(Date.UTC(+f0.slice(0, 4), +f0.slice(5, 7) - 1, +f0.slice(8, 10) + 1)).toISOString().slice(0, 10);
    const fin = new Date(Date.UTC(+ini.slice(0, 4) + 1, +ini.slice(5, 7) - 1, +ini.slice(8, 10) - 1)).toISOString().slice(0, 10);
    const v = await dialogo('Nuevo periodo', '<div class="rejilla c3"><div class="campo"><label>Nombre</label><input id="npNom" value="Periodo ' + ini.slice(0, 4) + '–' + fin.slice(0, 4) + '"></div>' +
      '<div class="campo"><label>Inicio</label><input type="date" id="npIni" value="' + ini + '"></div><div class="campo"><label>Fin</label><input type="date" id="npFin" value="' + fin + '"></div></div>' +
      '<p class="nota">Se copian los parámetros del periodo activo (jornada, capacidades, márgenes, benchmark) y se generan los feriados nacionales del nuevo rango, editables después.</p>',
      [{ t: 'Cancelar', v: null }, { t: 'Crear y activar', v: c => ({ nombre: c.querySelector('#npNom').value.trim(), ini: c.querySelector('#npIni').value, fin: c.querySelector('#npFin').value }) }]);
    if (!v) return;
    if (!v.nombre || !v.ini || !v.fin || v.ini > v.fin) return aviso('Datos del periodo no válidos', 'bad');
    const p = copia(E.periodo);
    Object.assign(p, { id: 'P' + v.ini.replace(/-/g, ''), nombre: v.nombre, fecha_inicio: v.ini, fecha_fin: v.fin, feriados: feriadosPeru(v.ini, v.fin) });
    try { await crearPeriodo(p); aviso('Periodo creado y activado. Cargue sus registros en «Registros y carga».'); pintar(); } catch (e) { aviso(e.message, 'bad'); }
  };
  escuchar('config', () => { if ($('v-param').classList.contains('on')) pintar(); });
}

function leerPeriodo() {
  const p = copia(borrador || E.periodo);
  $('parPeriodo').querySelectorAll('[data-k]').forEach(i => { p[i.dataset.k] = i.type === 'number' ? +i.value : i.value; });
  if (!p.fecha_inicio || !p.fecha_fin || p.fecha_inicio > p.fecha_fin) { aviso('Rango de fechas no válido', 'bad'); return null; }
  if (!(p.turnos_dia > 0 && p.horas_turno > 0 && p.turnos_dia * p.horas_turno <= 24)) { aviso('Turnos × horas por turno debe estar entre 0 y 24', 'bad'); return null; }
  if (!(p.capacidad_cuello_botella > 0 && p.masa_unitaria_kg > 0)) { aviso('Capacidad y masa unitaria deben ser positivas', 'bad'); return null; }
  return p;
}

export async function pintar() {
  borrador = null;
  const ps = (await periodos()).sort((a, b) => a.fecha_inicio < b.fecha_inicio ? -1 : 1);
  $('parPeriodoSel').innerHTML = ps.map(p => '<option value="' + esc(p.id) + '"' + (p.id === E.periodo.id ? ' selected' : '') + '>' + esc(p.nombre) + (p.activo ? ' · activo' : '') + '</option>').join('');
  const P = E.periodo;
  $('parPeriodo').innerHTML = CAMPOS_PERIODO.map(([k, n, t]) => '<div class="campo"><label>' + n + '</label>' +
    (t === 'equipo' ? '<select data-k="' + k + '">' + E.equipos.map(e => '<option value="' + e.id + '"' + (e.id === P[k] ? ' selected' : '') + '>' + esc(e.nombre) + '</option>').join('') + '</select>'
      : '<input type="' + t + '" data-k="' + k + '" value="' + esc(P[k] == null ? '' : P[k]) + '"' + (t === 'number' ? ' step="any"' : '') + '>') + '</div>').join('');
  $('parPeriodo').querySelectorAll('input').forEach(i => i.oninput = pintarResumen);
  pintarFeriados(); pintarResumen();
  $('parEquipos').innerHTML = '<thead><tr><th>Código</th><th>Nombre</th><th>Descripción</th><th>Etapa</th><th>Topología</th><th class="num">Capacidad ficha</th><th class="num">Capacidad demostrada</th><th>Unidad</th><th>Activo</th></tr></thead><tbody>' +
    E.equipos.map(e => '<tr data-id="' + e.id + '"><td class="nombre">' + e.codigo + '</td><td><input data-c="nombre" value="' + esc(e.nombre) + '"></td><td><input data-c="descripcion" value="' + esc(e.descripcion || '') + '"></td><td><input data-c="etapa" value="' + esc(e.etapa) + '"></td>' +
      '<td><select data-c="topologia">' + ['serie', 'paralelo', 'soporte'].map(t => '<option' + (t === e.topologia ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></td>' +
      '<td><input type="number" step="any" data-c="capacidad_ficha" value="' + (e.capacidad_ficha == null ? '' : e.capacidad_ficha) + '" style="width:90px"></td><td><input type="number" step="any" data-c="capacidad_demostrada" value="' + (e.capacidad_demostrada == null ? '' : e.capacidad_demostrada) + '" style="width:90px"></td>' +
      '<td><input data-c="unidad" value="' + esc(e.unidad) + '" style="width:70px"></td><td><input type="checkbox" data-c="activo"' + (e.activo ? ' checked' : '') + '></td></tr>').join('') + '</tbody>';
  const C = E.config, F = C.factores;
  $('parFactores').innerHTML = '<div class="tabla-caja"><table><thead><tr><th>Topología</th><th class="num">Disponibilidad</th><th class="num">Rendimiento</th><th class="num">Calidad</th><th>Calidad ÷ n.° de unidades de la etapa</th></tr></thead><tbody>' +
    ['serie', 'paralelo', 'soporte'].map(t => '<tr><td class="nombre">' + t + '</td>' + ['disponibilidad', 'rendimiento', 'calidad'].map(k => '<td><input type="number" step="0.01" min="0" max="1" data-t="' + t + '" data-k="' + k + '" value="' + F[t][k] + '" style="width:90px"></td>').join('') +
      '<td><input type="checkbox" data-t="' + t + '" data-k="reparto_calidad"' + (F[t].reparto_calidad ? ' checked' : '') + '></td></tr>').join('') + '</tbody></table></div>' +
    '<div class="rejilla c3" style="margin-top:var(--s4)"><div class="campo"><label>Factor de auxiliares en la línea</label><input type="number" step="0.01" id="facAux" value="' + C.factor_auxiliares_linea + '"></div>' +
    '<div class="campo"><label>Reparto de auxiliares entre máquinas</label><select id="facReparto"><option value="dividir"' + (C.reparto_auxiliares === 'dividir' ? ' selected' : '') + '>Dividir entre los equipos de la etapa</option><option value="completo"' + (C.reparto_auxiliares === 'completo' ? ' selected' : '') + '>Horas completas a cada equipo</option></select></div>' +
    '<div class="campo"><label>Probabilidad estimada de coincidencia de dos o más prensas</label><input type="number" step="0.01" id="facCoin" value="' + C.probabilidad_coincidencia_paralelo + '"></div></div>' +
    '<p class="nota">El ejemplo verificado del consolidado (hoja «6. Máquina vs línea») computa 0 h de línea para correctivo, setup y microparadas de las prensas: con cuatro prensas la capacidad (8.8 lám/h) sigue sobre el cuello de botella. La probabilidad de coincidencia estimada (' + (C.probabilidad_coincidencia_paralelo * 100).toFixed(0) + ' %) queda documentada; para aplicarla, escriba ese valor en «Disponibilidad» de la fila paralelo.</p>' +
    '<h3 style="margin-top:var(--s4)">Etapa afectada por fallas de auxiliares → equipos detenidos</h3><div class="tabla-caja"><table><thead><tr><th>Etapa afectada</th>' + E.equipos.map(e => '<th>' + e.codigo + '</th>').join('') + '</tr></thead><tbody>' +
    Object.keys(C.etapas_afectadas).map(k => '<tr><td class="nombre">' + esc(k) + '</td>' + E.equipos.map(e => '<td><input type="checkbox" data-et="' + esc(k) + '" value="' + e.id + '"' + (C.etapas_afectadas[k].indexOf(e.id) >= 0 ? ' checked' : '') + '></td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  $('parSim').innerHTML = CAMPOS_SIM.map(([k, n, ops]) => '<div class="campo"><label>' + n + '</label>' + (ops ? '<select data-k="' + k + '">' + ops.map(o => '<option' + (String(E.sim[k]) === o ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>'
    : '<input type="number" step="any" data-k="' + k + '" value="' + E.sim[k] + '">') + '</div>').join('');
  $('parListas').innerHTML = Object.keys(E.listas).map(k => '<div class="campo"><label>' + (NOM_LISTAS[k] || k) + ' (' + E.listas[k].length + ')</label><textarea data-l="' + k + '" rows="6">' + esc(E.listas[k].join('\n')) + '</textarea></div>').join('');
}

function pintarFeriados() {
  const p = borrador || E.periodo;
  $('parFeriados').innerHTML = '<thead><tr><th>Fecha</th><th>Día</th><th>Motivo</th><th></th></tr></thead><tbody>' + p.feriados.map((f, i) => {
    const dia = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][new Date(f.fecha + 'T12:00:00Z').getUTCDay()];
    return '<tr><td>' + f.fecha + '</td><td>' + dia + (dia === 'domingo' ? ' <span class="marcador m-info">cae en domingo</span>' : '') + '</td><td>' + esc(f.motivo) + '</td><td><button class="btn btn-danger btn-sm" data-f="' + i + '"><i class="fas fa-trash"></i></button></td></tr>';
  }).join('') + '</tbody>';
  $('parFeriados').querySelectorAll('[data-f]').forEach(b => b.onclick = () => { borrador = borrador || copia(E.periodo); borrador.feriados.splice(+b.dataset.f, 1); pintarFeriados(); pintarResumen(); aviso('Feriado retirado; pulse «Guardar y recalcular»', 'warn'); });
}
function pintarResumen() {
  const p = copia(borrador || E.periodo);
  $('parPeriodo').querySelectorAll('[data-k]').forEach(i => { p[i.dataset.k] = i.type === 'number' ? +i.value : i.value; });
  let c; try { c = calendarioOEE(p).total; } catch (e) { return; }
  $('parCalendario').innerHTML = [[n0(c.dias), 'Días calendario'], [n0(c.domingos), 'Domingos'], [n0(c.feriados) + (c.feriadosEnDomingo ? ' + ' + c.feriadosEnDomingo : ''), 'Feriados (+ en domingo)'], [n0(c.laborables), 'Días laborables'],
    [h1(c.totalProduccion) + ' h', 'Tiempo total de producción'], [h1(c.carga) + ' h', 'Tiempo de carga']].map(x => '<div class="m"><div class="v">' + x[0] + '</div><div class="k">' + x[1] + '</div></div>').join('');
}
