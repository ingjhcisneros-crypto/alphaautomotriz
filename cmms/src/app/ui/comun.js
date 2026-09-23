/* Utilidades de interfaz compartidas por las vistas nuevas. */
import { libroTabla, escribirLibro, EST } from '../../core/xlsx.js';

export const $ = id => document.getElementById(id);
export const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const L = 'es-PE';
export const h1 = v => v == null || !isFinite(v) ? '—' : (Math.round(v * 10) / 10).toLocaleString(L, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const n0 = v => v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString(L);
export const n2 = v => v == null || !isFinite(v) ? '—' : (Math.round(v * 100) / 100).toLocaleString(L, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pc = v => v == null || !isFinite(v) ? '—' : (v * 100).toLocaleString(L, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
export const pp = v => v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v * 100).toLocaleString(L, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' pp';
export const soles = v => v == null || !isFinite(v) ? '—' : 'S/ ' + Math.round(v).toLocaleString(L);

export function banda(v) {
  if (v >= 0.85) return { c: 'var(--lima)', t: 'Excelente', k: 'exc' };
  if (v >= 0.75) return { c: 'var(--accent2)', t: 'Bueno', k: 'bue' };
  if (v >= 0.65) return { c: 'var(--warning)', t: 'Regular', k: 'reg' };
  return { c: 'var(--danger)', t: 'Malo', k: 'mal' };
}
export const cssVar = n => getComputedStyle(document.body).getPropertyValue(n).trim();

/* Avisos breves. */
export function aviso(msg, tipo = 'ok', ms = 4200) {
  let c = $('avisos'); if (!c) { c = document.createElement('div'); c.id = 'avisos'; document.body.appendChild(c); }
  const d = document.createElement('div'); d.className = 'toast ' + tipo; d.textContent = msg; c.appendChild(d);
  setTimeout(() => d.remove(), ms);
}

/* Diálogo modal genérico: devuelve el valor del botón pulsado (o null al cerrar). */
export function dialogo(titulo, html, botones = [{ t: 'Cerrar', v: null }], ancho) {
  return new Promise(ok => {
    const capa = document.createElement('div'); capa.className = 'capa medio abierta'; capa.style.zIndex = 70;
    capa.innerHTML = '<div class="dialogo" style="' + (ancho ? 'width:min(' + ancho + 'px,100%)' : '') + '"><div class="fila" style="justify-content:space-between;margin-bottom:var(--s4)"><h2>' + esc(titulo) +
      '</h2><button class="btn btn-ghost btn-sm" data-x><i class="fas fa-xmark"></i></button></div><div class="dlg-cuerpo">' + html + '</div><div class="fila" style="margin-top:var(--s5);justify-content:flex-end">' +
      botones.map((b, i) => '<button class="btn ' + (b.clase || (i === botones.length - 1 ? 'btn-primary' : 'btn-ghost')) + '" data-i="' + i + '">' + b.t + '</button>').join('') + '</div></div>';
    document.body.appendChild(capa); document.body.classList.add('bloqueado');
    const cerrar = v => { capa.remove(); if (!document.querySelector('.capa.abierta')) document.body.classList.remove('bloqueado'); ok(v); };
    capa.querySelector('[data-x]').onclick = () => cerrar(null);
    capa.addEventListener('click', e => { if (e.target === capa) cerrar(null); });
    capa.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const x = botones[+b.dataset.i]; cerrar(typeof x.v === 'function' ? x.v(capa) : x.v); });
    const onKey = e => { if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); cerrar(null); } };
    document.addEventListener('keydown', onKey);
    if (botones.onMontar) botones.onMontar(capa);
  });
}
export const confirmar = (titulo, html, textoSi = 'Confirmar', peligro) => dialogo(titulo, html, [{ t: 'Cancelar', v: false }, { t: textoSi, v: true, clase: peligro ? 'btn-danger' : 'btn-primary' }]);

/* En el artefacto publicado los enlaces de descarga están bloqueados: se usa la capacidad «downloads» (el visor
   pide confirmación). Fuera del visor, descarga directa. */
