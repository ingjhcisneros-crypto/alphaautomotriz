/* Auditorías de extremo a extremo en Chromium sobre el HTML empaquetado (dist/). Requiere haber corrido
   antes «npm test» (genera los archivos de prueba en tests/informe/archivos). Ejecutar: node tests/e2e.mjs */
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { abrir, entrar, ir } from './navegador.mjs';
import { REGISTROS, ORDEN_REGISTROS } from '../src/core/registros.js';
import { LISTAS_SEMILLA } from '../src/core/catalogos.js';

const OUT = path.resolve(import.meta.dirname, 'informe'), ARCH = path.join(OUT, 'archivos'), SHOTS = path.join(OUT, 'capturas');
fs.mkdirSync(SHOTS, { recursive: true });
const informe = []; let fallas = 0;
const check = (aud, n, ok, det) => { informe.push({ auditoria: aud, verificacion: n, ok: !!ok, detalle: det }); if (!ok) fallas++; console.log((ok ? '  ✔ ' : '  ✘ ') + n + (det != null ? ' — ' + det : '')); };
const perfil = fs.mkdtempSync('/tmp/cmms-e2e-');
const { navegador, contexto, pagina: P, errores } = await abrir();
const E = (expr, arg) => P.evaluate(expr, arg);
const oee = () => E(() => { const L = CMMS.servicio.E.total.linea.total; return { OEE: L.OEE, D: L.D, R: L.R, Q: L.Q, prod: L.produccion }; });

async function tab(defId) { await ir(P, 'registros'); await P.click('#regTabs .pest[data-r="' + defId + '"]'); }
async function subir(defId, archivo, modo, forzar) {
  await tab(defId);
  await P.check('input[name="regModo"][value="' + modo + '"]');
  if (forzar) await P.check('#regForzar'); else await P.uncheck('#regForzar');
  await P.setInputFiles('#regArchivo', archivo);
  await P.waitForFunction(() => !document.getElementById('regValidar').disabled);
  await P.click('#regValidar');
  await P.waitForSelector('#regResultado .banda');
}
async function insertarYLeer(confirmarReemplazo) {
  const espera = confirmarReemplazo ? P.waitForEvent('download') : null;
  await P.click('#regInsertar');
  if (confirmarReemplazo) { await P.waitForSelector('.capa.abierta .btn-danger'); await P.click('.capa.abierta .btn-danger'); }
  await P.waitForSelector('.capa.abierta h2:text-matches("terminada")', { timeout: 60000 });
  const txt = await P.textContent('.capa.abierta .dlg-cuerpo');
  const dl = espera ? await espera : null;
  await P.click('.capa.abierta [data-x]');
  return { txt: txt.replace(/\s+/g, ' '), dl };
}

console.log('\nAuditoría 5 · Sistema vacío y catálogos sembrados (instalación nueva)');
await entrar(P);
const conteos = await E(async () => { const o = {}; for (const t of ['mantenimiento_correctivo', 'paradas_cortas', 'cambio_formato', 'no_conformidades', 'equipos_auxiliares', 'operacion_en_vacio', 'reuniones_emergencia']) o[t] = await CMMS.servicio.BDexp.contar(t); return o; });
check(5, 'Base sin registros operativos al instalar', Object.values(conteos).every(v => v === 0), JSON.stringify(conteos));
const listas = await E(() => CMMS.servicio.E.listas);
check(5, 'Catálogos sembrados = hojas «Listas» de los adjuntos', Object.keys(LISTAS_SEMILLA).every(k => JSON.stringify(listas[k]) === JSON.stringify(LISTAS_SEMILLA[k])), Object.keys(listas).length + ' listas');
check(5, 'Catálogo de equipos y parámetros del periodo sembrados', await E(() => CMMS.servicio.E.equipos.length === 10 && CMMS.servicio.E.periodo.feriados.length === 16), '10 equipos · 16 feriados');
check(5, 'El portal no muestra credenciales', !/grupo29|ing29|tec29|ope29/.test(await P.content()), '');
check(5, 'OEE de línea indica «Sin registros operativos»', await P.isVisible('#v-linea .vacio-oee'), '');
await P.screenshot({ path: path.join(SHOTS, '01_instalacion_vacia.png') });
await ir(P, 'param');
const c0 = await E(() => CMMS.servicio.E.total.linea.total.carga);
await P.fill('#parPeriodo [data-k="horas_mtto_planificado"]', '10'); await P.click('#parGuardar'); await P.waitForTimeout(300);
const c1 = await E(() => CMMS.servicio.E.total.linea.total.carga);
check(5, 'Parámetros del periodo editables desde la interfaz (mtto. planificado 10 h → carga −10 h)', Math.abs(c0 - c1 - 10) < 1e-6, c0.toFixed(2) + ' → ' + c1.toFixed(2) + ' h');
await P.fill('#parPeriodo [data-k="horas_mtto_planificado"]', '0'); await P.click('#parGuardar'); await P.waitForTimeout(300);

