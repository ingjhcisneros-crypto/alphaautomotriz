/* Registros operativos: plantilla, carga por Excel en dos modos, informe de validación, alta/edición manual. */
import { $, esc, h1, n0, aviso, dialogo, confirmar, descargar, XLSX_MIME, fechaArchivo, libroTabla } from './comun.js';
import { E, escuchar, validarArchivo, insertar, existentes, guardarManual, borrarRegistros, vaciarRegistro, BDexp } from '../servicio.js';
import { REGISTROS, ORDEN_REGISTROS } from '../../core/registros.js';
import { generarPlantilla } from '../../core/plantillas.js';
import { etiquetaMes, mesesDelPeriodo } from '../../core/calendario.js';
import { EST } from '../../core/xlsx.js';
import { separarDuplicados } from '../../core/validacion.js';

let actual = 'correctivo', informe = null, archivoDatos = null, archivoNombre = '', pagina = 0, seleccion = new Set();
const POR_PAG = 50;
const puedeEditar = () => { const s = globalThis.LEGADO && globalThis.LEGADO.sesion(); return !s || s.rol === 'Administrador' || s.rol === 'Ingeniero de mantenimiento'; };

export function montar() {
  $('regTabs').innerHTML = ORDEN_REGISTROS.map(k => '<button class="pest" data-r="' + k + '">' + REGISTROS[k].nombre + ' <span class="cuenta" data-c="' + k + '"></span></button>').join('');
  $('regTabs').querySelectorAll('.pest').forEach(b => b.onclick = () => { actual = b.dataset.r; limpiarCarga(); pagina = 0; pintar(); });
  $('regPlantilla').onclick = () => {
    const bytes = generarPlantilla(actual, { listas: E.listas, codigos: E.codigos, periodo: E.periodo });
    descargar(bytes, 'Plantilla_' + REGISTROS[actual].archivo + '.xlsx', XLSX_MIME);
  };
  $('regArchivo').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    archivoNombre = f.name; informe = null; $('regResultado').innerHTML = ''; $('regInsertar').disabled = true; $('regInforme').disabled = true;
    const lr = new FileReader();
    lr.onload = () => { archivoDatos = lr.result; $('regValidar').disabled = false; };
    lr.onerror = () => aviso('No se pudo leer el archivo: ' + lr.error, 'bad');
    lr.readAsArrayBuffer(f);
  };
  $('regValidar').onclick = validar;
  $('regForzar').onchange = () => { if (archivoDatos) validar(); };
  $('regInsertar').onclick = insertarValidados;
  $('regInforme').onclick = descargarInforme;
  $('regNuevo').onclick = () => formulario(null);
  $('regExportar').onclick = exportarRegistros;
  $('regVaciar').onclick = async () => {
    if (!puedeEditar()) return aviso('Su perfil no permite borrar registros', 'warn');
    const n = existentes(actual).length; if (!n) return aviso('El registro está vacío', 'warn');
    if (await confirmar('Vaciar registro', '<p>Se eliminarán <b>' + n + '</b> registros de «' + REGISTROS[actual].nombre + '» del periodo. Se guarda un respaldo en la base y el OEE se recalcula.</p>', 'Vaciar', true)) {
      await vaciarRegistro(actual); aviso('Registro vaciado; respaldo guardado en Auditoría');
    }
  };
  ['regFMes', 'regFEq'].forEach(id => $(id).onchange = () => { pagina = 0; pintarTabla(); });
  $('regBuscar').oninput = () => { pagina = 0; pintarTabla(); };
  $('regAnt').onclick = () => { if (pagina > 0) { pagina--; pintarTabla(); } };
  $('regSig').onclick = () => { pagina++; pintarTabla(); };
  escuchar('datos', () => { if ($('v-registros').classList.contains('on')) pintar(); });
}

function limpiarCarga() { informe = null; archivoDatos = null; $('regArchivo').value = ''; $('regResultado').innerHTML = ''; ['regValidar', 'regInsertar', 'regInforme'].forEach(i => $(i).disabled = true); }

export function pintar() {
  $('regTabs').querySelectorAll('.pest').forEach(b => b.classList.toggle('on', b.dataset.r === actual));
  ORDEN_REGISTROS.forEach(k => { const c = $('regTabs').querySelector('[data-c="' + k + '"]'); if (c) c.textContent = existentes(k).length; });
  const d = REGISTROS[actual];
  $('regTitulo').textContent = d.nombre;
  $('regSub').textContent = 'Tabla ' + d.tabla + ' · alimenta ' + d.componente.toLowerCase() + ' · archivo de referencia ' + d.archivo + ' · ' + d.columnas.length + ' columnas';
  const meses = mesesDelPeriodo(E.periodo);
  $('regFMes').innerHTML = '<option value="">Todos los meses</option>' + meses.map(m => '<option value="' + m + '">' + etiquetaMes(m) + '</option>').join('');
  const eqCol = d.columnas.find(c => c.k === d.equipo);
  const vals = eqCol && eqCol.tipo === 'equipo' ? E.equipos.map(e => [e.id, e.nombre]) : (E.listas[eqCol ? eqCol.lista : ''] || []).map(v => [v, v]);
  $('regFEq').innerHTML = '<option value="">Todos</option>' + vals.map(v => '<option value="' + esc(v[0]) + '">' + esc(v[1]) + '</option>').join('');
  $('regFMes').disabled = !!d.sinFecha;
  pintarTabla();
}

