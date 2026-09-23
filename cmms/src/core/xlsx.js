/* Escritor mínimo de libros .xlsx (Office Open XML) sin dependencias. Permite estilos básicos,
   formato de fecha, anchos de columna, paneles fijos y validación de datos en lista, que SheetJS
   Community no escribe. El ZIP se genera sin compresión (método «store»), válido para Excel y LibreOffice. */

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
const enc = s => new TextEncoder().encode(s);

export function zip(archivos) {
  const partes = [], centrales = []; let off = 0;
  const u16 = v => [v & 255, (v >>> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  archivos.forEach(f => {
    const nombre = enc(f.nombre), datos = typeof f.datos === 'string' ? enc(f.datos) : f.datos, crc = crc32(datos);
    const loc = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(datos.length), u32(datos.length), u16(nombre.length), u16(0));
    partes.push(new Uint8Array(loc), nombre, datos);
    centrales.push({ nombre, crc, n: datos.length, off });
    off += loc.length + nombre.length + datos.length;
  });
  const ini = off; let tam = 0;
  centrales.forEach(c => {
    const cen = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c.crc), u32(c.n), u32(c.n), u16(c.nombre.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.off));
    partes.push(new Uint8Array(cen), c.nombre); tam += cen.length + c.nombre.length;
  });
  partes.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(centrales.length), u16(centrales.length), u32(tam), u32(ini), u16(0))));
  const total = partes.reduce((s, p) => s + p.length, 0), out = new Uint8Array(total); let p = 0;
  partes.forEach(x => { out.set(x, p); p += x.length; });
  return out;
}

const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
export function colLetra(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

/* Estilos disponibles (índice cellXfs). */
export const EST = { normal: 0, cabecera: 1, fecha: 2, ejemplo: 3, ejemploFecha: 4, num2: 5, titulo: 6, envolver: 7, ejemploNum: 8, num1: 9, pct: 10, negrita: 11 };
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy\\ hh:mm"/></numFmts>
<fonts count="4"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font><font><b/><sz val="12"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F5C10"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="2" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="2" fontId="2" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/* Fecha local 'AAAA-MM-DDTHH:MM' → número de serie de Excel. */
export function serieExcel(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso);
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) / 86400000 + 25569;
}

function celda(ref, c) {
  if (c == null || c === '') return '';
  const o = typeof c === 'object' && !(c instanceof Date) ? c : { v: c };
  if (o.v == null || o.v === '') return o.s ? `<c r="${ref}" s="${o.s}"/>` : '';
  const s = o.s ? ` s="${o.s}"` : '';
  if (o.t === 'd') return `<c r="${ref}"${s}><v>${serieExcel(o.v)}</v></c>`;
  if (typeof o.v === 'number' && isFinite(o.v)) return `<c r="${ref}"${s}><v>${o.v}</v></c>`;
  if (typeof o.v === 'boolean') return `<c r="${ref}"${s} t="b"><v>${o.v ? 1 : 0}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xe(o.v)}</t></is></c>`;
}

function hoja(h) {
  const filas = h.filas.map((f, i) => {
    const cs = (f || []).map((c, j) => celda(colLetra(j) + (i + 1), c)).join('');
    return `<row r="${i + 1}"${h.altoCabecera && i === (h.filaCabecera || 0) ? ' ht="30" customHeight="1"' : ''}>${cs}</row>`;
  }).join('');
  const cols = (h.anchos || []).length ? '<cols>' + h.anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${h.estiloCol && h.estiloCol[i] ? ` style="${h.estiloCol[i]}"` : ''}/>`).join('') + '</cols>' : '';
  const fijo = h.fijarFila ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${h.fijarFila}" topLeftCell="A${h.fijarFila + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const merges = (h.combinar || []).length ? `<mergeCells count="${h.combinar.length}">` + h.combinar.map(m => `<mergeCell ref="${m}"/>`).join('') + '</mergeCells>' : '';
  const dv = (h.validaciones || []).length ? `<dataValidations count="${h.validaciones.length}">` + h.validaciones.map(v =>
    `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="stop" errorTitle="Valor no válido" error="${xe(v.mensaje || 'Seleccione un valor de la lista')}" sqref="${v.rango}"><formula1>${xe(v.formula)}</formula1></dataValidation>`).join('') + '</dataValidations>' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${fijo}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${filas}</sheetData>${merges}${dv}<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
}

/* libro: {hojas:[{nombre, filas:[[celda]], anchos, fijarFila, validaciones:[{rango, formula}], combinar}]} → Uint8Array */
export function escribirLibro(libro) {
  const hs = libro.hojas;
  const archivos = [
    { nombre: '[Content_Types].xml', datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hs.map((h, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { nombre: '_rels/.rels', datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { nombre: 'docProps/core.xml', datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe(libro.titulo || 'CMMS 4.0')}</dc:title><dc:creator>CMMS 4.0</dc:creator></cp:coreProperties>` },
    { nombre: 'xl/workbook.xml', datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${hs.map((h, i) => `<sheet name="${xe(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { nombre: 'xl/_rels/workbook.xml.rels', datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hs.map((h, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${hs.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nombre: 'xl/styles.xml', datos: STYLES }
  ];
  hs.forEach((h, i) => archivos.push({ nombre: `xl/worksheets/sheet${i + 1}.xml`, datos: hoja(h) }));
  return zip(archivos);
}

/* Libro simple a partir de una tabla (exportaciones y reportes de error). */
export function libroTabla(nombreHoja, encabezados, filas, titulo) {
  const f = [];
  if (titulo) { f.push([{ v: titulo, s: EST.titulo }]); f.push([]); }
  f.push(encabezados.map(h => ({ v: h, s: EST.cabecera })));
  filas.forEach(r => f.push(r.map(v => (typeof v === 'object' && v !== null) ? v : { v })));
  return escribirLibro({ titulo, hojas: [{ nombre: nombreHoja.slice(0, 31), filas: f, anchos: encabezados.map(h => Math.max(12, Math.min(48, String(h).length + 4))), fijarFila: titulo ? 3 : 1 }] });
}
