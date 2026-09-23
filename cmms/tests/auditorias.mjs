/* Auditorías del núcleo (sin navegador). Ejecutar con: npm test
   Los archivos de especificación se leen solo para extraer valores de referencia y armar datos de prueba;
   nunca se siembran en el sistema. */
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { contextoBase, DIR_REF } from './contexto.mjs';
import { ARCHIVOS, VACIO_REF, reunionesRef, cargarReferencia } from './referencia.mjs';
import { filasDesdeRegistros, plantillaLlena } from './archivos.mjs';
import { procesarArchivo } from '../src/core/lector.js';
import { calcularOEE } from '../src/core/oee.js';
import { REGISTROS, ORDEN_REGISTROS } from '../src/core/registros.js';
import { generarPlantilla } from '../src/core/plantillas.js';
import { construirModelo } from '../src/core/modelo.js';
import { correrEscenario, validarBase, comparar } from '../src/core/simulacion.js';
import { SIM_SEMILLA, ESCENARIOS_SEMILLA, LISTAS_SEMILLA } from '../src/core/catalogos.js';
import { copia } from '../src/core/util.js';

const OUT = path.resolve(import.meta.dirname, 'informe'); fs.mkdirSync(OUT, { recursive: true });
const TMP = path.join(OUT, 'archivos'); fs.mkdirSync(TMP, { recursive: true });
const informe = [];
let fallas = 0;
function check(aud, nombre, ok, detalle) { informe.push({ auditoria: aud, verificacion: nombre, ok: !!ok, detalle }); if (!ok) fallas++; console.log((ok ? '  ✔ ' : '  ✘ ') + nombre + (detalle ? ' — ' + detalle : '')); }
const cerca = (a, b, tol) => Math.abs(a - b) <= tol;
const p2 = v => (v * 100).toFixed(2);
const subir = (defId, buf, ctx, op) => procesarArchivo(XLSX, buf, defId, ctx, op);

/* ===== Auditoría 2 · Modelo de datos ===== */
console.log('\nAuditoría 2 · Modelo de datos');
const CAMPOS_SEC7 = {
  correctivo: ['fecha_hora_falla', 'fecha_hora_reinicio', 'tiempo_parada_h', 'turno', 'equipo_id', 'sistema_afectado', 'componente_fallado', 'modo_falla', 'causa_raiz', 'solucion_aplicada', 'tecnico_responsable'],
  paradas_cortas: ['fecha_hora_parada', 'fecha_hora_reinicio', 'tiempo_parada_h', 'turno', 'equipo_id', 'tipo_evento', 'condicion_detectada', 'actividad_cil', 'accion_ejecutada', 'operador_responsable'],
  cambio_formato: ['n_cambio', 'fecha_hora_parada', 'fecha_hora_reinicio', 'tiempo_setup_h', 'turno', 'equipo_id', 'formato_saliente', 'formato_entrante', 'n_operarios_asignados', 'actividad', 'duracion_actividad_h', 'clasificacion_actual', 'clasificacion_propuesta', 'tecnica_conversion', 'n_operarios', 'ejecutable_paralelo'],
  no_conformidades: ['fecha_hora_deteccion', 'turno', 'equipo_id', 'codigo_causa', 'descripcion_causa', 'tipo_no_conformidad', 'cantidad_afectada', 'unidad', 'laminas_equivalentes', 'demora_h', 'origen_causa'],
  equipos_auxiliares: ['fecha_hora_falla', 'fecha_hora_reinicio', 'tiempo_parada_h', 'turno', 'equipo_auxiliar', 'etapa_afectada', 'sistema_afectado', 'componente_fallado', 'modo_falla', 'causa_raiz', 'solucion_aplicada', 'tecnico_responsable'],
  operacion_en_vacio: ['equipo_id', 'minutos_arranque', 'minutos_post_setup', 'sustento_arranque', 'sustento_post_setup'],
  reuniones_emergencia: ['fecha', 'turno', 'duracion_h', 'motivo', 'equipos_afectados']
};
Object.entries(CAMPOS_SEC7).forEach(([k, campos]) => { const def = REGISTROS[k].columnas.map(c => c.k); const f = campos.filter(c => def.indexOf(c) < 0); check(2, 'Tabla ' + REGISTROS[k].tabla + ' con todos los campos de la sección 7', !f.length, f.length ? 'faltan ' + f.join(', ') : def.length + ' columnas'); });
const S82 = { maquina: 'Molino · Extruder · Prensa 1 · Prensa 2 · Prensa 3 · Prensa 4 · Prensa 5 · Autoclave · Caldero 1 · Caldero 2', turno: '1 · 2', sistema_afectado: 'Mecánico · Eléctrico · Hidráulico · Neumático · Térmico · Control e instrumentación',
  modo_falla: 'Desgaste · Rotura · Fuga · Obstrucción · Cortocircuito · Sobrecalentamiento · Desajuste · Corrosión', causa_raiz: 'Falta de lubricación · Fatiga de material · Sobrecarga operativa · Ausencia de inspección · Incrustación · Contaminación · Vibración excesiva · Fin de vida útil',
  actividad_cil: 'Limpieza · Inspección · Lubricación · Ajuste', clasificacion: 'Interna · Externa', tecnica_conversion: 'Preparación anticipada · Estandarización de ajustes · Sujeción rápida · Operaciones en paralelo · Eliminación de ajustes · Ninguna',
  tipo_nc: 'Reproceso · Defecto de calidad', origen_causa: 'Variación térmica del vapor · Propia del equipo', equipo_auxiliar: 'Compresor de aire · Torre de enfriamiento · Tecle de carga del autoclave · Tablero eléctrico general' };
