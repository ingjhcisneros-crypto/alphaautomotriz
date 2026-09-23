/* Genera archivos de prueba a partir de las PLANTILLAS DEL SISTEMA: se descarga la plantilla, se quitan las
   filas de ejemplo y se llena con datos conocidos, igual que lo haría el usuario en Excel. */
import XLSX from 'xlsx';
import { generarPlantilla } from '../src/core/plantillas.js';
import { REGISTROS } from '../src/core/registros.js';
import { serieExcel } from '../src/core/xlsx.js';
import { contextoBase } from './contexto.mjs';

/* Convierte registros normalizados en filas de la plantilla (fechas como número de serie de Excel). */
export function filasDesdeRegistros(defId, regs, equipos) {
  const d = REGISTROS[defId], nom = id => (equipos.find(e => e.id === id) || {}).nombre || id;
  return regs.map((r, i) => d.columnas.map(c => {
    if (c.k === 'n') return i + 1;
    const v = r[c.k];
    if (c.tipo === 'fecha') return v ? serieExcel(v) : null;
    if (c.tipo === 'equipo') return nom(v);
    return v == null ? null : v;
  }));
}

/* Plantilla del sistema llenada con filas (se eliminan las tres filas de ejemplo). */
export function plantillaLlena(defId, filas, ctx = contextoBase(), conservarEjemplos = false) {
  const bytes = generarPlantilla(defId, ctx);
  const wb = XLSX.read(bytes, { type: 'array' });
  const ws = wb.Sheets.Registro;
  const enc = XLSX.utils.sheet_to_json(ws, { header: 1 })[0];
  const aoa = [enc].concat(conservarEjemplos ? XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }).slice(1) : []).concat(filas);
  const nueva = XLSX.utils.aoa_to_sheet(aoa);
  const d = REGISTROS[defId];
  d.columnas.forEach((c, j) => { if (c.tipo !== 'fecha') return; for (let i = 1; i < aoa.length; i++) { const ref = XLSX.utils.encode_cell({ r: i, c: j }); if (nueva[ref] && typeof nueva[ref].v === 'number') nueva[ref].z = 'dd/mm/yyyy hh:mm'; } });
  wb.Sheets.Registro = nueva;
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
