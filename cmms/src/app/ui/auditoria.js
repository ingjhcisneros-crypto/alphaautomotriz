/* Verificaciones en caliente sobre la base real del usuario (integridad, idempotencia, catálogos, esquema). */
import { $, esc, h1, n0, aviso, descargar, fechaArchivo, registrarExportador, confirmar, XLSX_MIME, libroTabla } from './comun.js';
import { E, ctx, BDexp, respaldoCompleto, restaurar } from '../servicio.js';
import { REGISTROS } from '../../core/registros.js';
import { calcularOEE } from '../../core/oee.js';
import { LISTAS_SEMILLA } from '../../core/catalogos.js';
import { normCmp } from '../../core/util.js';

let filasAud = [];
export function montar() {
  $('audCorrer').onclick = correr;
  $('audRespaldo').onclick = async () => { const r = await respaldoCompleto(); descargar(JSON.stringify(r), 'Respaldo_CMMS_' + fechaArchivo() + '.json', 'application/json'); };
  $('audRestaurar').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (!(await confirmar('Restaurar respaldo', '<p>Se reemplazará TODO el contenido de la base de este equipo por el del archivo «' + esc(f.name) + '».</p>', 'Restaurar', true))) return;
    try { await restaurar(JSON.parse(await f.text())); aviso('Respaldo restaurado'); pintar(); } catch (err) { aviso('No se pudo restaurar: ' + err.message, 'bad', 8000); }
    e.target.value = '';
  };
  registrarExportador('audTabla', () => ({ titulo: 'Verificaciones del sistema', encabezados: ['Verificación', 'Resultado', 'Detalle'], filas: filasAud.map(f => [f[0], f[1] ? 'Cumple' : 'No cumple', f[2]]) }));
}

export async function pintar() {
  const resp = await BDexp.todos('respaldos'), bit = await BDexp.todos('bitacora');
  $('audRespaldos').innerHTML = '<thead><tr><th>Fecha</th><th>Registro</th><th>Motivo</th><th class="num">Registros</th><th></th></tr></thead><tbody>' +
    (resp.length ? resp.slice().reverse().map(r => '<tr><td>' + new Date(r.fecha).toLocaleString('es-PE') + '</td><td>' + esc(REGISTROS[r.registro] ? REGISTROS[r.registro].nombre : r.tabla) + '</td><td>' + esc(r.motivo) + '</td><td class="num">' + n0(r.registros.length) +
      '</td><td><button class="btn btn-ghost btn-sm" data-r="' + r.id + '"><i class="fas fa-download"></i> Excel</button></td></tr>').join('') : '<tr><td colspan="5" class="chico tenue">Sin respaldos de cargas completas todavía.</td></tr>') + '</tbody>';
  $('audRespaldos').querySelectorAll('[data-r]').forEach(b => b.onclick = async () => {
    const r = await BDexp.uno('respaldos', +b.dataset.r), d = REGISTROS[r.registro];
    descargar(libroTabla('Registro', d.columnas.map(c => c.h), r.registros.map(x => d.columnas.map(c => c.tipo === 'equipo' ? (E.equipos.find(e => e.id === x[c.k]) || {}).nombre : c.tipo === 'fecha' && x[c.k] ? { v: x[c.k], t: 'd', s: 9 } : x[c.k])), 'Respaldo ' + d.nombre + ' · ' + r.fecha), 'Respaldo_' + d.tabla + '_' + r.id + '.xlsx', XLSX_MIME);
  });
  $('audBitacora').innerHTML = '<thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>' + bit.slice(-300).reverse().map(b => '<tr><td class="chico">' + new Date(b.fecha).toLocaleString('es-PE') + '</td><td class="chico">' + esc(b.usuario) + '</td><td>' + esc(b.accion) + '</td><td class="chico">' + esc(b.detalle) + '</td></tr>').join('') + '</tbody>';
}