Object.entries(S82).forEach(([k, v]) => check(2, 'Catálogo «' + k + '» = sección 8.2', JSON.stringify(LISTAS_SEMILLA[k]) === JSON.stringify(v.split(' · ')), LISTAS_SEMILLA[k].length + ' valores'));
/* Los catálogos coinciden con las hojas «Listas» de los archivos adjuntos. */
const HOJA_LISTA = { 'Turno': 'turno', 'Máquina': ['maquina', 'maquina_producto'], 'Sistema afectado': 'sistema_afectado', 'Modo de falla': 'modo_falla', 'Causa raíz': 'causa_raiz', 'Tipo de evento': 'tipo_evento', 'Actividad CIL asociada': 'actividad_cil',
  'Operador responsable': 'operador_responsable', 'Formato': 'formato', 'Clasificación': 'clasificacion', 'Técnica de conversión': 'tecnica_conversion', 'Tipo de no conformidad': 'tipo_nc', 'Origen de la causa': 'origen_causa', 'Equipo auxiliar': 'equipo_auxiliar', 'Etapa afectada': 'etapa_afectada' };
Object.values(ARCHIVOS).forEach(f => {
  const wb = XLSX.read(fs.readFileSync(DIR_REF + '/' + f + '.xlsx')); const m = XLSX.utils.sheet_to_json(wb.Sheets.Listas, { header: 1 });
  m[0].forEach((h, j) => {
    const vals = m.slice(1).map(r => r[j]).filter(v => v != null).map(String), k = HOJA_LISTA[h];
    const opciones = Array.isArray(k) ? k : [k]; const ok = opciones.some(o => JSON.stringify(LISTAS_SEMILLA[o]) === JSON.stringify(vals));
    check(2, f.slice(0, 2) + ' · Listas «' + h + '» sembrada', ok, vals.length + ' valores');
  });
});

/* ===== Auditoría 3 · Cálculo por máquina (ejemplo 4.4 cargado por plantilla) =====
   Datos sintéticos con exactamente las horas del ejemplo: correctivo 327.3 · setup interno 27.0 (más 13 h
   externas que no deben contar) · reuniones 144 · auxiliares 25.4 · microparadas 4.8 · vacío 28/12 min ·
   defectos 273.9. Las duraciones se expresan en minutos enteros, como las registra la planta. */
