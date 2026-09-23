/* Prueba de la variante artefacto con un visor de claude.ai simulado: dos usuarios (navegadores con bases
   locales distintas) comparten la base «db»; asistente («sample»), descargas («downloads») y PDF sin imprimir.
   Ejecutar tras «node build.mjs»: node tests/artefacto.mjs */
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const DIR = import.meta.dirname, OUT = path.join(DIR, 'informe'), SHOTS = path.join(OUT, 'capturas'), ARCH = path.join(OUT, 'archivos');
const PAGINA = path.join(OUT, 'artefacto_visor.html');
fs.writeFileSync(PAGINA, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' +
  fs.readFileSync(path.join(DIR, '../dist/artefacto/cmms_lexacaucho.html'), 'utf8') + '</body></html>');
const informe = []; let fallas = 0;
const check = (n, ok, det) => { informe.push({ verificacion: n, ok: !!ok, detalle: det }); if (!ok) fallas++; console.log((ok ? '  ✔ ' : '  ✘ ') + n + (det != null ? ' — ' + det : '')); };

/* Base compartida en el proceso de prueba (lo que en claude.ai vive en el servidor). */
const docs = new Map(), guardados = [], preguntas = [];
let escrituras = 0, maxBytes = 0;
const RUNTIME = () => {
  const pend = new Map();
  const ref = p => ({
    path: p, id: p.split('/').pop(),
    async get() { const d = await window.__db('get', p); return { id: p.split('/').pop(), exists: d != null, data: () => d == null ? undefined : JSON.parse(d), metadata: { fromCache: false, hasPendingWrites: false } }; },
    async set(o) { const s = JSON.stringify(o); await window.__db('set', p, s); },
    async update(o) { const d = await window.__db('get', p); if (d == null) throw { code: 'invalid_argument' }; await window.__db('set', p, JSON.stringify(Object.assign(JSON.parse(d), o))); },
    async delete() { await window.__db('del', p); },
    onSnapshot(next) { let ult = undefined; const t = setInterval(async () => { const d = await window.__db('get', p); if (d !== ult) { ult = d; next({ id: p.split('/').pop(), exists: d != null, data: () => d == null ? undefined : JSON.parse(d), metadata: { fromCache: false, hasPendingWrites: false } }); } }, 400); return () => clearInterval(t); }
  });
  const db = Object.freeze({ doc: ref, collection: c => ({ doc: id => ref(c + '/' + id) }) });
  const sample = async (input, opts = {}) => {
    const turnos = Array.isArray(input) ? input : [{ role: 'user', content: input }];
    const primero = turnos[0].content, json = JSON.parse(primero.slice(primero.indexOf('{')));
    const pregunta = turnos[turnos.length - 1].content;
    let extra = '';
    if (opts.tools) { const t = opts.tools.find(x => x.name === 'consultar_registros'); const r = await t.execute({ registro: 'correctivo', equipo_id: 'AUT' }, { signal: new AbortController().signal }); extra = '\n- Herramienta consultar_registros: ' + r.total_filas + ' fallas del autoclave, ' + r.total_horas + ' h'; }
    const text = 'Respuesta simulada a «' + pregunta + '».\n- **OEE de línea**: ' + json.oee.linea.OEE + ' %\n- Máquinas en contexto: ' + json.oee.maquinas.length + extra;
    await window.__pregunta(pregunta, primero.length);
    if (opts.onText) opts.onText({ text, delta: text });
    return { text, truncated: false, modelTierApplied: 'default' };
  };
  sample.limits = async () => ({ maxPromptBytes: 65536, tools: { maxCount: 8 } });
  sample.json = async () => ({});
  const downloads = Object.freeze({ async save({ filename, data }) { const b = data instanceof Blob ? data : new Blob([data]); const u8 = new Uint8Array(await b.arrayBuffer()); await window.__guardar(filename, u8.length, Array.from(u8.slice(0, 5))); } });
  const caps = { db, sample, downloads };
  window.claude = Object.freeze({ use: name => new Promise(ok => setTimeout(() => ok(caps[name] || null), 30)) });
};