let descargas = null;
export const enVisor = () => !!(globalThis.claude && typeof globalThis.claude.use === 'function');
export function descargar(datos, nombre, tipo) {
  const blob = datos instanceof Blob ? datos : new Blob([datos], { type: tipo || 'application/octet-stream' });
  if (enVisor()) {
    descargas = descargas || globalThis.claude.use('downloads').catch(() => null);
    return descargas.then(d => {
      if (!d) { aviso('Las descargas no están disponibles en esta vista', 'warn'); return; }
      return d.save({ filename: nombre, data: blob }).then(() => aviso('Archivo guardado: ' + nombre),
        e => { if (e && e.code !== 'declined') aviso('No se pudo guardar el archivo (' + (e.code || 'error') + ')', 'warn'); });
    });
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const fechaArchivo = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

/* Exportación de bloques: cada bloque registra una función que devuelve {titulo, encabezados, filas, canvas?, colores?}. */
const EXPORTADORES = {};
export function registrarExportador(id, fn) { EXPORTADORES[id] = fn; }
export function montarExportadores(raiz = document) {
  raiz.querySelectorAll('.export[data-bloque]').forEach(c => {
    if (c.dataset.montado) return; c.dataset.montado = '1';
    c.innerHTML = '<button class="btn btn-ghost btn-sm" data-f="xlsx" title="Exportar a Excel"><i class="fas fa-file-excel"></i> Excel</button><button class="btn btn-ghost btn-sm" data-f="png" title="Exportar a PNG"><i class="fas fa-image"></i> PNG</button>';
    c.querySelectorAll('button').forEach(b => b.onclick = () => exportar(c.dataset.bloque, b.dataset.f));
  });
}
export function exportar(id, formato) {
  const fn = EXPORTADORES[id]; if (!fn) return aviso('Este bloque aún no tiene datos para exportar', 'warn');
  let d; try { d = fn(); } catch (e) { console.error(e); return aviso('No se pudo exportar: ' + e.message, 'bad'); }
  if (!d || !d.filas) return aviso('Sin datos para exportar', 'warn');
  const nombre = (d.archivo || d.titulo || id).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w -]/g, '').trim().replace(/\s+/g, '_') + '_' + fechaArchivo();
  if (formato === 'xlsx') descargar(libroTabla(d.hoja || 'Datos', d.encabezados, d.filas, d.titulo), nombre + '.xlsx', XLSX_MIME);
  else { const cv = d.canvas ? lienzoConTitulo(d.canvas, d.titulo) : tablaALienzo(d); cv.toBlob(b => descargar(b, nombre + '.png', 'image/png')); }
}
/* Gráfico con fondo y título, para PNG legible fuera de la aplicación. */
function lienzoConTitulo(canvas, titulo) {
  const cv = document.createElement('canvas'), pad = 20, th = 34;
  cv.width = canvas.width + pad * 2; cv.height = canvas.height + pad * 2 + th;
  const x = cv.getContext('2d'); x.fillStyle = cssVar('--card') || '#fff'; x.fillRect(0, 0, cv.width, cv.height);
  x.fillStyle = cssVar('--text') || '#000'; x.font = '600 16px Poppins, sans-serif'; x.fillText(titulo || '', pad, pad + 16);
  x.drawImage(canvas, pad, pad + th); return cv;
}
/* Tabla dibujada en lienzo (PNG de bloques tabulares), con color de celda opcional. */
function tablaALienzo(d) {
  const enc = d.encabezados, filas = d.filas.map(f => f.map(v => v && typeof v === 'object' ? v.v : v));
  const cx = document.createElement('canvas').getContext('2d'); cx.font = '12px Poppins, sans-serif';
  const txt = v => v == null ? '' : typeof v === 'number' ? (Math.abs(v) < 1.5 && d.porcentaje ? (v * 100).toFixed(2) + ' %' : v.toLocaleString('es-PE', { maximumFractionDigits: 2 })) : String(v);
  const anch = enc.map((h, j) => Math.min(260, Math.max(cx.measureText(h).width, ...filas.map(f => cx.measureText(txt(f[j])).width)) + 18));
  const W = anch.reduce((a, b) => a + b, 0) + 40, rh = 24, H = (filas.length + 1) * rh + 80;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#16202b'; x.font = '600 15px Poppins, sans-serif'; x.fillText(d.titulo || '', 20, 30);
  let y = 50; x.font = '600 12px Poppins, sans-serif'; x.fillStyle = '#1f5c10'; x.fillRect(20, y, W - 40, rh);
  x.fillStyle = '#fff'; let xx = 20; enc.forEach((h, j) => { x.fillText(h, xx + 8, y + 16); xx += anch[j]; });
  x.font = '12px Poppins, sans-serif';
  filas.forEach((f, i) => {
    y += rh; xx = 20;
    f.forEach((v, j) => {
      const col = d.colores && d.colores[i] && d.colores[i][j];
      if (col) { x.fillStyle = col; x.fillRect(xx, y, anch[j], rh); }
      else if (i % 2) { x.fillStyle = '#f3f6fa'; x.fillRect(xx, y, anch[j], rh); }
      x.fillStyle = '#16202b'; x.fillText(txt(v), xx + 8, y + 16); xx += anch[j];
    });
  });
  return cv;
}
export const colorExport = v => v == null ? null : v >= 0.85 ? '#b8f0a8' : v >= 0.75 ? '#dcf3cf' : v >= 0.65 ? '#fde7b0' : '#f9c4cc';
export { libroTabla, escribirLibro, EST };