console.log('\nAuditoría 3 · Cálculo por máquina — autoclave');
const ctx = contextoBase();
const diasLab = []; for (let d = new Date(Date.UTC(2025, 5, 2)); diasLab.length < 200; d = new Date(d.getTime() + 86400000)) { const s = d.toISOString().slice(0, 10); if (d.getUTCDay() && !ctx.periodo.feriados.some(x => x.fecha === s)) diasLab.push(s); }
const fmt = (s, h) => s.split('-').reverse().join('/') + ' ' + h;
const sumarH = (s, hora, horas) => { const t = new Date(s + 'T' + hora + ':00Z').getTime() + horas * 3600000; const d = new Date(t); return fmt(d.toISOString().slice(0, 10), d.toISOString().slice(11, 16)); };
const ej = {
  correctivo: Array.from({ length: 10 }, (_, i) => [i + 1, fmt(diasLab[i * 7], '09:00'), sumarH(diasLab[i * 7], '09:00', i < 9 ? 32.7 : 33.0), i < 9 ? 32.7 : 33.0, '1', 'Autoclave', 'Mecánico', 'Empaquetadura', 'Fuga', 'Fatiga de material', 'Reemplazo', 'Técnico']),
  cambio_formato: Array.from({ length: 26 }, (_, i) => [[ 'CF-' + (i + 1), fmt(diasLab[i * 7 + 3], '08:00'), sumarH(diasLab[i * 7 + 3], '08:00', 27 / 26 + 0.5), 1.5, '1', 'Autoclave', 'Lámina estándar 1/4"', 'Lámina reforzada 5/16"', 1, 'Ajuste de curado', 27 / 26, 'Interna', 'Interna', 'Ninguna', 27 / 26, 1, 'No'],
    ['CF-' + (i + 1), fmt(diasLab[i * 7 + 3], '08:00'), sumarH(diasLab[i * 7 + 3], '08:00', 27 / 26 + 0.5), 1.5, '1', 'Autoclave', 'Lámina estándar 1/4"', 'Lámina reforzada 5/16"', 1, 'Preparación de racks', 0.5, 'Externa', 'Externa', 'Preparación anticipada', 0.5, 1, 'Sí']]).flat(),
  reuniones_emergencia: reunionesRef(ctx.periodo),
  equipos_auxiliares: [[1, fmt(diasLab[5], '10:00'), sumarH(diasLab[5], '10:00', 12.7), 12.7, '1', 'Tecle de carga del autoclave', 'Curado', 'Mecánico', 'Cadena', 'Rotura', 'Fatiga de material', 'Cambio', 'Técnico'],
    [2, fmt(diasLab[40], '10:00'), sumarH(diasLab[40], '10:00', 12.7), 12.7, '1', 'Tecle de carga del autoclave', 'Curado', 'Mecánico', 'Cadena', 'Rotura', 'Fatiga de material', 'Cambio', 'Técnico']],
  paradas_cortas: Array.from({ length: 12 }, (_, i) => [i + 1, fmt(diasLab[i * 9 + 2], '11:00'), sumarH(diasLab[i * 9 + 2], '11:00', 0.4), 0.4, '1', 'Autoclave', 'Acumulación de condensado', 'Condensado', 'Limpieza', 'Purga', 'Quispe Mamani, Luis Alberto']),
  operacion_en_vacio: [['Autoclave', 28, 12, 'Presurización', 'Reestabilización']],
  no_conformidades: Array.from({ length: 30 }, (_, i) => [i + 1, fmt(diasLab[i * 6 + 1], '15:00'), '1', 'Autoclave', 'DC-A1', '', 'Defecto de calidad', 3, 'lám', 3, 273.9 / 30, 'Variación térmica del vapor'])
};
const reg44 = {};
for (const [k, filas] of Object.entries(ej)) {
  const buf = plantillaLlena(k, filas, ctx); fs.writeFileSync(path.join(TMP, 'A3_' + k + '.xlsx'), buf);
  const inf = subir(k, buf, ctx); reg44[k] = inf.validos;
  check(3, 'Plantilla del sistema de ' + REGISTROS[k].nombre + ' llenada y subida', inf.validos.length === filas.length && !inf.errores.length, inf.validos.length + ' válidos, ' + inf.errores.length + ' errores');
}
const r44 = calcularOEE(Object.assign({}, ctx, { registros: reg44 })).maquina.AUT.total;
check(3, 'Tiempo de carga 4,543.4 h', r44.carga.toFixed(1) === '4543.4', r44.carga.toFixed(2) + ' h');
check(3, 'Tiempo bruto 4,019.7 h', r44.bruto.toFixed(1) === '4019.7', r44.bruto.toFixed(2) + ' h');
[['Disponibilidad', r44.D, 88.47], ['Rendimiento', r44.R, 96.30], ['Calidad', r44.Q, 92.92], ['OEE', r44.OEE, 79.17]].forEach(([n, v, e]) => check(3, n + ' ' + e.toFixed(2) + ' % (±0.01)', cerca(v * 100, e, 0.01), p2(v) + ' %'));
check(3, 'El setup externo no se descuenta', cerca(r44.perdidas.setup, 27, 1e-9), 'setup interno ' + r44.perdidas.setup.toFixed(3) + ' h de ' + (27 + 13).toFixed(1) + ' h de actividad total');