console.log('\nAuditoría 6 · Plantillas descargadas desde la interfaz');
for (const k of ORDEN_REGISTROS) {
  await tab(k);
  const [dl] = await Promise.all([P.waitForEvent('download'), P.click('#regPlantilla')]);
  const f = path.join(OUT, 'archivos', 'UI_' + dl.suggestedFilename()); await dl.saveAs(f);
  const wb = XLSX.read(fs.readFileSync(f));
  const enc = XLSX.utils.sheet_to_json(wb.Sheets.Registro, { header: 1 })[0];
  const xml = fs.readFileSync(f).toString('latin1');
  check(6, REGISTROS[k].nombre + ': plantilla descargada con encabezados exactos y dataValidation', JSON.stringify(enc) === JSON.stringify(REGISTROS[k].columnas.map(c => c.h)) && xml.indexOf('<dataValidation type="list"') > 0, dl.suggestedFilename());
}

console.log('\nAuditoría 7 · Carga de datos por la interfaz');
await subir('correctivo', path.join(ARCH, 'A4_correctivo.xlsx'), 'incremental');
let r = await insertarYLeer(false);
check(7, 'Incremental, primera carga: 309 insertados', /309\s*Insertados/.test(r.txt), r.txt.slice(0, 120));
await subir('correctivo', path.join(ARCH, 'A4_correctivo.xlsx'), 'incremental');
const dupTxt = (await P.textContent('#regResultado .banda')).replace(/\s+/g, ' ');
r = await insertarYLeer(false);
check(7, 'Incremental, mismo archivo por segunda vez: 0 insertados, 309 duplicados', /^\s*0\s*Insertados\s*309\s*Omitidos por duplicado/.test(r.txt), r.txt.slice(0, 120));
check(7, 'La validación anticipa los duplicados antes de insertar', /309\s*Duplicados que se omitirán/.test(dupTxt), '');
check(7, 'La base conserva exactamente 309 registros', await E(() => CMMS.servicio.BDexp.contar('mantenimiento_correctivo')) === 309, '');
await E(async () => { const S = CMMS.servicio, l = S.E.equipos.map(e => Object.assign({}, e, e.id === 'CAL2' ? { activo: false } : {})); await S.guardarEquipos(l); });
await subir('correctivo', path.join(ARCH, 'A7_correctivo_con_errores.xlsx'), 'incremental');
const tabla = await P.$$eval('#regResultado table tbody tr', trs => trs.map(t => Array.from(t.cells).map(c => c.textContent.trim())));
const rech = new Set(tabla.filter(f => /rechazada/i.test(f[3])).map(f => f[0])), adv = new Set(tabla.filter(f => /Advertencia/.test(f[3]) && !/recalcul/.test(f[2])).map(f => f[0]));
check(7, 'Archivo con errores deliberados: 8 filas rechazadas detectadas con fila, columna y motivo', rech.size === 8, 'filas ' + Array.from(rech).join(', '));
check(7, 'Advertencias (domingo, feriado, hora) detectadas', adv.size === 3, 'filas ' + Array.from(adv).join(', '));
const [inf] = await Promise.all([P.waitForEvent('download'), P.click('#regInforme')]);
const infF = path.join(OUT, 'archivos', 'UI_' + inf.suggestedFilename()); await inf.saveAs(infF);
const infFilas = XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(infF)).Sheets['Validación'], { header: 1 }).slice(3);
check(7, 'Informe de validación descargable en Excel', infFilas.length === tabla.length, infFilas.length + ' filas en ' + inf.suggestedFilename());
await E(async () => { const S = CMMS.servicio, l = S.E.equipos.map(e => Object.assign({}, e, { activo: true })); await S.guardarEquipos(l); });
await subir('correctivo', path.join(ARCH, 'A3_correctivo.xlsx'), 'completa');
r = await insertarYLeer(true);
const resp = XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(await r.dl.path())).Sheets.Registro, { header: 1 });
check(7, 'Carga completa: advierte, pide confirmación, respalda 309 y reemplaza por 10', /309 registros eliminados/.test(r.txt) && /10 insertados/.test(r.txt) && await E(() => CMMS.servicio.BDexp.contar('mantenimiento_correctivo')) === 10, r.txt.slice(0, 110));
check(7, 'El respaldo descargado contiene el estado anterior (309 registros)', resp.length - 3 === 309, (resp.length - 3) + ' filas');
await subir('correctivo', path.join(ARCH, 'A4_correctivo.xlsx'), 'completa'); await insertarYLeer(true);
for (const k of ['cambio_formato', 'reuniones_emergencia', 'equipos_auxiliares', 'paradas_cortas', 'operacion_en_vacio', 'no_conformidades']) {
  await subir(k, path.join(ARCH, 'A4_' + k + '.xlsx'), 'incremental'); const x = await insertarYLeer(false);
  check(7, REGISTROS[k].nombre + ' cargado por la interfaz', /Insertados/.test(x.txt), x.txt.slice(0, 60));
}