const nomEq = id => { const e = E.equipos.find(x => x.id === id); return e ? e.nombre : id; };
function valorCelda(c, r) {
  const v = r[c.k];
  if (c.tipo === 'fecha') return v ? v.slice(8, 10) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4) + ' ' + v.slice(11, 16) : '';
  if (c.tipo === 'equipo') return nomEq(v);
  if (c.tipo === 'num') return v == null ? '' : (Math.round(v * 1000) / 1000).toLocaleString('es-PE');
  return v == null ? '' : v;
}
function filtrados() {
  const d = REGISTROS[actual], m = $('regFMes').value, eq = $('regFEq').value, q = $('regBuscar').value.trim().toLowerCase();
  return existentes(actual).filter(r => (!m || r.mes === m) && (!eq || r[d.equipo] === eq) && (!q || JSON.stringify(r).toLowerCase().indexOf(q) >= 0))
    .sort((a, b) => (a[d.inicio] || a.equipo_id || '') < (b[d.inicio] || b.equipo_id || '') ? -1 : 1);
}
function pintarTabla() {
  const d = REGISTROS[actual], lista = filtrados(), tot = existentes(actual).length;
  const pags = Math.max(1, Math.ceil(lista.length / POR_PAG)); if (pagina >= pags) pagina = pags - 1;
  const vista = lista.slice(pagina * POR_PAG, (pagina + 1) * POR_PAG);
  $('regConteo').textContent = n0(tot);
  $('regPag').textContent = 'Página ' + (pagina + 1) + ' de ' + pags + ' · ' + n0(lista.length) + ' registros filtrados';
  const cols = d.columnas;
  let h = '<thead><tr>' + cols.map(c => '<th>' + esc(c.h) + '</th>').join('') + (d.sinFecha ? '' : '<th>Día de producción</th>') + '<th></th></tr></thead><tbody>';
  if (!vista.length) h += '<tr><td colspan="' + (cols.length + 2) + '" class="chico tenue">Sin registros. Descargue la plantilla, llénela y súbala, o agregue un registro manual.</td></tr>';
  vista.forEach(r => {
    h += '<tr>' + cols.map(c => '<td class="' + (c.tipo === 'num' ? 'num' : c.tipo === 'texto' ? 'chico' : '') + '">' + esc(valorCelda(c, r)) + '</td>').join('') +
      (d.sinFecha ? '' : '<td class="chico">' + esc(r.dia_prod || '') + (r.forzado ? ' <span class="marcador m-warn">forzado</span>' : '') + '</td>') +
      '<td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-ed="' + r.id + '" title="Editar"><i class="fas fa-pen"></i></button> <button class="btn btn-danger btn-sm" data-del="' + r.id + '" title="Borrar"><i class="fas fa-trash"></i></button></td></tr>';
  });
  $('regTabla').innerHTML = h + '</tbody>';
  $('regTabla').querySelectorAll('[data-ed]').forEach(b => b.onclick = () => formulario(existentes(actual).find(r => r.id === +b.dataset.ed)));
  $('regTabla').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!puedeEditar()) return aviso('Su perfil no permite borrar registros', 'warn');
    if (await confirmar('Borrar registro', '<p>El registro se elimina y el OEE se recalcula automáticamente.</p>', 'Borrar', true)) { await borrarRegistros(actual, [+b.dataset.del]); aviso('Registro borrado; OEE recalculado'); }
  });
}