/* ===== Auditoría 4 · Cálculo de línea con los datos de referencia (plantilla del sistema) ===== */
console.log('\nAuditoría 4 · Cálculo de línea');
const ref = cargarReferencia(ctx);
const regRef = {};
for (const k of Object.keys(ARCHIVOS)) {
  const buf = plantillaLlena(k, filasDesdeRegistros(k, ref[k], ctx.equipos), ctx); fs.writeFileSync(path.join(TMP, 'A4_' + k + '.xlsx'), buf);
  const inf = subir(k, buf, ctx); regRef[k] = inf.validos;
  check(4, REGISTROS[k].nombre + ': ' + ref[k].length + ' filas por plantilla del sistema', inf.validos.length === ref[k].length && !inf.errores.length, inf.validos.length + ' válidos · ' + inf.errores.length + ' errores');
}
for (const [k, filas] of [['operacion_en_vacio', VACIO_REF.map(r => [...r, '', ''])], ['reuniones_emergencia', reunionesRef(ctx.periodo)]]) {
  const buf = plantillaLlena(k, filas, ctx); fs.writeFileSync(path.join(TMP, 'A4_' + k + '.xlsx'), buf); regRef[k] = subir(k, buf, ctx).validos;
}
const RL = calcularOEE(Object.assign({}, ctx, { registros: regRef }));
const L = RL.linea.total;
[['Disponibilidad', L.D, 76.42], ['Rendimiento', L.R, 82.85], ['Calidad', L.Q, 87.93], ['OEE de línea', L.OEE, 55.68]].forEach(([n, v, e]) => check(4, n + ' ' + e.toFixed(2) + ' % (±0.01)', cerca(v * 100, e, 0.01), p2(v) + ' % (sin redondeo ' + (v * 100).toFixed(4) + ')'));
check(4, 'Producción 20,237 láminas', Math.round(L.produccion) === 20237, Math.round(L.produccion) + '');
check(4, 'Brecha −27.69 pp', cerca(L.brecha * 100, -27.69, 0.01), (L.brecha * 100).toFixed(2) + ' pp');
[['correctivo', 685.9], ['setup', 149.9], ['reuniones', 144], ['auxiliares', 91.5], ['vacio', 454.2], ['microparadas', 141.1]].forEach(([k, e]) => check(4, 'Horas de línea · ' + k + ' ' + e, cerca(L.perdidas[k], e, 0.05), L.perdidas[k].toFixed(2) + ' h'));
check(4, 'No conformidades de línea 347.2 h', cerca(L.perdidas.defectos + L.perdidas.reprocesos, 347.2, 0.05), (L.perdidas.defectos + L.perdidas.reprocesos).toFixed(2) + ' h');
const A2 = RL.maquina.AUT.total;
check(4, 'Autoclave con los datos completos: OEE 79.17 %', cerca(A2.OEE * 100, 79.17, 0.01), p2(A2.D) + ' × ' + p2(A2.R) + ' × ' + p2(A2.Q) + ' = ' + p2(A2.OEE) + ' % · bruto ' + A2.bruto.toFixed(1) + ' h (auxiliares ' + A2.perdidas.auxiliares.toFixed(2) + ' h por reparto)');
/* Mantenimiento del programa ejecutado (planificado y calidad): descuenta del tiempo de carga de su equipo. */
const conMtto = mt => calcularOEE(Object.assign({}, ctx, { registros: regRef, mantenimiento: mt }));
const RA = conMtto([{ equipo_id: 'AUT', dia: '2025-07-10', horas: 6, tipo: 'Planificado' }, { equipo_id: 'AUT', dia: '2025-08-12', horas: 4, tipo: 'Calidad' }]);
check(4, 'Programa ejecutado: 10 h en el autoclave (serie) → carga del autoclave −10 h y carga de línea −10 h', cerca(RL.maquina.AUT.total.carga - RA.maquina.AUT.total.carga, 10, 1e-9) && cerca(L.carga - RA.linea.total.carga, 10, 1e-9) && cerca(RA.linea['2025-07'].mttoPrograma, 6, 1e-9),
  'autoclave ' + RA.maquina.AUT.total.carga.toFixed(1) + ' h · línea ' + RA.linea.total.carga.toFixed(1) + ' h · OEE línea ' + p2(RA.linea.total.OEE) + ' %');
const RP = conMtto([{ equipo_id: 'PR1', dia: '2025-07-10', horas: 10, tipo: 'Planificado' }]);
check(4, 'Programa ejecutado en una prensa (paralelo): solo baja la carga de esa prensa; la línea no se detiene', cerca(RL.maquina.PR1.total.carga - RP.maquina.PR1.total.carga, 10, 1e-9) && cerca(RP.linea.total.carga, L.carga, 1e-9) && cerca(RP.maquina.PR2.total.carga, RL.maquina.PR2.total.carga, 1e-9), 'prensa 1 ' + RP.maquina.PR1.total.carga.toFixed(1) + ' h');
check(4, 'Sin órdenes ejecutadas el resultado no cambia', cerca(conMtto([]).linea.total.OEE, L.OEE, 1e-15), '');
const direct = calcularOEE(Object.assign({}, ctx, { registros: Object.assign({}, ref, { operacion_en_vacio: regRef.operacion_en_vacio, reuniones_emergencia: regRef.reuniones_emergencia }) })).linea.total;
check(4, 'Archivos adjuntos subidos sin modificación (encabezado en fila 4) dan el mismo resultado', cerca(direct.OEE, L.OEE, 1e-12), p2(direct.OEE) + ' %');
check(4, 'Regla del turno 2: eventos 00:00–02:00 asignados al día anterior', ref.no_conformidades.filter(r => r.inicio.slice(11, 13) < '02').every(r => r.dia_prod < r.inicio.slice(0, 10)), ref.no_conformidades.filter(r => r.inicio.slice(11, 13) < '02').length + ' no conformidades entre 00:00 y 02:00');