console.log('\nAuditoría 8 · Recálculo automático');
const o0 = await oee();
check(8, 'OEE de línea con los datos cargados por la interfaz = 55.68 %', Math.abs(o0.OEE * 100 - 55.68) <= 0.01, (o0.OEE * 100).toFixed(4) + ' % · ' + Math.round(o0.prod) + ' láminas');
await tab('correctivo'); await P.click('#regNuevo');
const v = { fecha_hora_falla: '2025-07-15T10:00', fecha_hora_reinicio: '2025-07-15T15:00' };
for (const [k, val] of Object.entries(v)) await P.fill('.capa.abierta [data-k="' + k + '"]', val);
for (const [k, val] of Object.entries({ turno: '1', equipo_id: 'Autoclave', sistema_afectado: 'Mecánico', modo_falla: 'Rotura', causa_raiz: 'Fatiga de material' })) await P.selectOption('.capa.abierta [data-k="' + k + '"]', val);
await P.click('.capa.abierta .btn-primary'); await P.waitForTimeout(400);
const o1 = await oee();
check(8, 'Insertar un registro manual cambia el OEE sin intervención', o1.OEE < o0.OEE, (o0.OEE * 100).toFixed(4) + ' → ' + (o1.OEE * 100).toFixed(4) + ' %');
const idNuevo = await E(() => CMMS.servicio.E.registros.correctivo.find(r => r.manual).id);
await E(id => CMMS.servicio.borrarRegistros('correctivo', [id]), idNuevo); await P.waitForTimeout(300);
const o2 = await oee();
check(8, 'Borrarlo devuelve exactamente el valor anterior', o2.OEE === o0.OEE && o2.prod === o0.prod, (o2.OEE * 100).toFixed(6) + ' %');
check(8, 'Recalcular dos veces produce el mismo resultado (idempotente)', await E(() => JSON.stringify(CMMS.servicio.recalcular('prueba')) === JSON.stringify(CMMS.servicio.recalcular('prueba'))), '');
check(8, 'Fecha del último recálculo visible en la cabecera', /Recalculado \d/.test(await P.textContent('#chipRecalculo')), await P.textContent('#chipRecalculo'));

