/* Documentos PDF con el estilo del sistema. Se arma un documento A4 en un marco interno y se abre el diálogo de
   impresión del navegador («Guardar como PDF»). No depende de ventanas emergentes ni de librerías externas. */
import { esc } from './comun.js';

/* Reutiliza las fuentes Poppins y Orbitron ya incrustadas en la página (reglas @font-face). */
function fuentes() {
  const out = [];
  for (const hoja of Array.from(document.styleSheets)) {
    let reglas; try { reglas = hoja.cssRules; } catch (e) { continue; }
    for (const r of Array.from(reglas || [])) if (r.type === CSSRule.FONT_FACE_RULE && /Poppins|Orbitron/.test(r.cssText)) out.push(r.cssText);
  }
  return out.join('\n');
}

const CSS = `
@page{ size:A4; margin:14mm 12mm 16mm; @bottom-right{ content:"Página " counter(page) " de " counter(pages); font:8pt Poppins,Arial,sans-serif; color:#7f8c98; } }
*{ box-sizing:border-box; } body{ margin:0; font-family:Poppins,Arial,sans-serif; font-size:9pt; color:#16202b; line-height:1.45; }
.cab{ display:flex; align-items:center; gap:8mm; border-bottom:3px solid #3dea24; padding-bottom:4mm; margin-bottom:5mm; }
.marca{ font-family:Orbitron,Arial,sans-serif; font-weight:900; font-size:15pt; letter-spacing:.12em; color:#16202b; }
.marca span{ color:#1d9c08; } .logo{ max-height:16mm; max-width:40mm; object-fit:contain; }
.tit{ flex:1; } .tit h1{ font-size:13pt; margin:0; } .tit h1 em{ font-style:normal; color:#1d9c08; }
.tit p{ margin:1mm 0 0; font-size:8.3pt; color:#54636f; } .meta{ text-align:right; font-size:7.8pt; color:#54636f; }
.filtros{ display:flex; flex-wrap:wrap; gap:2mm; margin-bottom:4mm; }
.filtros span{ border:1px solid #c3ccd6; border-radius:99px; padding:.6mm 3mm; font-size:7.8pt; color:#3c4a55; }
.kpis{ display:flex; gap:2mm; margin:0 0 5mm; } .kpi{ flex:1; border:1px solid #dde3ea; border-top:3px solid #3dea24; border-radius:2mm; padding:2mm 3mm; }
.kpi b{ display:block; font-family:Orbitron,Arial,sans-serif; font-size:12pt; } .kpi span{ font-size:7.5pt; color:#54636f; }
h2{ font-size:9.5pt; text-transform:uppercase; letter-spacing:.08em; color:#1d9c08; margin:6mm 0 2mm; padding-bottom:1mm; border-bottom:1px solid #dde3ea; page-break-after:avoid; }
h3{ font-size:9pt; margin:4mm 0 1.5mm; }
table{ width:100%; border-collapse:collapse; font-size:8pt; page-break-inside:auto; } tr{ page-break-inside:avoid; }
th,td{ border:1px solid #d3dae0; padding:1.4mm 2mm; text-align:left; vertical-align:top; }
thead th{ background:#eef7ea; color:#1f5c10; font-weight:600; } tbody tr:nth-child(even) td{ background:#f7f9fb; }
td.n, th.n{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; } tr.tot td{ font-weight:600; background:#eef7ea !important; }
.chip{ display:inline-block; padding:0 2mm; border-radius:99px; font-size:7pt; font-weight:600; border:1px solid; }
.ok{ color:#1d7a08; border-color:#9fdc8f; background:#effaec; } .warn{ color:#8a5a00; border-color:#f3d28a; background:#fff7e6; } .bad{ color:#b3122f; border-color:#f2a5b3; background:#fdeef1; }
.nota{ font-size:7.8pt; color:#54636f; margin:2mm 0; }
.firmas{ display:flex; gap:8mm; margin-top:12mm; page-break-inside:avoid; } .firma{ flex:1; text-align:center; } .firma .l{ height:14mm; border-bottom:1px solid #16202b; }
.firma .r{ font-size:7.5pt; color:#54636f; text-transform:uppercase; letter-spacing:.06em; margin-top:1mm; }
`;

/* doc: {titulo, acento, subtitulo, filtros:[texto], kpis:[[valor, etiqueta]], secciones:[{titulo, html}], firmas:bool, archivo} */
export function imprimir(doc) {
  const leg = globalThis.LEGADO ? globalThis.LEGADO.instantanea() : {};
  const logo = leg.LOGOS && (leg.LOGOS.emp || leg.LOGOS.upc);
  const s = leg.USUARIOS && globalThis.LEGADO.sesion ? globalThis.LEGADO.sesion() : null;
  const html = '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>' + esc(doc.archivo || doc.titulo) + '</title><style>' + fuentes() + CSS + '</style></head><body>' +
    '<div class="cab">' + (logo ? '<img class="logo" src="' + logo + '">' : '<div class="marca">CMMS<span>4.0</span></div>') +
    '<div class="tit"><h1>' + esc(doc.titulo) + (doc.acento ? ' <em>' + esc(doc.acento) + '</em>' : '') + '</h1><p>' + esc(doc.subtitulo || 'Línea de láminas antiabrasivas') + '</p></div>' +
    '<div class="meta">Emitido ' + new Date().toLocaleString('es-PE') + (s ? '<br>por ' + esc(s.nombre) : '') + '</div></div>' +
    (doc.filtros && doc.filtros.length ? '<div class="filtros">' + doc.filtros.map(f => '<span>' + esc(f) + '</span>').join('') + '</div>' : '') +
    (doc.kpis && doc.kpis.length ? '<div class="kpis">' + doc.kpis.map(k => '<div class="kpi"><b>' + esc(k[0]) + '</b><span>' + esc(k[1]) + '</span></div>').join('') + '</div>' : '') +
    (doc.secciones || []).map(x => (x.titulo ? '<h2>' + esc(x.titulo) + '</h2>' : '') + x.html).join('') +
    (doc.firmas ? '<div class="firmas">' + ['Elaborado por', 'Revisado por', 'Aprobado por'].map(r => '<div class="firma"><div class="l"></div><div class="r">' + r + '</div></div>').join('') + '</div>' : '') +
    '</body></html>';
  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true'); marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(marco);
  const d = marco.contentWindow.document; d.open(); d.write(html); d.close();
  const lanzar = () => { marco.contentWindow.focus(); marco.contentWindow.print(); setTimeout(() => marco.remove(), 60000); };
  (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(() => setTimeout(lanzar, 150));
  return marco;
}

/* Tabla HTML para el PDF. cols: [{t:'Título', n:true(num)}]; filas: arrays; clases opcionales por fila. */
export function tablaPDF(cols, filas, claseFila) {
  return '<table><thead><tr>' + cols.map(c => '<th' + (c.n ? ' class="n"' : '') + '>' + esc(c.t) + '</th>').join('') + '</tr></thead><tbody>' +
    filas.map((f, i) => '<tr' + (claseFila && claseFila[i] ? ' class="' + claseFila[i] + '"' : '') + '>' + f.map((v, j) => '<td' + (cols[j] && cols[j].n ? ' class="n"' : '') + '>' + (v && v.html ? v.html : esc(v == null ? '' : v)) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
}