/* ===== Auditoría 6 · Plantillas ===== */
console.log('\nAuditoría 6 · Plantillas Excel');
ORDEN_REGISTROS.forEach(k => fs.writeFileSync(path.join(TMP, 'Plantilla_' + k + '.xlsx'), generarPlantilla(k, ctx)));
const py = `
import openpyxl,json,sys,glob,os
out={}
for f in sorted(glob.glob(sys.argv[1]+'/Plantilla_*.xlsx')):
    wb=openpyxl.load_workbook(f); ws=wb['Registro']
    hdr=[c.value for c in ws[1]]
    dv=[(str(d.sqref),d.formula1,d.type) for d in ws.data_validations.dataValidation]
    fechas=[ws.cell(row=2,column=j+1).number_format for j,h in enumerate(hdr) if h and 'Fecha' in h]
    grises=sum(1 for r in range(2,5) if ws.cell(row=r,column=1).fill.fgColor.rgb=='FFE5E7EB')
    out[os.path.basename(f)]={'hojas':wb.sheetnames,'enc':hdr,'dv':dv,'fechas':fechas,'grises':grises}
print(json.dumps(out))`;
let pyres = null;
try { pyres = JSON.parse(execFileSync('python3', ['-c', py, TMP]).toString()); } catch (e) { check(6, 'Lectura de plantillas con openpyxl (Excel independiente de SheetJS)', false, e.message.slice(0, 200)); }
if (pyres) ORDEN_REGISTROS.forEach(k => {
  const x = pyres['Plantilla_' + k + '.xlsx'], d = REGISTROS[k];
  check(6, d.nombre + ' · hojas Registro, Listas e Instrucciones', JSON.stringify(x.hojas) === '["Registro","Listas","Instrucciones"]', x.hojas.join(', '));
  check(6, d.nombre + ' · encabezados de la fila 1 = definición', JSON.stringify(x.enc) === JSON.stringify(d.columnas.map(c => c.h)), x.enc.length + ' columnas');
  if (ARCHIVOS[k]) { const m = XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(DIR_REF + '/' + ARCHIVOS[k] + '.xlsx')).Sheets.Registro, { header: 1 }); check(6, d.nombre + ' · encabezados idénticos al archivo adjunto (fila 4)', JSON.stringify(m[3]) === JSON.stringify(x.enc), ''); }
  const cats = d.columnas.filter(c => c.lista || c.tipo === 'codigo').length;
  check(6, d.nombre + ' · validación desplegable en ' + cats + ' columnas categóricas', x.dv.length === cats && x.dv.every(v => v[2] === 'list' && /^Listas!\$/.test(v[1])), x.dv.map(v => v[0] + '→' + v[1]).join(' ; '));
  check(6, d.nombre + ' · formato dd/mm/aaaa hh:mm en columnas de fecha', x.fechas.every(f => /dd\/mm\/yyyy\\? hh:mm/.test(f)), x.fechas.join(', ') || 'sin fechas');
  check(6, d.nombre + ' · tres filas de ejemplo en gris marcadas «EJEMPLO»', x.grises === 3 || (d.sinFecha || k === 'reuniones_emergencia'), x.grises + ' filas grises en la columna A');
});
ORDEN_REGISTROS.forEach(k => { const buf = generarPlantilla(k, ctx); const inf = subir(k, buf, ctx); check(6, REGISTROS[k].nombre + ' · plantilla sin llenar: ejemplos omitidos, 0 errores', inf.ejemplos === 3 && !inf.errores.length && !inf.validos.length, inf.ejemplos + ' ejemplos omitidos'); });