console.log('\nAuditoría 9 · OEE de línea, OEE por máquina y análisis de paradas (resumen primero, detalle a pedido)');
await ir(P, 'linea'); await P.waitForTimeout(300);
const kL = (await P.textContent('#lKpis')).replace(/\s+/g, ' ');
check(9, 'OEE de línea: KPIs del periodo (55.68 %) con horas de línea', /55[.,]68 %/.test(kL), kL.slice(0, 120));
check(9, 'Cascada de 6 etapas en resumen (sin tabla mensual a la vista)', await P.$$eval('#lCascada .etapa-b', x => x.length) === 6 && !(await P.isVisible('#v-linea table.mensual')), '');
await P.click('#lCascada .etapa-b[data-etapa="C"]');
let det = (await P.textContent('.capa.abierta')).replace(/\s+/g, ' ');
check(9, 'Clic en una etapa abre la cadena completa y la evolución mensual plegada', /Tiempo de carga/.test(det) && /Ver evolución mensual/.test(det) && !(await P.isVisible('.capa.abierta details .cuerpo table')), det.slice(0, 120));
await P.screenshot({ path: path.join(SHOTS, '02_cascada_linea.png') }); await P.click('.capa.abierta [data-x]');
await P.screenshot({ path: path.join(SHOTS, '03_oee_linea.png'), fullPage: true });
const eL = () => E(() => ({ kpi: document.getElementById('lKpis').textContent, cas: document.getElementById('lCascada').textContent, ev: JSON.stringify(Chart.getChart('gLEvol').data.datasets[0].data), per: document.getElementById('lPerdidas').textContent }));
const sL = await eL(); await P.selectOption('#lTurno', '2'); await P.waitForTimeout(250); const tL = await eL();
check(9, 'Filtro de turno afecta a los cuatro bloques de la vista de línea', Object.keys(sL).every(k => sL[k] !== tL[k]), '');
await P.click('#lLimpiar'); await P.waitForTimeout(200);
check(9, '«Todo el periodo» restaura los valores', JSON.stringify(await eL()) === JSON.stringify(sL), '');
await ir(P, 'maquina'); await P.waitForTimeout(300);
const filasM = await P.$$eval('#mResumen tbody tr', t => t.length);
check(9, 'OEE por máquina: resumen de 10 equipos con OEE y confiabilidad en una sola tabla', filasM === 10, filasM + ' filas');
check(9, 'Detalle mensual por máquina plegado (solo a pedido)', !(await P.isVisible('#mCruzada')), '');
await P.click('#mResumen tr[data-eq="AUT"]');
det = (await P.textContent('.capa.abierta')).replace(/\s+/g, ' ');
check(9, 'Clic en el autoclave abre su cascada (79.17 %, horas-máquina)', /Autoclave · periodo/.test(det) && /79[.,]17 %/.test(det) && /Tiempo bruto/.test(det), det.slice(0, 120));
await P.click('.capa.abierta [data-x]');
check(9, 'OEE de máquina ≠ OEE de línea (horas-máquina vs horas de línea)', await E(() => { const r = CMMS.servicio.E.total; return Math.abs(r.maquina.AUT.total.OEE - r.linea.total.OEE) > 0.1; }), '');
await P.click('#v-maquina details.fold summary'); await P.waitForTimeout(150);
const colsM = await P.$$eval('#mCruzada thead th', t => t.length);
check(9, 'Al desplegar: matriz máquina × 12 meses + periodo', colsM === 14, (colsM - 1) + ' columnas');
await P.screenshot({ path: path.join(SHOTS, '04_oee_maquina.png'), fullPage: true });
await ir(P, 'paradas'); await P.waitForTimeout(300);
const tipos = await P.$$eval('#pMatriz thead th', t => t.map(x => x.textContent.trim()));
check(9, 'Análisis de paradas: los 6 tipos por máquina', ['Correctivo', 'Cambio de formato', 'Equipos auxiliares', 'Paradas cortas', 'Operación en vacío', 'Paradas de emergencia'].every(x => tipos.some(t => t.indexOf(x) >= 0)), tipos.join(' | '));
const hMat = await E(() => { const t = document.querySelector('#pMatriz td.celda-par[data-maq="AUT"][data-t="correctivo"]'); return parseFloat(t.textContent.replace(',', '')); });
check(9, 'Matriz = motor de cálculo (correctivo del autoclave, una sola fuente)', Math.abs(hMat - await E(() => CMMS.servicio.E.total.maquina.AUT.total.perdidas.correctivo)) < 0.06, hMat + ' h');
await P.click('#pMatriz td.celda-par[data-maq="AUT"][data-t="correctivo"]');
det = (await P.textContent('.capa.abierta')).replace(/\s+/g, ' ');
check(9, 'Clic en una celda: eventos, causas principales y evolución mensual', /Causas principales/.test(det) && /Por mes/.test(det), det.slice(0, 100));
await P.screenshot({ path: path.join(SHOTS, '05_detalle_parada.png') }); await P.click('.capa.abierta [data-x]');
await P.screenshot({ path: path.join(SHOTS, '06_paradas.png'), fullPage: true });
for (const [vista, bloques] of [['linea', ['lb1', 'lb3', 'lb4']], ['maquina', ['mb1', 'mb2', 'mb3']], ['paradas', ['pb1', 'pb2']]]) {
  await ir(P, vista); await P.waitForTimeout(200);
  for (const b of bloques) for (const f of ['xlsx', 'png']) {
    await P.waitForTimeout(600);
    try {
      const [dl] = await Promise.all([P.waitForEvent('download', { timeout: 10000 }), P.click('.export[data-bloque="' + b + '"] [data-f="' + f + '"]')]);
      const tam = fs.statSync(await dl.path()).size;
      check(9, 'Exportación ' + b + ' a ' + f.toUpperCase(), tam > 500, dl.suggestedFilename() + ' · ' + tam + ' bytes');
    } catch (e) { check(9, 'Exportación ' + b + ' a ' + f.toUpperCase(), false, e.message.slice(0, 80)); }
  }
}
const ultimoPdf = () => E(() => { const f = Array.from(document.querySelectorAll('iframe')).pop(); return f ? f.contentWindow.document.body.textContent.replace(/\s+/g, ' ') : ''; });
for (const [vista, btn, re] of [['linea', '#lPdf', /OEE de línea/], ['maquina', '#mPdf', /Resumen por máquina/], ['paradas', '#pPdf', /Paradas de emergencia/]]) {
  await ir(P, vista); await P.click(btn); await P.waitForTimeout(500);
  check(9, 'Informe PDF de la vista ' + vista + ' con el estilo del sistema', re.test(await ultimoPdf()), '');
}

