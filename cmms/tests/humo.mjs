/* Prueba rápida de humo: carga los 7 registros por la interfaz y recorre las vistas nuevas buscando errores. */
import path from 'path';
import { abrir, entrar, ir } from './navegador.mjs';
const ARCH = path.resolve(import.meta.dirname, 'informe/archivos'), SH = process.env.SH || '/tmp';
const { navegador, pagina: P, errores } = await abrir();
const E = (f, a) => P.evaluate(f, a);
await entrar(P);
for (const k of ['correctivo', 'cambio_formato', 'reuniones_emergencia', 'equipos_auxiliares', 'paradas_cortas', 'operacion_en_vacio', 'no_conformidades']) {
  await ir(P, 'registros'); await P.click('#regTabs .pest[data-r="' + k + '"]');
  await P.check('input[name="regModo"][value="incremental"]');
  await P.setInputFiles('#regArchivo', path.join(ARCH, 'A4_' + k + '.xlsx'));
  await P.waitForFunction(() => !document.getElementById('regValidar').disabled); await P.click('#regValidar'); await P.waitForSelector('#regResultado .banda');
  await P.click('#regInsertar'); await P.waitForSelector('.capa.abierta h2:text-matches("terminada")', { timeout: 60000 }); await P.click('.capa.abierta [data-x]');
}
console.log('OEE', await E(() => CMMS.servicio.E.total.linea.total.OEE));
for (const v of ['linea', 'maquina', 'paradas']) { await ir(P, v); await P.waitForTimeout(300); await P.screenshot({ path: path.join(SH, 'h_' + v + '.png'), fullPage: true }); }
await ir(P, 'linea'); await P.click('#lCascada .etapa-b[data-etapa="C"]'); await P.waitForTimeout(200); await P.screenshot({ path: path.join(SH, 'h_cascada.png') }); await P.click('.capa.abierta [data-x]');
await ir(P, 'paradas'); await P.click('#pMatriz .celda-par[data-maq="AUT"][data-t="correctivo"]'); await P.waitForTimeout(200); await P.screenshot({ path: path.join(SH, 'h_parada.png') }); await P.click('.capa.abierta [data-x]');
await ir(P, 'plan'); await P.click('#planTipo .pest[data-t="Planificado"]'); await P.selectOption('#planEqF', 'caldero'); await P.click('#planPdf'); await P.waitForTimeout(600);
const doc = await E(() => { const f = Array.from(document.querySelectorAll('iframe')).pop(); return f && f.contentWindow.document.documentElement.outerHTML; });
console.log('PDF plan', doc ? doc.length : 0, /Caldero/.test(doc||''), /planificado/.test(doc||''));
if (doc) { const p2 = await navegador.newPage(); await p2.setContent(doc); await p2.setViewportSize({ width: 794, height: 1123 }); await p2.screenshot({ path: path.join(SH, 'h_plan_pdf.png'), fullPage: true }); await p2.pdf({ path: path.join(SH, 'Plan_Planificado_caldero.pdf'), format: 'A4' }); }
await ir(P, 'agenda'); await P.click('#hPdf'); await P.waitForTimeout(300); await ir(P, 'anom'); await P.click('#anPdf').catch(()=>{}); await P.waitForTimeout(300);
for (const v of ['linea', 'maquina', 'paradas']) { await ir(P, v); await P.click('#' + v[0] + 'Pdf'); await P.waitForTimeout(400); }
console.log('errores', errores);
await navegador.close();