/* ===== Auditoría 7 · Validaciones de carga con errores deliberados ===== */
console.log('\nAuditoría 7 · Validación con errores deliberados');
const ctxInact = copia(ctx); ctxInact.equipos.find(e => e.id === 'CAL2').activo = false;
const base = (fecha, fin, dur, eq, extra) => [null, fecha, fin, dur, '1', eq, 'Mecánico', 'X', 'Desgaste', 'Fatiga de material', 'X', 'X'].map((v, i) => extra && extra[i] !== undefined ? extra[i] : v);
const errores = [
  ['fuera del periodo', base('10/06/2024 10:00', '10/06/2024 11:00', 1, 'Molino'), 'Fuera del periodo'],
  ['reinicio anterior a la falla', base('10/06/2025 10:00', '10/06/2025 09:00', 1, 'Molino'), 'posterior'],
  ['valor fuera de lista', base('11/06/2025 10:00', '11/06/2025 11:00', 1, 'Molino', { 8: 'Explosión' }), 'fuera de la lista'],
  ['duración cero', base('12/06/2025 10:00', '12/06/2025 10:00', 0, 'Molino'), 'posterior'],
  ['equipo inactivo', base('13/06/2025 10:00', '13/06/2025 11:00', 1, 'Caldero 2'), 'inactivo'],
  ['equipo inexistente', base('14/06/2025 10:00', '14/06/2025 11:00', 1, 'Prensa 9'), 'fuera de la lista'],
  ['fecha ilegible', base('31/02/2025 10:00', '01/03/2025 11:00', 1, 'Molino'), 'no válida'],
  ['campo obligatorio vacío', base('16/06/2025 10:00', '16/06/2025 11:00', 1, 'Molino', { 4: '' }), 'obligatorio']
];
const advert = [
  ['domingo', base('15/06/2025 10:00', '15/06/2025 11:00', 1, 'Molino'), 'domingo'],
  ['feriado', base('29/06/2025 10:00', '29/06/2025 11:00', 1, 'Molino'), 'domingo o feriado'],
  ['hora fuera de ventana', base('17/06/2025 05:00', '17/06/2025 06:00', 1, 'Molino'), 'fuera de la ventana']
];
const recal = [['duración distinta de reinicio − falla (se recalcula)', base('18/06/2025 10:00', '18/06/2025 12:00', 1.5, 'Molino'), 'se recalculó']];
const buenas = [base('19/06/2025 10:00', '19/06/2025 11:30', 1.5, 'Extruder'), base('20/06/2025 00:30', '20/06/2025 01:30', 1, 'Extruder')];
const todas = errores.map(e => e[1]).concat(advert.map(e => e[1]), recal.map(e => e[1]), buenas);
const bufErr = plantillaLlena('correctivo', todas, ctxInact); fs.writeFileSync(path.join(TMP, 'A7_correctivo_con_errores.xlsx'), bufErr);
const I = subir('correctivo', bufErr, ctxInact);
errores.forEach(([n, , pat], i) => check(7, 'Detecta: ' + n + ' → fila rechazada', I.errores.some(e => e.fila === i + 2 && e.motivo.toLowerCase().indexOf(pat.toLowerCase()) >= 0), (I.errores.find(e => e.fila === i + 2) || {}).motivo));
advert.forEach(([n, , pat], i) => check(7, 'Advierte: ' + n + ' → no se inserta sin forzar', I.conAdvertencia.some(x => x.fila === errores.length + i + 2 && x.motivos.join(' ').indexOf(pat) >= 0), (I.conAdvertencia.find(x => x.fila === errores.length + i + 2) || { motivos: ['—'] }).motivos.join('; ')));
check(7, 'Recalcula la duración (tolerancia 0.05 h) y conserva la fila', I.validos.some(r => r.fila_origen === errores.length + advert.length + 2 && cerca(r.horas, 2, 1e-9)), 'declarada 1.5 h → 2.0 h');
check(7, 'Filas correctas aceptadas (incluye 00:30 del turno 2 → día anterior)', I.validos.filter(r => r.equipo_id === 'EXT').length === 2 && I.validos.some(r => r.dia_prod === '2025-06-19' && r.inicio.startsWith('2025-06-20')), I.validos.length + ' válidas');
const IF = subir('correctivo', bufErr, ctxInact, { forzar: true });
check(7, 'Con «forzar», las advertencias se insertan marcadas', IF.validos.filter(r => r.forzado).length === advert.length, IF.validos.filter(r => r.forzado).length + ' forzadas');
const malEnc = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(malEnc, XLSX.utils.aoa_to_sheet([['Fecha', 'Maquina', 'Horas'], ['01/06/2025 10:00', 'Molino', 1]]), 'Registro');
const IE = subir('correctivo', XLSX.write(malEnc, { type: 'buffer', bookType: 'xlsx' }), ctx);
check(7, 'Encabezados distintos → archivo completo rechazado', !!IE.rechazoArchivo && !IE.validos.length, IE.rechazoArchivo);
const IE2 = subir('correctivo', Buffer.from('esto no es un excel'), ctx);
check(7, 'Archivo ilegible → rechazo con mensaje explícito', !!IE2.rechazoArchivo, IE2.rechazoArchivo);

/* ===== Auditoría 10 · Integridad (núcleo) ===== */
console.log('\nAuditoría 10 · Integridad global');
const sumReg = { correctivo: regRef.correctivo.reduce((a, r) => a + r.horas, 0), microparadas: regRef.paradas_cortas.reduce((a, r) => a + r.horas, 0),
  setup: regRef.cambio_formato.filter(r => r.clasificacion_actual === 'Interna').reduce((a, r) => a + r.duracion_actividad_h, 0), auxiliares: regRef.equipos_auxiliares.reduce((a, r) => a + r.horas, 0),
  reuniones: regRef.reuniones_emergencia.reduce((a, r) => a + r.horas, 0), calidad: regRef.no_conformidades.reduce((a, r) => a + r.horas, 0) };
const HM = RL.lineaHM.total;
const tab = { correctivo: HM.correctivo, microparadas: HM.microparadas, setup: HM.setup, auxiliares: RL.linea.total.perdidas.auxiliares, reuniones: RL.linea.total.perdidas.reuniones, calidad: HM.defectos + HM.reprocesos };
Object.keys(sumReg).forEach(k => check(10, 'Suma de ' + k + ': registros = tablero (≤ 0.1 h)', Math.abs(sumReg[k] - tab[k]) <= 0.1, sumReg[k].toFixed(3) + ' vs ' + tab[k].toFixed(3)));
const sumMeses = RL.meses.reduce((a, m) => a + RL.linea[m].va, 0);
check(10, 'Suma mensual del valor añadido = total del periodo', cerca(sumMeses, L.va, 1e-6), sumMeses.toFixed(3) + ' h');
const aux = ['MOL', 'EXT', 'PR1', 'PR2', 'PR3', 'PR4', 'PR5', 'AUT', 'CAL1', 'CAL2'].reduce((a, id) => a + RL.maquina[id].total.perdidas.auxiliares, 0);
check(10, 'Reparto de auxiliares entre máquinas conserva el total (91.5 h)', cerca(aux, 91.5, 1e-6), aux.toFixed(3) + ' h');