console.log('\nAuditoría 9b · Programa de mantenimiento: PDF por filtro y cumplimiento → tiempo de carga');
await ir(P, 'plan'); await P.click('#planTipo .pest[data-t="Planificado"]'); await P.selectOption('#planEqF', 'caldero'); await P.click('#planPdf'); await P.waitForTimeout(600);
const tPlan = await ultimoPdf();
check('9b', 'PDF del filtro «Planificado · Caldero»: solo ese pilar y ese equipo, agrupado y con firmas', /Plan maestro planificado/.test(tPlan) && /Caldero \(2 unidades\)/.test(tPlan) && !/Molino|Autoclave/.test(tPlan) && /Aprobado por/.test(tPlan), tPlan.slice(0, 140));
const pagPlan = await navegador.newPage(); await pagPlan.setContent(await E(() => Array.from(document.querySelectorAll('iframe')).pop().contentWindow.document.documentElement.outerHTML));
await pagPlan.pdf({ path: path.join(OUT, 'Plan_Planificado_Caldero.pdf'), format: 'A4' }); await pagPlan.close();
await P.click('#planTipo .pest[data-t="todos"]'); await P.selectOption('#planEqF', 'todos');
await ir(P, 'agenda'); await P.click('#hPdf'); await P.waitForTimeout(400);
check('9b', 'PDF del historial de cumplimiento según su filtro', /Historial de cumplimiento/.test(await ultimoPdf()), '');
await ir(P, 'anom'); await P.click('#anPdf').catch(() => {});

