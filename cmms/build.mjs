/* Empaqueta el CMMS en un único HTML autocontenido (sin dependencias de red en tiempo de ejecución):
   fuentes, íconos, SheetJS, Chart.js, código heredado, módulos nuevos y el worker de simulación. */
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const R = p => path.resolve(import.meta.dirname, p);
const leer = p => fs.readFileSync(R(p), 'utf8');
const b64 = p => fs.readFileSync(R(p)).toString('base64');
const seguro = js => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

async function bundle(entrada) {
  const r = await esbuild.build({ entryPoints: [R(entrada)], bundle: true, format: 'iife', write: false, minify: true, target: ['es2020'], legalComments: 'none' });
  return r.outputFiles[0].text;
}

const fuentes = [
  ['Poppins', 300], ['Poppins', 400], ['Poppins', 500], ['Poppins', 600], ['Poppins', 700], ['Poppins', 800],
  ['Orbitron', 500], ['Orbitron', 700], ['Orbitron', 900]
].map(([f, w]) => `@font-face{font-family:'${f}';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64(`node_modules/@fontsource/${f.toLowerCase()}/files/${f.toLowerCase()}-latin-${w}-normal.woff2`)}) format('woff2');}`).join('\n');

const faSolid = b64('node_modules/@fortawesome/fontawesome-free/webfonts/fa-solid-900.woff2');
const fa = (leer('node_modules/@fortawesome/fontawesome-free/css/fontawesome.min.css') + '\n' + leer('node_modules/@fortawesome/fontawesome-free/css/solid.min.css'))
  .replace(/src:url\([^)]*fa-solid-900\.woff2\)[^;}]*/g, `src:url(data:font/woff2;base64,${faSolid}) format("woff2")`)
  .replace(/\/\*![\s\S]*?\*\//g, '');

const app = await bundle('src/app/main.js');
const worker = await bundle('src/app/worker.js');
const markup = leer('src/legacy/markup.html').replace('<!--VISTAS_NUEVAS-->', leer('src/ui/vistas.html'));
const version = JSON.parse(leer('package.json')).version;

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content="CMMS 4.0 v${version} · build ${new Date().toISOString()}">
<title>CMMS 4.0 · Línea de láminas antiabrasivas</title>
<link rel="icon" id="favicon" href="data:,">
<style>
${fuentes}
${fa}
${leer('src/legacy/base.css')}
${leer('src/ui/nuevo.css')}
</style>
</head>
<body>
${markup}
<script>/* SheetJS Community Edition (Apache-2.0) */
${seguro(leer('node_modules/xlsx/dist/xlsx.mini.min.js'))}</script>
<script>/* Chart.js (MIT) */
${seguro(leer('node_modules/chart.js/dist/chart.umd.js'))}</script>
<script>/* Módulos heredados del avance v5 */
${seguro(leer('src/legacy/legacy.js'))}</script>
<script>window.__CODIGO_WORKER__ = ${seguro(JSON.stringify(worker))};</script>
<script>/* Módulos nuevos: OEE, registros, tablero, simulación */
${seguro(app)}</script>
</body>
</html>
`;
fs.mkdirSync(R('dist'), { recursive: true });
fs.writeFileSync(R('dist/cmms_lexacaucho_v6.html'), html);
console.log('dist/cmms_lexacaucho_v6.html', (html.length / 1024 / 1024).toFixed(2), 'MB');

/* Variante para publicar como artefacto de claude.ai: el visor envuelve la página en su propio esqueleto
   (sin <html>/<head>/<body> propios), el título va al inicio y se añade el generador de PDF (html2canvas + jsPDF),
   porque dentro del visor no se puede imprimir. La base compartida y el asistente se activan solos en el visor. */
const pdfvisor = await bundle('src/app/pdfvisor.js');
const artefacto = html
  .replace('<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n', '<title>CMMS Lexacaucho</title>\n')
  .replace('<title>CMMS 4.0 · Línea de láminas antiabrasivas</title>\n', '')
  .replace('</style>\n</head>\n<body>\n', '</style>\n')
  .replace('<script>/* Módulos nuevos', () => '<script>/* html2canvas (MIT) + jsPDF (MIT): PDF dentro del visor */\n' + seguro(pdfvisor) + '</script>\n<script>/* Módulos nuevos') /* función: el código minificado trae «$&» */
  .replace('</body>\n</html>\n', '');
if (/<\/?(html|head|body)\b/i.test(artefacto.replace(/<script>[\s\S]*?<\/script>/g, ''))) throw new Error('La variante artefacto conserva etiquetas html/head/body');
fs.mkdirSync(R('dist/artefacto'), { recursive: true });
fs.writeFileSync(R('dist/artefacto/cmms_lexacaucho.html'), artefacto);
console.log('dist/artefacto/cmms_lexacaucho.html', (artefacto.length / 1024 / 1024).toFixed(2), 'MB');