/* ===== Auditorías 11 a 14 · Simulación ===== */
console.log('\nAuditoría 11 · Ajuste de distribuciones');
const M = construirModelo(Object.assign({}, ctx, { registros: regRef }), SIM_SEMILLA);
const aj = (eq, v) => M.ajustes.find(a => a.equipo === eq && a.variable.indexOf(v) === 0);
[['Autoclave', 'Suficiente', 167], ['Extruder', 'Suficiente', 126], ['Molino', 'Limitada', 5]].forEach(([e, v, n]) => { const a = aj(e, 'Tiempo entre fallas'); check(11, e + ': ' + n + ' eventos, validez ' + v.toLowerCase(), a && a.n === n && a.validez === v, a ? a.n + ' · ' + a.validez + ' · ' + a.tratamiento + (a.ks != null ? ' · ' + a.distribucion + ' D=' + a.ks.toFixed(3) + ' p=' + a.p.toFixed(3) : '') : '—'); });
['Autoclave', 'Extruder'].forEach(e => ['Tiempo entre fallas', 'Tiempo de reparación'].forEach(v => { const a = aj(e, v); check(11, e + ' · ' + v + ': prueba K-S reportada entre 5 candidatos', a && a.ks != null && a.candidatos.length >= 4, a ? a.candidatos.map(c => c.tipo + ' ' + c.ks.toFixed(3)).join(' · ') : ''); }));
const cal = RL.confiabilidad.filter(c => /^(PR|CAL)/.test(c.id));
check(11, 'Prensas y calderos individuales: validez insuficiente', cal.every(c => c.validez === 'Insuficiente'), cal.map(c => c.id + ' ' + c.n).join(', '));
const gp = M.grupos.find(g => g.id === 'G-Prensado'), gc = M.grupos.find(g => g.id === 'G-SOPORTE');
check(11, 'Prensas agregadas como estación única (7 eventos, 9.3 h)', gp && gp.n === 7 && cerca(gp.ttrMedia * gp.n, 9.3, 0.05), gp ? gp.n + ' eventos · ' + (gp.ttrMedia * gp.n).toFixed(2) + ' h · reparto aleatorio entre ' + gp.equipos.length : '');
check(11, 'Calderos agregados como grupo (4 eventos, 4.7 h)', gc && gc.n === 4 && cerca(gc.ttrMedia * gc.n, 4.7, 0.05), gc ? gc.n + ' eventos · ' + (gc.ttrMedia * gc.n).toFixed(2) + ' h' : '');
check(11, 'MTBF autoclave 24.1 h y extrusora 31.1 h (tiempo bruto ÷ fallas)', cerca(RL.confiabilidad.find(c => c.id === 'AUT').mtbf, 24.1, 0.05) && cerca(RL.confiabilidad.find(c => c.id === 'EXT').mtbf, 31.1, 0.05), RL.confiabilidad.filter(c => /AUT|EXT/.test(c.id)).map(c => c.id + ' ' + c.mtbf.toFixed(2) + ' h, MTTR ' + c.mttr.toFixed(2)).join(' · '));