console.log('\nAuditoría 9c · Calendario de operación: periodos omitidos y arranque del programa');
await ir(P, 'param'); await P.waitForTimeout(300);
const segs = await P.$$eval('#parLineaTiempo .seg', x => x.map(e => e.className.replace('seg ', '') + ':' + e.title));
check('9c', 'Línea de tiempo: datos jun-25–may-26, planeación omitida jun–set 2026, programa desde 01-10-2026', segs.some(x => /^datos:.*2025-06-01 a 2026-05-31/.test(x)) && segs.some(x => /^omit:.*2026-06-01 a 2026-09-30/.test(x)) && segs.some(x => /^prog:.*2026-10-01/.test(x)), segs.join(' | '));
const ots = await E(() => { const o = LEGADO.instantanea().OTS; return { n: o.length, min: o.reduce((a, x) => x.fecha < a ? x.fecha : a, '9999'), enPlan: o.filter(x => x.fecha < '2026-10-01').length }; });
check('9c', 'El programa arranca el 01-10-2026: ninguna orden en el diagnóstico ni en la planeación', ots.n > 0 && ots.min >= '2026-10-01' && ots.enPlan === 0, ots.n + ' órdenes · primera ' + ots.min);
const antesOm = await oee();
await P.click('#parOmAdd');
const fila = '#parOmisiones tr[data-i]:last-child';
await P.fill(fila + ' [data-o="desde"]', '2025-08-01'); await P.fill(fila + ' [data-o="hasta"]', '2025-08-31'); await P.fill(fila + ' [data-o="motivo"]', 'Paro de planta');
await P.click('#parOmAdd');
await P.fill(fila + ' [data-o="desde"]', '2026-01-01'); await P.fill(fila + ' [data-o="hasta"]', '2026-01-15'); await P.fill(fila + ' [data-o="motivo"]', 'Vacaciones colectivas');
await P.click('#parCalGuardar'); await P.waitForTimeout(600);
const conOmUI = await E(() => ({ OEE: CMMS.servicio.E.total.linea.total.OEE, meses: CMMS.servicio.E.total.meses.length, ene: CMMS.servicio.E.total.cal['2026-01'].omitidos, n: CMMS.servicio.E.config.omisiones.length }));
check('9c', 'Se omiten varios periodos desde la interfaz (agosto completo + 1–15 enero) y todo se recalcula', conOmUI.n === 3 && conOmUI.meses === 11 && conOmUI.ene === 15 && conOmUI.OEE !== antesOm.OEE, (antesOm.OEE * 100).toFixed(2) + ' → ' + (conOmUI.OEE * 100).toFixed(2) + ' % · ' + conOmUI.meses + ' meses');
await ir(P, 'linea'); await P.waitForTimeout(200);
check('9c', 'Las vistas ya no muestran el mes omitido', !(await P.$$eval('#lDesde option', o => o.map(x => x.value))).includes('2025-08'), '');
await P.screenshot({ path: path.join(SHOTS, '07_oee_con_omisiones.png') });
await ir(P, 'param'); await P.waitForTimeout(300);
await P.screenshot({ path: path.join(SHOTS, '08_calendario_operacion.png') });
await P.click('#parOmAdd'); await P.fill(fila + ' [data-o="desde"]', '2025-08-20'); await P.fill(fila + ' [data-o="hasta"]', '2025-09-05');
await P.click('#parCalGuardar'); await P.waitForTimeout(400);
check('9c', 'Rangos superpuestos: se rechazan con un aviso y no se guardan', await E(() => CMMS.servicio.E.config.omisiones.length) === 3, (await P.textContent('#avisos')).replace(/\s+/g, ' ').slice(-90));
await ir(P, 'param'); await P.waitForTimeout(300);
for (const d of ['2026-01-01', '2025-08-01']) await P.click('#parOmisiones tr:has(input[value="' + d + '"]) [data-qo]');
await P.click('#parCalGuardar'); await P.waitForTimeout(600);
check('9c', 'Quitar las omisiones devuelve exactamente el OEE anterior', (await oee()).OEE === antesOm.OEE, ((await oee()).OEE * 100).toFixed(4) + ' %');

console.log('\nAuditoría 10 · Integridad global (verificaciones en la aplicación)');
await ir(P, 'audit'); await P.click('#audCorrer');
const aud = await P.$$eval('#audTabla tbody tr', t => t.map(r => [r.cells[0].textContent, r.cells[1].textContent, r.cells[2].textContent]));
aud.filter(x => /Integridad|idempotente|Cadena|Producción =/.test(x[0])).forEach(x => check(10, x[0], x[1] === 'Cumple', x[2]));

console.log('\nAuditorías 11 a 14 · Simulación desde la interfaz (worker)');
await ir(P, 'simdes'); await P.click('#simAjustar'); await P.waitForSelector('#simDist table');
const nDist = await P.$$eval('#simDist tbody tr', t => t.length);
check(11, 'Distribuciones ajustadas y tabla de bondad de ajuste visible', nDist > 20, nDist + ' ajustes');
check(11, 'Advertencia permanente por validez limitada o insuficiente', /Advertencia metodológica permanente/.test(await P.textContent('#simAvisos')), '');
await P.screenshot({ path: path.join(SHOTS, '09_distribuciones.png'), fullPage: true });
await P.click('#simTabs .pest[data-t="escenarios"]');
check(13, 'Escenarios de mejora bloqueados antes de validar', await P.isDisabled('[data-run="E1"]'), '');
await P.click('#simTabs .pest[data-t="validacion"]');
const t0 = Date.now();
await P.click('#simValidar');
await P.waitForFunction(() => document.querySelector('#simValidacion table'), null, { timeout: 180000 });
const val = await E(() => CMMS.servicio.E.validacion);
check(12, 'Worker de simulación: línea base ejecutada sin bloquear la interfaz', true, ((Date.now() - t0) / 1000).toFixed(1) + ' s · ' + val.replicas + ' réplicas');
val.verificaciones.forEach(x => check(12, x.verificacion, x.ok, x.detalle));
val.filas.forEach(f => check(13, f.indicador + ' dentro de tolerancia', f.ok, 'desvío ' + f.desvio.toFixed(2) + ' ' + f.unidad + (f.icContiene ? ' · IC contiene el real' : ' · IC no contiene el real')));
await P.screenshot({ path: path.join(SHOTS, '10_validacion.png'), fullPage: true });
await P.click('#simTabs .pest[data-t="escenarios"]');
check(13, 'Validación aprobada habilita los escenarios', !(await P.isDisabled('[data-run="E1"]')), '');
await P.click('#simCorrerTodos');
await P.waitForFunction(() => Object.keys(CMMS.servicio.E.resultadosSim).length === 7 && !document.getElementById('simProgE').classList.contains('on'), null, { timeout: 400000 });
await P.click('#simTabs .pest[data-t="resultados"]'); await P.waitForTimeout(300);
const comp = await P.$$eval('#simComp tbody tr', t => t.map(r => Array.from(r.cells).map(c => c.textContent.trim())));
check(14, 'Tabla comparativa con los siete escenarios', comp.length === 7, comp.map(c => c[0].slice(0, 3) + ' ' + c[2] + ' Δ' + c[4] + ' ' + c[6]).join(' | '));
check(14, 'Todas las mejoras E1–E6 significativas al 95 %', comp.slice(1).every(c => c[6] === 'Sí'), '');
await P.screenshot({ path: path.join(SHOTS, '11_resultados.png'), fullPage: true });

