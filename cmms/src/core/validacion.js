/* Validación y normalización de los registros que llegan por Excel o por formulario. Pura: no toca la base. */
import { REGISTROS, claveDuplicado, esFilaEjemplo } from './registros.js';
import { parsearFecha, diaProduccion, mesDe, horasEntre, deMin, aMin, hhmm, esLaborable, enOmision } from './calendario.js';
import { norm, normCmp } from './util.js';

/* Busca la fila de encabezados en las primeras filas: la plantilla del sistema la tiene en la fila 1
   y los archivos de especificación en la fila 4. */
export function ubicarEncabezados(defId, matriz) {
  const def = REGISTROS[defId];
  const req = def.columnas.filter(c => !c.opcional).map(c => normCmp(c.h));
  for (let i = 0; i < Math.min(12, matriz.length); i++) {
    const fila = (matriz[i] || []).map(v => normCmp(v));
    const hits = req.filter(h => fila.indexOf(h) >= 0).length;
    if (hits >= Math.ceil(req.length / 2)) return i;
  }
  return -1;
}

/* Compara encabezados exactos (con tildes y mayúsculas). */
export function verificarEncabezados(defId, encabezados) {
  const def = REGISTROS[defId];
  const pres = encabezados.map(h => norm(h));
  const faltan = def.columnas.filter(c => !c.opcional && pres.indexOf(c.h) < 0).map(c => c.h);
  const sobran = pres.filter(h => h && !def.columnas.some(c => c.h === h));
  return { ok: faltan.length === 0 && sobran.length === 0, faltan, sobran };
}

function enLista(valor, lista) {
  const v = normCmp(valor);
  return (lista || []).find(x => normCmp(x) === v);
}

function num(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}