async function validar() {
  if (!archivoDatos) return;
  const t0 = performance.now();
  try { informe = validarArchivo(actual, archivoDatos, globalThis.XLSX, { forzar: $('regForzar').checked }); }
  catch (e) { informe = { rechazoArchivo: 'Error al procesar el archivo: ' + e.message, errores: [{ fila: '—', columna: '—', motivo: e.message, severidad: 'Archivo rechazado' }], advertencias: [], validos: [], conAdvertencia: [] }; }
  const dur = performance.now() - t0;
  const modo = document.querySelector('input[name="regModo"]:checked').value;
  const I = informe;
  let dup = 0; if (!I.rechazoArchivo && modo === 'incremental') { dup = separarDuplicados(actual, I.validos, existentes(actual)).duplicados.length; }
  const errFilas = new Set(I.errores.map(e => e.fila)).size;
  let h = '<div class="banda chica" style="margin-top:var(--s4)">' +
    [[I.rechazoArchivo ? '—' : n0((I.totalFilas || 0) - (I.vacias || 0)), 'Filas leídas (hoja «' + esc(I.hoja || '—') + '», encabezado en fila ' + (I.filaEncabezado || '—') + ')'],
      [n0(I.validos.length), 'Válidas'], [n0(errFilas), 'Rechazadas por error'], [n0(I.conAdvertencia.length), 'Con advertencia sin forzar'],
      [n0(I.ejemplos || 0), 'Filas de ejemplo omitidas'], [modo === 'incremental' ? n0(dup) : '—', 'Duplicados que se omitirán']].map(x => '<div class="m"><div class="v">' + x[0] + '</div><div class="k">' + x[1] + '</div></div>').join('') + '</div>';
  if (I.rechazoArchivo) h += '<p class="marcador m-bad" style="margin-top:var(--s3);display:inline-block">Archivo rechazado: ' + esc(I.rechazoArchivo) + '</p>';
  const lista = I.errores.concat(I.advertencias).sort((a, b) => (+a.fila || 0) - (+b.fila || 0));
  if (lista.length) h += '<h3 style="margin-top:var(--s4)">Detalle de la validación (' + n0(lista.length) + ')</h3><div class="tabla-caja alta"><table><thead><tr><th class="num">Fila</th><th>Columna</th><th>Motivo</th><th>Resultado</th></tr></thead><tbody>' +
    lista.slice(0, 500).map(e => '<tr><td class="num">' + e.fila + '</td><td>' + esc(e.columna) + '</td><td>' + esc(e.motivo) + '</td><td><span class="marcador ' + (/rechaz/i.test(e.severidad) ? 'm-bad' : /Omitida/.test(e.severidad) ? 'm-info' : 'm-warn') + '">' + esc(e.severidad) + '</span></td></tr>').join('') +
    '</tbody></table></div>' + (lista.length > 500 ? '<p class="nota">Se muestran 500; el informe descargable contiene todas.</p>' : '');
  h += '<p class="nota">Validación en ' + Math.round(dur) + ' ms. ' + (I.validos.length ? 'Pulse «Insertar» para registrar las ' + n0(I.validos.length) + ' filas válidas. Las filas rechazadas no se insertan.' : 'No hay filas válidas para insertar.') + '</p>';
  $('regResultado').innerHTML = h;
  $('regInsertar').disabled = !!I.rechazoArchivo || !I.validos.length;
  $('regInforme').disabled = false;
}

async function insertarValidados() {
  if (!informe || !informe.validos.length) return;
  if (!puedeEditar()) return aviso('Su perfil no permite cargar registros', 'warn');
  const modo = document.querySelector('input[name="regModo"]:checked').value, d = REGISTROS[actual];
  const rechazadas = new Set(informe.errores.map(e => e.fila)).size + informe.conAdvertencia.length;
  if (modo === 'completa') {
    const n = existentes(actual).length;
    const ok = await confirmar('Carga completa (reemplazo)', '<p class="marcador m-bad" style="display:inline-block">Advertencia</p><p>Se eliminarán <b>' + n0(n) + '</b> registros existentes de «' + esc(d.nombre) + '» del periodo ' + esc(E.periodo.nombre) +
      ' y se insertarán <b>' + n0(informe.validos.length) + '</b> del archivo.' + (rechazadas ? ' <b>' + rechazadas + '</b> filas del archivo quedan fuera por error o advertencia.' : '') + '</p><p>Antes de reemplazar se guarda un respaldo del estado anterior, que se descarga automáticamente.</p>', 'Reemplazar ' + n0(n) + ' registros', true);
    if (!ok) return;
    const res = await insertar(actual, informe.validos, 'completa');
    const previos = (await BDexp.uno('respaldos', res.respaldoId)).registros;
    descargar(libroRegistros(actual, previos, 'Respaldo previo a la carga completa'), 'Respaldo_' + d.tabla + '_' + fechaArchivo() + '.xlsx', XLSX_MIME);
    dialogo('Carga completa terminada', '<p>' + n0(res.eliminados) + ' registros eliminados (respaldo descargado y guardado en Auditoría) · <b>' + n0(res.insertados) + '</b> insertados · ' + res.duplicados + ' duplicados internos del archivo omitidos · ' + rechazadas + ' filas rechazadas.</p><p>El OEE se recalculó automáticamente.</p>');
  } else {
    const res = await insertar(actual, informe.validos, 'incremental');
    dialogo('Carga incremental terminada', '<div class="banda chica">' + [[n0(res.insertados), 'Insertados'], [n0(res.duplicados), 'Omitidos por duplicado'], [n0(rechazadas), 'Rechazados por error o advertencia']].map(x => '<div class="m"><div class="v">' + x[0] + '</div><div class="k">' + x[1] + '</div></div>').join('') + '</div><p class="nota">El OEE se recalculó automáticamente.</p>');
  }
  limpiarCarga(); pintar();
}

