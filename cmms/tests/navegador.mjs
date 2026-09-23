/* Utilidades para pruebas en Chromium sin cabeza sobre el HTML empaquetado. */
import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';

export const HTML = path.resolve(import.meta.dirname, '../dist/cmms_lexacaucho_v6.html');
const EJECUTABLES = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env.CHROME_PATH].filter(Boolean);

export async function abrir(opciones = {}) {
  const executablePath = EJECUTABLES.find(p => fs.existsSync(p));
  const navegador = await chromium.launch({ executablePath, args: ['--allow-file-access-from-files'] });
  const contexto = await navegador.newContext({ acceptDownloads: true, viewport: opciones.viewport || { width: 1440, height: 900 } });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', e => errores.push('pageerror: ' + e.message));
  pagina.on('console', m => { if (m.type() === 'error') errores.push('console: ' + m.text()); });
  await pagina.goto('file://' + HTML);
  await pagina.waitForFunction(() => window.CMMS && window.CMMS.servicio.E.resultado);
  return { navegador, contexto, pagina, errores };
}
export async function entrar(pagina, usuario = 'gutierres&cisneros@upc.pe', clave = 'grupo29') {
  await pagina.fill('#inUser', usuario); await pagina.fill('#inPass', clave); await pagina.click('#btnEntrar');
  await pagina.waitForSelector('#app.on');
}
export async function ir(pagina, vista) { await pagina.click('#menu a[data-vista="' + vista + '"]'); await pagina.waitForTimeout(150); }