/* ctx: {periodo, equipos, listas, codigos, config, masa}. Devuelve registros normalizados y el informe. */
export function validarFilas(defId, encabezados, filas, ctx, opciones) {
  const def = REGISTROS[defId];
  const op = Object.assign({ filaBase: 2, forzar: false }, opciones || {});
  const informe = { errores: [], advertencias: [], validos: [], conAdvertencia: [], ejemplos: 0, vacias: 0, rechazoArchivo: null, recalculados: 0 };
  const ver = verificarEncabezados(defId, encabezados);
  if (!ver.ok) {
    informe.rechazoArchivo = 'Los encabezados no coinciden con la plantilla.' +
      (ver.faltan.length ? ' Faltan: ' + ver.faltan.join(', ') + '.' : '') + (ver.sobran.length ? ' No reconocidos: ' + ver.sobran.join(', ') + '.' : '');
    informe.errores.push({ fila: op.filaBase - 1, columna: '(encabezados)', motivo: informe.rechazoArchivo, severidad: 'Archivo rechazado' });
    return informe;
  }
  const idx = {}; encabezados.forEach((h, i) => idx[norm(h)] = i);
  const equiposPorNombre = {}; ctx.equipos.forEach(e => equiposPorNombre[normCmp(e.nombre)] = e);
  const codigos = {}; (ctx.codigos || []).forEach(c => codigos[normCmp(c.codigo)] = c);
  const P = ctx.periodo, tol = (ctx.config && ctx.config.tolerancia_duracion_h) || 0.05;
  const masa = +P.masa_unitaria_kg;

  filas.forEach((fila, i) => {
    const nFila = op.filaBase + i;
    const crudo = {}; def.columnas.forEach(c => crudo[c.k] = idx[c.h] != null ? fila[idx[c.h]] : undefined);
    if (def.columnas.every(c => crudo[c.k] == null || String(crudo[c.k]).trim() === '')) { informe.vacias++; return; }
    if (esFilaEjemplo(defId, crudo)) { informe.ejemplos++; informe.advertencias.push({ fila: nFila, columna: '—', motivo: 'Fila de ejemplo de la plantilla: se omitió', severidad: 'Omitida' }); return; }
    const errs = [], advs = [];
    const E = (col, m) => errs.push({ fila: nFila, columna: col, motivo: m, severidad: 'Fila rechazada' });
    const A = (col, m) => advs.push({ fila: nFila, columna: col, motivo: m, severidad: 'Advertencia' });
    const r = { periodo_id: P.id };
    def.columnas.forEach(c => {
      const v = crudo[c.k];
      const vacio = v == null || String(v).trim() === '';
      if (vacio) { if (c.req) E(c.h, 'Campo obligatorio vacío'); r[c.k] = c.tipo === 'num' ? null : ''; return; }
      if (c.tipo === 'fecha') {
        const f = parsearFecha(v);
        if (!f) E(c.h, 'Fecha u hora no válida: «' + v + '». Use dd/mm/aaaa hh:mm');
        r[c.k] = f;
      } else if (c.tipo === 'num') {
        const n = num(v);
        if (isNaN(n)) E(c.h, 'No es un número: «' + v + '»');
        else if (c.positivo && !(n > 0)) E(c.h, 'Debe ser mayor que cero');
        else if (c.noNegativo && n < 0) E(c.h, 'No puede ser negativo');
        r[c.k] = n;
      } else if (c.tipo === 'lista') {
        const ok = enLista(v, ctx.listas[c.lista]);
        if (!ok) E(c.h, 'Valor fuera de la lista: «' + v + '»');
        r[c.k] = ok || norm(v);
      } else if (c.tipo === 'equipo') {
        const ok = enLista(v, ctx.listas[c.lista]);
        const e = equiposPorNombre[normCmp(v)];
        if (!ok) E(c.h, 'Equipo fuera de la lista: «' + v + '»');
        else if (!e) E(c.h, 'El equipo «' + v + '» no existe en el catálogo');
        else if (!e.activo) E(c.h, 'El equipo «' + v + '» está inactivo');
        r[c.k] = e ? e.id : norm(v);
      } else if (c.tipo === 'codigo') {
        const cc = codigos[normCmp(v)];
        if (!cc) E(c.h, 'Código de causa no registrado en el diccionario: «' + v + '»');
        r[c.k] = cc ? cc.codigo : norm(v);
      } else r[c.k] = norm(v);
    });

    if (!def.sinFecha && r[def.inicio]) {
      const ini = r[def.inicio];
      if (def.fin) {
        const fin = r[def.fin];
        if (fin) {
          const h = horasEntre(ini, fin);
          if (!(h > 0)) E(REGISTROS[defId].columnas.find(c => c.k === def.fin).h, 'La fecha de reinicio debe ser posterior a la de inicio');
          else {
            r.horas = h;
            const dado = r[def.dur];
            if (dado != null && !isNaN(dado) && Math.abs(dado - h) > tol) {
              informe.recalculados++;
              A(REGISTROS[defId].columnas.find(c => c.k === def.dur).h, 'Duración declarada ' + dado + ' h difiere de reinicio − inicio (' + h.toFixed(2) + ' h): se recalculó');
            }
            r[def.dur] = Math.round(h * 1000) / 1000;
          }
        }
      } else {
        r.horas = +r[def.dur] || 0;
        if (defId === 'reuniones_emergencia' && r.horas > 0) r.fin = deMin(aMin(ini) + r.horas * 60);
      }
      if (defId === 'no_conformidades' && r.cantidad_afectada > 0) {
        const lam = normCmp(r.unidad) === 'kg' ? r.cantidad_afectada / masa : r.cantidad_afectada;
        if (r.laminas_equivalentes != null && Math.abs(r.laminas_equivalentes - lam) > 0.01) A('Láminas equivalentes', 'Se recalculó a ' + lam.toFixed(2) + ' láminas (factor ' + masa + ' kg/lámina)');
        r.laminas_equivalentes = Math.round(lam * 100) / 100;
        const cod = codigos[normCmp(r.codigo_causa)];
        if (cod && !r.descripcion_causa) r.descripcion_causa = cod.descripcion;
      }
      if (defId !== 'cambio_formato' && r.horas != null && !(r.horas > 0) && !errs.length) E('Duración', 'La duración debe ser mayor que cero');
      r.dia_prod = diaProduccion(ini, P.hora_corte);
      r.mes = mesDe(r.dia_prod);
      r.inicio = ini;
      if (r.dia_prod < P.fecha_inicio || r.dia_prod > P.fecha_fin)
        E(def.columnas.find(c => c.k === def.inicio).h, 'Fuera del periodo declarado (' + P.fecha_inicio + ' a ' + P.fecha_fin + '); día de producción ' + r.dia_prod);
      else if (enOmision(r.dia_prod, P.omisiones)) A(def.columnas.find(c => c.k === def.inicio).h, 'El día ' + r.dia_prod + ' está en un periodo omitido («' + enOmision(r.dia_prod, P.omisiones).motivo + '»): se guarda, pero no entra al cálculo mientras la omisión exista');
      else if (!esLaborable(r.dia_prod, P)) A(def.columnas.find(c => c.k === def.inicio).h, 'El día de producción ' + r.dia_prod + ' es domingo o feriado');
      const h = hhmm(ini);
      if (!(h >= P.hora_inicio || h < P.hora_corte)) A(def.columnas.find(c => c.k === def.inicio).h, 'Hora ' + h + ' fuera de la ventana operativa ' + P.hora_inicio + ' – ' + P.hora_corte);
    }
    r.fila_origen = nFila;
    informe.errores.push(...errs);
    if (errs.length) { informe.advertencias.push(...advs); return; }
    const bloqueantes = advs.filter(a => !/se recalculó|Se recalculó/.test(a.motivo));
    informe.advertencias.push(...advs);
    if (bloqueantes.length && !op.forzar) {
      informe.conAdvertencia.push({ fila: nFila, registro: r, motivos: bloqueantes.map(a => a.motivo) });
      return;
    }
    if (bloqueantes.length) r.forzado = true;
    informe.validos.push(r);
  });
  informe.validos.forEach(r => r._clave = claveDuplicado(defId, r));
  return informe;
}

/* Particiona para la carga incremental: nuevos, duplicados (existentes o repetidos en el mismo archivo). */
export function separarDuplicados(defId, registros, existentes) {
  const vistos = new Set(existentes.map(r => r._clave || claveDuplicado(defId, r)));
  const nuevos = [], duplicados = [];
  registros.forEach(r => { const k = r._clave || claveDuplicado(defId, r); if (vistos.has(k)) duplicados.push(r); else { vistos.add(k); nuevos.push(r); } });
  return { nuevos, duplicados };
}