const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
async function usuario(nombre) {
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.exposeFunction('__db', (op, p, s) => { if (op === 'get') return docs.has(p) ? docs.get(p) : null; if (op === 'set') { escrituras++; maxBytes = Math.max(maxBytes, Buffer.byteLength(s)); if (Buffer.byteLength(s) > 256 * 1024) throw new Error('documento > 256 KB'); docs.set(p, s); return null; } docs.delete(p); return null; });
  await ctx.exposeFunction('__guardar', (f, n, cab) => { guardados.push({ usuario: nombre, f, n, cab }); });
  await ctx.exposeFunction('__pregunta', (q, n) => { preguntas.push({ q, n }); });
  await ctx.addInitScript(RUNTIME);
  const p = await ctx.newPage(); const errores = [];
  p.on('pageerror', e => errores.push(e.message)); p.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  p.on('dialog', d => { errores.push('diálogo nativo: ' + d.message()); d.dismiss(); });
  await p.goto('file://' + PAGINA);
  await p.waitForFunction(() => window.CMMS && CMMS.servicio.E.resultado, null, { timeout: 30000 });
  await p.fill('#inUser', 'gutierres&cisneros@upc.pe'); await p.fill('#inPass', 'grupo29'); await p.click('#btnEntrar'); await p.waitForSelector('#app.on');
  return { p, errores };
}
const nube = p => p.evaluate(() => document.getElementById('chipNube').textContent);
const esperarNube = p => p.waitForFunction(() => /Guardado en la nube/.test(document.getElementById('chipNube').textContent), null, { timeout: 30000 });
async function subir(p, k, archivo) {
  await p.click('#menu a[data-vista="registros"]'); await p.click('#regTabs .pest[data-r="' + k + '"]');
  await p.check('input[name="regModo"][value="incremental"]'); await p.setInputFiles('#regArchivo', archivo);
  await p.waitForFunction(() => !document.getElementById('regValidar').disabled); await p.click('#regValidar'); await p.waitForSelector('#regResultado .banda');
  await p.click('#regInsertar'); await p.waitForSelector('.capa.abierta h2:text-matches("terminada")', { timeout: 60000 }); await p.click('.capa.abierta [data-x]');
}

console.log('\nArtefacto · base compartida entre usuarios');
const A = await usuario('A');
await esperarNube(A.p);
check('Primer usuario: la base local se publica en la base compartida', docs.has('cmms/manifiesto'), docs.size + ' documentos · ' + await nube(A.p));
await subir(A.p, 'correctivo', path.join(ARCH, 'A4_correctivo.xlsx'));
await A.p.waitForTimeout(3500); await esperarNube(A.p);
const oA = await A.p.evaluate(() => CMMS.servicio.E.total.linea.total.OEE);
const B = await usuario('B');
const nB = await B.p.evaluate(() => CMMS.servicio.E.registros.correctivo.length), oB = await B.p.evaluate(() => CMMS.servicio.E.total.linea.total.OEE);
check('Segundo usuario (otro navegador, base local vacía) entra y ve lo que guardó el primero', nB === 309 && oB === oA, nB + ' registros de correctivo · OEE ' + (oB * 100).toFixed(2) + ' %');
await subir(A.p, 'reuniones_emergencia', path.join(ARCH, 'A4_reuniones_emergencia.xlsx'));
await B.p.waitForFunction(() => CMMS.servicio.E.registros.reuniones_emergencia.length > 0, null, { timeout: 30000 });
check('Cambio del usuario A llega en vivo al usuario B (sin recargar)', await B.p.evaluate(() => CMMS.servicio.E.registros.reuniones_emergencia.length) === await A.p.evaluate(() => CMMS.servicio.E.registros.reuniones_emergencia.length),
  (await B.p.evaluate(() => document.getElementById('avisos').textContent)).slice(-60));
check('Paradas de emergencia: 7 columnas (N°, Fecha y hora, Turno, Duración, Motivo, Categoría, Equipos afectados)', await A.p.evaluate(() => { const r = CMMS.servicio.E.registros.reuniones_emergencia[0]; return 'categoria' in r && 'n' in r; }), '');
await B.p.click('#menu a[data-vista="marca"]');
await B.p.fill('#nuNombre', 'Técnico B'); await B.p.fill('#nuUser', 'tecb@lexacaucho.pe'); await B.p.fill('#nuPass', 'clave123'); await B.p.click('#nuAdd');
await A.p.waitForFunction(() => LEGADO.instantanea().USUARIOS.some(u => u.user === 'tecb@lexacaucho.pe'), null, { timeout: 30000 });
check('Un usuario creado por B aparece para A (módulos heredados también compartidos)', true, '');
await B.p.click('#menu a[data-vista="param"]'); await B.p.waitForTimeout(300);
await B.p.click('#parOmAdd'); const fila = '#parOmisiones tr[data-i]:last-child';
await B.p.fill(fila + ' [data-o="desde"]', '2025-08-01'); await B.p.fill(fila + ' [data-o="hasta"]', '2025-08-31'); await B.p.fill(fila + ' [data-o="motivo"]', 'Paro');
await B.p.click('#parCalGuardar');
await A.p.waitForFunction(() => CMMS.servicio.E.config.omisiones.length === 2 && CMMS.servicio.E.total.meses.length === 11, null, { timeout: 30000 }).catch(() => {});
check('Parámetros guardados por B (periodo omitido) se aplican y recalculan en A', await A.p.evaluate(() => CMMS.servicio.E.total.meses.length) === 11, '');
check('Ningún documento supera 256 KB; total de documentos bajo el límite de 5 000', maxBytes <= 256 * 1024 && docs.size < 5000, docs.size + ' documentos · mayor ' + (maxBytes / 1024).toFixed(0) + ' KB · ' + escrituras + ' escrituras');