console.log('\nAuditorías 12 y 13 · Verificación y validación (30 réplicas)');
const t0 = Date.now();
const E0 = correrEscenario(M, ESCENARIOS_SEMILLA[0], ESCENARIOS_SEMILLA);
const V = validarBase(E0, M);
V.verificaciones.forEach(v => check(12, v.verificacion, v.ok, v.detalle));
check(12, 'Simulación ejecutada sin excepción', true, E0.replicas + ' réplicas en ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
V.filas.forEach(f => check(13, f.indicador + ' dentro de tolerancia (± ' + f.tolerancia + ' ' + f.unidad + ')', f.ok, 'real ' + (f.unidad === 'pp' ? p2(f.real) + ' %' : f.real.toFixed(1)) + ' · simulado ' + (f.unidad === 'pp' ? p2(f.simulado) + ' % [' + p2(f.li) + ' – ' + p2(f.ls) + ']' : f.simulado.toFixed(1) + ' [' + f.li.toFixed(1) + ' – ' + f.ls.toFixed(1) + ']') + ' · desvío ' + f.desvio.toFixed(2) + ' ' + f.unidad));
V.filas.filter(f => f.unidad === 'pp' || /Producción/.test(f.indicador)).forEach(f => informe.push({ auditoria: 13, verificacion: 'IC 95 % de ' + f.indicador + ' contiene el valor real', ok: f.icContiene, detalle: f.icContiene ? 'contiene' : 'no contiene (desvío ' + f.desvio.toFixed(2) + ' ' + f.unidad + ', dentro de tolerancia)', informativo: true }));
V.filas.filter(f => f.unidad === 'pp' || /Producción/.test(f.indicador)).forEach(f => console.log('  ' + (f.icContiene ? 'ℹ ' : '⚠ ') + 'IC 95 % de ' + f.indicador + (f.icContiene ? ' contiene' : ' NO contiene') + ' el valor real'));
check(13, 'Validación global: escenarios de mejora habilitados', V.ok, V.ok ? 'aprobada' : 'bloqueada');

console.log('\nAuditoría 14 · Escenarios');
const res = { E0 };
for (const e of ESCENARIOS_SEMILLA.slice(1)) res[e.id] = correrEscenario(M, e, ESCENARIOS_SEMILLA);
const comp = {}; ESCENARIOS_SEMILLA.slice(1).forEach(e => comp[e.id] = comparar(E0, res[e.id], M));
const d = (id, k) => comp[id].filas.find(f => f.indicador === k);
check(14, 'E1 mejora la disponibilidad (MTBF de extrusora y autoclave)', d('E1', 'Disponibilidad').delta > 0 && d('E1', 'Disponibilidad').significativa, 'Δ ' + p2(d('E1', 'Disponibilidad').delta) + ' pp, p = ' + d('E1', 'Disponibilidad').p.toExponential(2));
check(14, 'E2 (SMED) mejora la disponibilidad', d('E2', 'Disponibilidad').delta > 0 && d('E2', 'Disponibilidad').significativa, 'Δ ' + p2(d('E2', 'Disponibilidad').delta) + ' pp · reducción aplicada ' + p2(M.smed.reduccion) + ' % (292.5 → 86.6 h)');
check(14, 'E3 (calidad) mejora la calidad', d('E3', 'Calidad').delta > 0 && d('E3', 'Calidad').significativa, 'Δ ' + p2(d('E3', 'Calidad').delta) + ' pp · origen térmico ' + p2(M.calidadTermica.proporcion) + ' % de las horas');
check(14, 'E4 (autónomo en el molino) mejora el rendimiento', d('E4', 'Rendimiento').delta > 0 && d('E4', 'Rendimiento').significativa, 'Δ ' + p2(d('E4', 'Rendimiento').delta) + ' pp');
const vac5 = res.E5.resumen.horasLinea.vacio.media;
check(14, 'E5 (encendido anticipado) reduce el vacío de 454.2 a 181.9 h y mejora el rendimiento', cerca(vac5, 181.9, 0.5) && d('E5', 'Rendimiento').delta > 0, 'vacío ' + vac5.toFixed(1) + ' h · Δ rendimiento ' + p2(d('E5', 'Rendimiento').delta) + ' pp');
const suma5 = ['E1', 'E2', 'E3', 'E4', 'E5'].reduce((a, id) => a + d(id, 'OEE').delta, 0);
check(14, 'E6 se simula en conjunto: no es la suma de los individuales', Math.abs(d('E6', 'OEE').delta - suma5) > 0.001 && d('E6', 'OEE').significativa, 'Δ E6 ' + p2(d('E6', 'OEE').delta) + ' pp vs suma ' + p2(suma5) + ' pp');
check(14, 'Traducción económica con margen S/ 180 por lámina', ESCENARIOS_SEMILLA.slice(1).every(e => cerca(comp[e.id].economico.delta, comp[e.id].economico.laminas * 180, 1e-6)), ESCENARIOS_SEMILLA.slice(1).map(e => e.id + ' S/ ' + Math.round(comp[e.id].economico.delta).toLocaleString('es-PE')).join(' · '));
ESCENARIOS_SEMILLA.slice(1).forEach(e => informe.push({ auditoria: 14, verificacion: 'Resultado ' + e.nombre, ok: true, informativo: true, detalle: comp[e.id].filas.map(f => f.indicador + ' ' + (/Producción/.test(f.indicador) ? Math.round(f.delta) : p2(f.delta) + ' pp') + (f.significativa ? '*' : '')).join(' · ') + ' · S/ ' + Math.round(comp[e.id].economico.delta).toLocaleString('es-PE') }));

fs.writeFileSync(path.join(OUT, 'auditoria_nucleo.json'), JSON.stringify({ fecha: new Date().toISOString(), fallas, informe, validacion: V, escenarios: Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.resumen])), comparaciones: comp, ajustes: M.ajustes.map(a => Object.assign({}, a, { muestra: undefined })) }, null, 1));
console.log('\n' + (fallas ? '✘ ' + fallas + ' verificaciones fallidas' : '✔ Todas las verificaciones del núcleo aprobadas') + ' · ' + informe.filter(x => !x.informativo).length + ' verificaciones');
process.exit(fallas ? 1 : 0);