console.log('\nMejoras finales · PDF, tema, periodos y portal');
await P.click('#simPdf'); await P.waitForTimeout(800);
check('F', 'PDF de resultados sin ventana emergente (documento imprimible en marco interno)', await E(() => { const f = Array.from(document.querySelectorAll('iframe')).pop(); return !!f && /Comparación contra la línea base/.test(f.contentWindow.document.body.textContent); }), '');
await ir(P, 'linea'); await P.waitForTimeout(200);
const colorAntes = await E(() => Chart.getChart('gLEvol').options.scales.x.ticks.color);
await P.click('#btnTema'); await P.waitForTimeout(300);
const colorDespues = await E(() => Chart.getChart('gLEvol').options.scales.x.ticks.color);
check('F', 'Al cambiar de tema los gráficos se repintan con los colores nuevos', colorAntes !== colorDespues, colorAntes + ' → ' + colorDespues);
await P.click('#btnTema'); await P.waitForTimeout(200);
await ir(P, 'param'); await P.waitForTimeout(300);
await P.click('#parNuevoPer'); await P.waitForSelector('#npIni');
const npIni = await P.inputValue('#npIni'), npFin = await P.inputValue('#npFin');
await P.click('.capa.abierta .btn-primary'); await P.waitForTimeout(600);
const nuevoP = await E(() => ({ id: CMMS.servicio.E.periodo.id, dias: CMMS.servicio.E.total.cal.total.dias, fer: CMMS.servicio.E.periodo.feriados.length, reg: Object.values(CMMS.servicio.E.total.conteos).reduce((a, b) => a + b, 0) }));
check('F', 'Nuevo periodo creado y activado, con feriados generados y sin registros', nuevoP.reg === 0 && nuevoP.fer >= 14 && npIni === '2026-10-01', npIni + ' a ' + npFin + ' · ' + nuevoP.dias + ' días · ' + nuevoP.fer + ' feriados');
const c0L = await E(() => ({ l: CMMS.servicio.E.total.linea.total.carga, a: CMMS.servicio.E.total.maquina.AUT.total.carga, p: CMMS.servicio.E.total.maquina.PR1.total.carga }));
const cerr = await E(() => { const L = LEGADO.instantanea(), P0 = CMMS.servicio.E.periodo, out = [];
  for (const [eqId, tipo] of [['autoclave', 'Planificado'], ['prensa1', 'Calidad']]) { const o = L.OTS.find(x => x.eqId === eqId && x.tipo === tipo && x.fecha >= P0.fecha_inicio && x.fecha <= P0.fecha_fin && x.estado !== 'Ejecutada');
    o.estado = 'Ejecutada'; o.real = 120; o.enJornada = true; out.push(o.id); }
  CMMS.alCambiarLegado(); return out; });
