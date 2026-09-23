/* Lectura de archivos Excel con SheetJS (inyectado). Toma la hoja «Registro» si existe, si no la primera
   hoja cuyo encabezado coincida; ubica la fila de encabezados (fila 1 en plantillas del sistema, fila 4 en
   los archivos de especificación) y entrega la matriz de datos cruda a la validación. */
import { ubicarEncabezados, validarFilas } from './validacion.js';

export function leerLibro(XLSX, datos) {
  return XLSX.read(datos, { type: datos instanceof ArrayBuffer ? 'array' : 'buffer', cellDates: false, cellNF: false, cellText: false });
}

export function extraerTabla(XLSX, libro, defId) {
  const nombres = libro.SheetNames.slice();
  const orden = nombres.filter(n => /^registro$/i.test(n.trim())).concat(nombres.filter(n => !/^registro$/i.test(n.trim())));
  for (const n of orden) {
    const m = XLSX.utils.sheet_to_json(libro.Sheets[n], { header: 1, raw: true, defval: null, blankrows: true });
    const i = ubicarEncabezados(defId, m);
    if (i >= 0) {
      let enc = (m[i] || []).map(v => v == null ? '' : String(v));
      while (enc.length && enc[enc.length - 1].trim() === '') enc.pop();
      return { hoja: n, filaEncabezado: i + 1, encabezados: enc, filas: m.slice(i + 1).map(f => (f || []).slice(0, enc.length)) };
    }
  }
  return null;
}

export function procesarArchivo(XLSX, datos, defId, ctx, opciones) {
  let libro;
  try { libro = leerLibro(XLSX, datos); }
  catch (e) { return { rechazoArchivo: 'No se pudo leer el archivo como Excel: ' + e.message, errores: [{ fila: '—', columna: '—', motivo: 'Archivo ilegible: ' + e.message, severidad: 'Archivo rechazado' }], advertencias: [], validos: [], conAdvertencia: [] }; }
  const t = extraerTabla(XLSX, libro, defId);
  if (!t) return { rechazoArchivo: 'Ninguna hoja del archivo tiene los encabezados de la plantilla de este registro.', errores: [{ fila: '—', columna: '(encabezados)', motivo: 'No se encontraron los encabezados de la plantilla', severidad: 'Archivo rechazado' }], advertencias: [], validos: [], conAdvertencia: [] };
  const inf = validarFilas(defId, t.encabezados, t.filas, ctx, Object.assign({ filaBase: t.filaEncabezado + 1 }, opciones || {}));
  inf.hoja = t.hoja; inf.filaEncabezado = t.filaEncabezado; inf.totalFilas = t.filas.length;
  return inf;
}