console.log('\nArtefacto · asistente de IA');
await A.p.click('#menu a[data-vista="linea"]');
check('Botón flotante del asistente visible con la sesión iniciada', await A.p.isVisible('#iaAbrir'), '');
await A.p.click('#iaAbrir'); await A.p.click('#iaSug button >> nth=0');
await A.p.waitForFunction(() => /Respuesta simulada/.test(document.getElementById('iaLista').textContent), null, { timeout: 20000 });
const resp = await A.p.textContent('#iaLista .ia-msg.ia:last-child');
check('El asistente recibe los datos del sistema y usa sus herramientas', /OEE de línea: \d/.test(resp) && /Máquinas en contexto: 10/.test(resp) && /fallas del autoclave/.test(resp), resp.replace(/\s+/g, ' ').slice(0, 160));
check('El contexto enviado cabe en el límite (64 KB)', preguntas.every(x => x.n < 60000), (preguntas[0].n / 1024).toFixed(1) + ' KB');
await A.p.fill('#iaTexto', '¿Qué máquina tiene más paradas de emergencia?'); await A.p.press('#iaTexto', 'Enter');
await A.p.waitForFunction(() => document.querySelectorAll('#iaLista .ia-msg.ia').length >= 3, null, { timeout: 20000 });
await A.p.screenshot({ path: path.join(SHOTS, '13_asistente_ia.png') });
await A.p.click('#iaCerrar');

console.log('\nArtefacto · descargas y PDF sin imprimir');
await A.p.waitForTimeout(600);
await A.p.click('.export[data-bloque="lb1"] [data-f="xlsx"]'); await A.p.waitForTimeout(800);
check('Exportar a Excel usa la capacidad de descargas del visor', guardados.some(g => /\.xlsx$/.test(g.f) && g.n > 500), guardados.map(g => g.f).join(', '));
await A.p.click('#lPdf');
await A.p.waitForFunction(n => true, null); for (let i = 0; i < 60 && !guardados.some(g => /\.pdf$/.test(g.f)); i++) await A.p.waitForTimeout(500);
const pdf = guardados.find(g => /\.pdf$/.test(g.f));
check('Informe PDF generado dentro del visor (sin imprimir) y ofrecido como descarga', pdf && pdf.n > 20000 && String.fromCharCode(...pdf.cab) === '%PDF-', pdf ? pdf.f + ' · ' + (pdf.n / 1024).toFixed(0) + ' KB' : 'no generado');
await A.p.click('#menu a[data-vista="plan"]'); await A.p.click('#planTipo .pest[data-t="Planificado"]'); await A.p.selectOption('#planEqF', 'caldero');
const antes = guardados.length; await A.p.click('#planPdf'); for (let i = 0; i < 60 && guardados.length === antes; i++) await A.p.waitForTimeout(500);
check('PDF del plan «Planificado · Caldero» dentro del visor', guardados.length > antes && /Plan_Planificado_caldero\.pdf/.test(guardados[guardados.length - 1].f), guardados[guardados.length - 1].f);
await A.p.click('#planTabla [data-del] >> nth=0');
check('Confirmaciones con diálogo propio (el visor no muestra confirm/prompt nativos)', await A.p.isVisible('.capa.abierta .btn-danger'), '');
await A.p.click('.capa.abierta [data-i="0"]');

check('Sin errores de JavaScript ni diálogos nativos (usuario A)', A.errores.length === 0, A.errores.slice(0, 3).join(' | '));
check('Sin errores de JavaScript ni diálogos nativos (usuario B)', B.errores.length === 0, B.errores.slice(0, 3).join(' | '));
await navegador.close();
fs.unlinkSync(PAGINA);
fs.writeFileSync(path.join(OUT, 'auditoria_artefacto.json'), JSON.stringify({ fecha: new Date().toISOString(), fallas, informe }, null, 1));
console.log('\n' + (fallas ? '✘ ' + fallas + ' verificaciones fallidas' : '✔ Todas las verificaciones del artefacto aprobadas') + ' · ' + informe.length + ' verificaciones');
process.exit(fallas ? 1 : 0);