await P.waitForTimeout(400);
const c1L = await E(() => ({ l: CMMS.servicio.E.total.linea.total.carga, a: CMMS.servicio.E.total.maquina.AUT.total.carga, p: CMMS.servicio.E.total.maquina.PR1.total.carga }));
check('F', 'Periodo 2026–2027: OT planificada cumplida en el autoclave (2 h) → carga del autoclave y de la línea −2 h', Math.abs(c0L.a - c1L.a - 2) < 1e-6 && Math.abs(c0L.l - c1L.l - 2) < 1e-6, cerr.join(', ') + ' · línea ' + c0L.l.toFixed(1) + ' → ' + c1L.l.toFixed(1) + ' h');
check('F', 'OT de calidad cumplida en la prensa 1 (paralelo) → solo su carga −2 h', Math.abs(c0L.p - c1L.p - 2) < 1e-6, c0L.p.toFixed(1) + ' → ' + c1L.p.toFixed(1) + ' h');
check('F', 'El resultado informa el mantenimiento del programa ejecutado (2 órdenes, 4 h)', await E(() => { const m = CMMS.servicio.E.total.mantenimiento; return m.ordenes === 2 && Math.abs(m.horas - 4) < 1e-9; }), '');
await E(ids => { const L = LEGADO.instantanea(); ids.forEach(id => { const o = L.OTS.find(x => x.id === id); o.estado = 'Programada'; o.real = null; }); CMMS.alCambiarLegado(); }, cerr); await P.waitForTimeout(400);
check('F', 'Revertir las órdenes devuelve exactamente la carga anterior', await E(c => CMMS.servicio.E.total.linea.total.carga === c, c0L.l), '');
await P.selectOption('#parPeriodoSel', 'P2025'); await P.waitForSelector('.capa.abierta'); await P.click('.capa.abierta .btn-primary'); await P.waitForTimeout(600);
check('F', 'Al volver al periodo 2025–2026 sus registros siguen intactos (OEE 55.68 %)', (await oee()).OEE === o0.OEE, ((await oee()).OEE * 100).toFixed(4) + ' %');

console.log('\nPersistencia · cierre y reapertura del navegador');
await ir(P, 'marca'); await P.fill('#nuNombre', 'Prueba Persistencia'); await P.fill('#nuUser', 'persistencia@lexacaucho.pe'); await P.fill('#nuPass', 'clave1'); await P.click('#nuAdd');
await P.waitForTimeout(4500);
await P.reload(); await P.waitForFunction(() => window.CMMS && CMMS.servicio.E.resultado);
await entrar(P);
const oR = await oee();
check('P', 'Tras recargar, los registros y el OEE persisten (IndexedDB)', oR.OEE === o0.OEE, (oR.OEE * 100).toFixed(4) + ' %');
check('P', 'Tras recargar, persisten los resultados de simulación', await E(() => Object.keys(CMMS.servicio.E.resultadosSim).length) === 7, '');
check('P', 'Claves guardadas cifradas (SHA-256), ninguna en texto plano', await E(async () => (await CMMS.servicio.BDexp.uno('estado_app', 'legado')).datos.USUARIOS.every(u => !u.pass && /^[0-9a-f]{64}$/.test(u.hash))), '');
await P.click('#btnSalir'); await P.fill('#inUser', 'persistencia@lexacaucho.pe'); await P.fill('#inPass', 'clave1'); await P.click('#btnEntrar'); await P.waitForSelector('#app.on');
check('P', 'El usuario creado inicia sesión con su clave tras recargar', await E(() => LEGADO.sesion().user === 'persistencia@lexacaucho.pe'), '');
check('P', 'Tras recargar, persiste el estado de los módulos heredados (usuario creado)', await E(() => LEGADO.instantanea().USUARIOS.some(u => u.user === 'persistencia@lexacaucho.pe')), '');
const movil = await navegador.newContext({ viewport: { width: 820, height: 1180 } }); const pm = await movil.newPage();
await pm.goto('file://' + path.resolve(import.meta.dirname, '../dist/cmms_lexacaucho_v6.html')); await pm.waitForFunction(() => window.CMMS && CMMS.servicio.E.resultado);
await entrar(pm); await pm.waitForTimeout(400); await pm.screenshot({ path: path.join(SHOTS, '12_tableta.png'), fullPage: false });
const desborde = await pm.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check(9, 'Responsive: tableta 820 px sin desplazamiento horizontal de la página', desborde <= 2, desborde + ' px');

check('JS', 'Sin errores de JavaScript en la consola durante toda la prueba', errores.length === 0, errores.slice(0, 5).join(' | '));
await navegador.close();
fs.writeFileSync(path.join(OUT, 'auditoria_e2e.json'), JSON.stringify({ fecha: new Date().toISOString(), fallas, informe }, null, 1));
console.log('\n' + (fallas ? '✘ ' + fallas + ' verificaciones fallidas' : '✔ Todas las verificaciones de extremo a extremo aprobadas') + ' · ' + informe.length + ' verificaciones');
process.exit(fallas ? 1 : 0);