function descargarInforme() {
  if (!informe) return;
  const lista = informe.errores.concat(informe.advertencias).sort((a, b) => (+a.fila || 0) - (+b.fila || 0));
  descargar(libroTabla('Validación', ['Fila', 'Columna', 'Motivo', 'Resultado'], lista.map(e => [e.fila, e.columna, e.motivo, e.severidad]), 'Informe de validación · ' + REGISTROS[actual].nombre + ' · ' + archivoNombre),
    'Informe_validacion_' + REGISTROS[actual].tabla + '_' + fechaArchivo() + '.xlsx', XLSX_MIME);
}

function libroRegistros(defId, regs, titulo) {
  const d = REGISTROS[defId];
  return libroTabla('Registro', d.columnas.map(c => c.h), regs.map(r => d.columnas.map(c => c.tipo === 'fecha' && r[c.k] ? { v: r[c.k], t: 'd', s: EST.num1 } : c.tipo === 'equipo' ? nomEq(r[c.k]) : r[c.k])), titulo);
}
function exportarRegistros() { descargar(libroRegistros(actual, filtrados(), REGISTROS[actual].nombre + ' · ' + E.periodo.nombre), REGISTROS[actual].tabla + '_' + fechaArchivo() + '.xlsx', XLSX_MIME); }

/* Formulario de alta/edición generado desde la definición del registro. */
async function formulario(reg) {
  if (!puedeEditar()) return aviso('Su perfil no permite registrar o editar', 'warn');
  const d = REGISTROS[actual];
  const campo = c => {
    let v = reg ? reg[c.k] : '';
    if (c.tipo === 'equipo' && reg) v = nomEq(v);
    let input;
    if (c.tipo === 'fecha') input = '<input type="datetime-local" data-k="' + c.k + '" value="' + (v || '') + '">';
    else if (c.lista || c.tipo === 'codigo') {
      const vals = c.tipo === 'codigo' ? E.codigos.map(x => x.codigo) : (E.listas[c.lista] || []);
      input = '<select data-k="' + c.k + '"><option value=""></option>' + vals.map(x => '<option' + (String(x) === String(v) ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select>';
    } else if (c.tipo === 'num') input = '<input type="number" step="any" data-k="' + c.k + '" value="' + (v == null ? '' : v) + '">';
    else input = '<input type="text" data-k="' + c.k + '" value="' + esc(v || '') + '">';
    return '<div class="campo"><label>' + esc(c.h) + (c.req ? ' *' : '') + '</label>' + input + '</div>';
  };
  const html = '<div class="rejilla c3">' + d.columnas.map(campo).join('') + '</div><label class="interruptor" style="margin-top:var(--s3)"><input type="checkbox" data-forzar> Forzar si hay advertencias (domingo, feriado u hora fuera de ventana)</label><div data-msg></div>';
  const leer = capa => { const o = {}; capa.querySelectorAll('[data-k]').forEach(i => { let v = i.value; if (i.type === 'datetime-local' && v) v = v.replace('T', ' '); o[i.dataset.k] = v; }); o._forzar = capa.querySelector('[data-forzar]').checked; return o; };
  for (;;) {
    const vals = await dialogo((reg ? 'Editar' : 'Nuevo') + ' · ' + d.nombre, html, [{ t: 'Cancelar', v: null }, { t: 'Guardar', v: leer }], 980);
    if (!vals) return;
    const res = await guardarManual(actual, vals, reg ? reg.id : null, vals._forzar);
    if (res.ok) { aviso('Registro guardado; OEE recalculado'); return; }
    const I = res.informe, msgs = I.errores.concat(I.conAdvertencia.map(x => ({ columna: '—', motivo: x.motivos.join('; ') + ' (marque «Forzar» para insertarlo)' })));
    await dialogo('No se guardó', '<ul>' + msgs.map(e => '<li><b>' + esc(e.columna) + ':</b> ' + esc(e.motivo) + '</li>').join('') + '</ul>');
    reg = Object.assign({}, reg || {}, vals);
    if (vals.equipo_id) reg.equipo_id = (E.equipos.find(e => e.nombre === vals.equipo_id) || {}).id || vals.equipo_id;
    Object.keys(vals).forEach(k => { const c = d.columnas.find(x => x.k === k); if (c && c.tipo === 'fecha' && vals[k]) reg[k] = vals[k].replace(' ', 'T'); });
  }
}