function correr() {
  const F = [];
  const tablas = BDexp.nombresTablas();
  const falt = Object.values(REGISTROS).map(d => d.tabla).filter(t => tablas.indexOf(t) < 0);
  F.push(['Las siete tablas de registros existen en IndexedDB', !falt.length, falt.length ? 'Faltan: ' + falt.join(', ') : Object.values(REGISTROS).map(d => d.tabla).join(', ')]);
  F.push(['Catálogo de equipos poblado', E.equipos.length >= 10, E.equipos.length + ' equipos · ' + E.equipos.filter(e => e.activo).length + ' activos']);
  const listasOk = Object.keys(LISTAS_SEMILLA).every(k => (E.listas[k] || []).length);
  F.push(['Catálogos (hojas «Listas») poblados', listasOk, Object.keys(E.listas).map(k => k + ' ' + E.listas[k].length).join(' · ')]);
  F.push(['Diccionario de códigos de causa poblado', E.codigos.length > 0, E.codigos.length + ' códigos']);
  const cont = Object.values(REGISTROS).map(d => d.nombre + ': ' + n0(E.registros[d.id].length));
  const tot = Object.values(REGISTROS).reduce((a, d) => a + E.registros[d.id].length, 0);
  F.push(['Registros operativos en la base', true, tot ? n0(tot) + ' registros · ' + cont.join(' · ') : 'Sistema vacío de registros operativos (estado de instalación)']);
  const rp = k => E.registros[k].filter(r => r.periodo_id === E.periodo.id);
  const directo = {
    correctivo: rp('correctivo').reduce((a, r) => a + r.horas, 0), setup: rp('cambio_formato').filter(r => normCmp(r.clasificacion_actual) === 'interna').reduce((a, r) => a + (+r.duracion_actividad_h || 0), 0),
    reuniones: rp('reuniones_emergencia').reduce((a, r) => a + r.horas, 0), auxiliares: rp('equipos_auxiliares').reduce((a, r) => a + r.horas, 0), microparadas: rp('paradas_cortas').reduce((a, r) => a + r.horas, 0),
    calidad: rp('no_conformidades').reduce((a, r) => a + r.horas, 0)
  };
  const T = E.total, HM = T.lineaHM.total;
  const tablero = { correctivo: HM.correctivo, setup: HM.setup, reuniones: T.linea.total.perdidas.reuniones, auxiliares: T.linea.total.perdidas.auxiliares, microparadas: HM.microparadas, calidad: HM.defectos + HM.reprocesos };
  Object.keys(directo).forEach(k => { const d = Math.abs(directo[k] - tablero[k]); F.push(['Integridad · ' + k + ': suma de registros = tablero (± 0.1 h)', d <= 0.1, 'Registros ' + h1(directo[k]) + ' h · tablero ' + h1(tablero[k]) + ' h · diferencia ' + d.toFixed(4) + ' h']); });
  const base = Object.assign(ctx(), { registros: Object.fromEntries(Object.keys(E.registros).map(k => [k, rp(k)])), filtros: {} });
  const a = JSON.stringify(calcularOEE(base)), b = JSON.stringify(calcularOEE(base));
  F.push(['Recálculo idempotente (dos ejecuciones idénticas)', a === b, 'Huellas ' + a.length + ' / ' + b.length + ' caracteres']);
  const L = T.linea.total, cad = Math.abs(L.carga - L.va - Object.values(L.perdidas).reduce((x, y) => x + y, 0));
  F.push(['Cadena de tiempos cerrada: carga − pérdidas = valor añadido', cad < 1e-6, 'Diferencia ' + cad.toExponential(2) + ' h']);
  F.push(['Producción = valor añadido × capacidad del cuello de botella', Math.abs(L.produccion - L.va * E.periodo.capacidad_cuello_botella) < 1e-6, n0(L.produccion) + ' láminas']);
  F.push(['Último recálculo registrado', !!E.ultimoRecalculo, E.ultimoRecalculo ? E.ultimoRecalculo.toLocaleString('es-PE') + ' · ' + E.duracionRecalculo.toFixed(0) + ' ms' : '—']);
  F.push(['Modelo de simulación vigente respecto de los registros', !!E.modelo && E.modelo.versionDatos === E.versionDatos, E.modelo ? 'Ajustado ' + new Date(E.modelo.creado).toLocaleString('es-PE') : 'Sin ajustar']);
  F.push(['Línea base de simulación validada', !!(E.validacion && E.validacion.ok), E.validacion ? (E.validacion.ok ? 'Dentro de tolerancia' : 'Fuera de tolerancia') : 'No ejecutada']);
  filasAud = F;
  $('audTabla').innerHTML = '<div class="tabla-caja"><table><thead><tr><th>Verificación</th><th>Resultado</th><th>Detalle</th></tr></thead><tbody>' + F.map(f => '<tr><td>' + esc(f[0]) + '</td><td><span class="marcador ' + (f[1] ? 'm-ok' : 'm-bad') + '">' + (f[1] ? 'Cumple' : 'No cumple') + '</span></td><td class="chico">' + esc(f[2]) + '</td></tr>').join('') + '</tbody></table></div>';
}
