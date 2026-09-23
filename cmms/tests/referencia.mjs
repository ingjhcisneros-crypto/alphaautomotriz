/* Carga los archivos de especificación a través del flujo normal de validación (solo para auditorías). */
import XLSX from 'xlsx';
import fs from 'fs';
import { contextoBase, DIR_REF } from './contexto.mjs';
import { procesarArchivo } from '../src/core/lector.js';
export const ARCHIVOS = { correctivo: '03_Registro_de_mantenimiento_correctivo', no_conformidades: '04_Registro_de_no_conformidades_de_calidad', cambio_formato: '06_Registro_de_cambio_de_formato_y_analisis_SMED', paradas_cortas: '07_Registro_de_paradas_cortas_y_mantenimiento_autonomo', equipos_auxiliares: '08_Registro_de_fallas_en_equipos_auxiliares' };
export const VACIO_REF = [['Molino',12,6],['Extruder',25,15],['Prensa 1',35,20],['Prensa 2',35,20],['Prensa 3',35,20],['Prensa 4',35,20],['Prensa 5',35,20],['Autoclave',28,12],['Caldero 1',45,10],['Caldero 2',45,10]];
/* 144 h de reuniones de emergencia: 72 reuniones de 2 h distribuidas en días laborables del periodo. */
export function reunionesRef(periodo) {
  const out = []; let f = new Date(Date.UTC(2025, 5, 2));
  while (out.length < 72) { const s = f.toISOString().slice(0, 10); const dow = f.getUTCDay(); if (dow !== 0 && !periodo.feriados.some(x => x.fecha === s)) out.push([String(out.length + 1), s.split('-').reverse().join('/') + ' 10:00', '1', 2, 'Parada de coordinación de emergencia', 'Producción', 'Toda la línea']); f = new Date(f.getTime() + 4 * 86400000); }
  return out;
}
export function cargarReferencia(ctx) {
  const reg = {};
  for (const [k, f] of Object.entries(ARCHIVOS)) reg[k] = procesarArchivo(XLSX, fs.readFileSync(DIR_REF + '/' + f + '.xlsx'), k, ctx, { forzar: true }).validos;
  return reg;
}
