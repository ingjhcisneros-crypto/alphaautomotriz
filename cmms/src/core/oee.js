/* Motor único de cálculo del OEE (Nakajima). No conoce el DOM ni la base de datos: recibe el periodo,
   la configuración, el catálogo de equipos y los registros, y devuelve todos los indicadores.
   Lo usan la interfaz, el módulo de simulación (valores reales de validación) y las auditorías. */
import { diasDelPeriodo, mesesDelPeriodo, enOmision } from './calendario.js';
import { normCmp, suma } from './util.js';

export const CATEGORIAS = [
  { k: 'correctivo', nombre: 'Mantenimiento correctivo', comp: 'D' },
  { k: 'setup', nombre: 'Setup interno', comp: 'D' },
  { k: 'reuniones', nombre: 'Reuniones de emergencia', comp: 'D' },
  { k: 'auxiliares', nombre: 'Fallas de equipos auxiliares', comp: 'D' },
  { k: 'microparadas', nombre: 'Microparadas', comp: 'R' },
  { k: 'vacio', nombre: 'Operación en vacío', comp: 'R' },
  { k: 'defectos', nombre: 'Defectos de calidad', comp: 'Q' },
  { k: 'reprocesos', nombre: 'Reprocesos', comp: 'Q' }
];
const CAT_D = ['correctivo', 'setup', 'reuniones', 'auxiliares'], CAT_R = ['microparadas', 'vacio'], CAT_Q = ['defectos', 'reprocesos'];
const cero = () => ({ correctivo: 0, setup: 0, reuniones: 0, auxiliares: 0, microparadas: 0, vacio: 0, defectos: 0, reprocesos: 0 });

export function validez(n, umbral) {
  const u = umbral || { suficiente: 30, limitada: 5 };
  return n >= u.suficiente ? 'Suficiente' : n >= u.limitada ? 'Limitada' : 'Insuficiente';
}

/* Cadena de tiempos: B → C → D → E y los tres componentes. */
export function cadena(carga, p) {
  const bruto = carga - suma(CAT_D, k => p[k]);
  const neto = bruto - suma(CAT_R, k => p[k]);
  const va = neto - suma(CAT_Q, k => p[k]);
  const D = carga > 0 ? bruto / carga : 0, R = bruto > 0 ? neto / bruto : 0, Q = neto > 0 ? va / neto : 0;
  return { carga, perdidas: p, bruto, neto, va, D, R, Q, OEE: D * R * Q };
}

/* Tiempo total de producción y tiempo de carga por mes, desde el calendario del periodo. */
export function calendarioOEE(periodo, factorTurno = 1) {
  const dias = diasDelPeriodo(periodo), meses = mesesDelPeriodo(periodo);
  const labTot = dias.filter(d => d.laborable).length, diasTot = dias.length;
  const hOp = periodo.turnos_dia * periodo.horas_turno;
  const porMes = {};
  const armar = (ds) => {
    const n = ds.length, dom = ds.filter(d => d.domingo).length, fer = ds.filter(d => d.feriado).length, om = ds.filter(d => d.omitido).length;
    const lab = ds.filter(d => d.laborable).length;
    const calendario = n * 24, hOm = om * 24, hDom = dom * 24, hFer = fer * 24, noTurno = lab * (24 - hOp);
    const totalProd = (calendario - hOm - hDom - hFer - noTurno) * factorTurno;
    const almuerzo = lab * periodo.turnos_dia * periodo.horas_almuerzo * factorTurno;
    /* Las semanas de capacitación se reparten por día calendario: un día omitido no lleva capacitación. */
    const capacitacion = diasTot ? periodo.semanas_capacitacion * ((n - om) / diasTot) * periodo.turnos_dia * periodo.horas_capacitacion * factorTurno : 0;
    const mtto = labTot ? periodo.horas_mtto_planificado * lab / labTot * factorTurno : 0;
    return { dias: n, omitidos: om, hOmitidos: hOm, domingos: dom, feriados: fer, feriadosEnDomingo: ds.filter(d => d.feriadoDomingo).length, laborables: lab,
      calendario, hDomingos: hDom, hFeriados: hFer, hNoTurno: noTurno + (calendario - hOm - hDom - hFer - noTurno) * (1 - factorTurno),
      totalProduccion: totalProd, almuerzo, capacitacion, mtto, carga: totalProd - almuerzo - capacitacion - mtto };
  };
  meses.forEach(m => porMes[m] = armar(dias.filter(d => d.mes === m)));
  porMes.total = armar(dias);
  return porMes;
}

function indiceEquipos(equipos) {
  const porNombre = {}, porId = {};
  equipos.forEach(e => { porNombre[normCmp(e.nombre)] = e; porId[e.id] = e; });
  return { porNombre, porId };
}

/* Factor de conversión a horas de línea de un equipo para un componente. */
export function factorLinea(e, comp, config, equiposActivos) {
  const f = (config.factores || {})[e.topologia] || { disponibilidad: 1, rendimiento: 1, calidad: 1 };
  if (comp === 'D') return +f.disponibilidad;
  if (comp === 'R') return +f.rendimiento;
  if (f.reparto_calidad) {
    const n = equiposActivos.filter(x => x.topologia === e.topologia && x.etapa === e.etapa).length || 1;
    return +f.calidad / n;
  }
  return +f.calidad;
}

/* Minutos de vacío de línea por arranque: camino crítico retraso + caldero + máx(equipos de proceso). */
export function vacioLinea(periodo, equipos, vacio, esc) {
  const act = equipos.filter(e => e.activo);
  const vmap = {}; vacio.forEach(v => vmap[v.equipo_id] = v);
  const cal = act.filter(e => e.topologia === 'soporte' && vmap[e.id]).map(e => +vmap[e.id].minutos_arranque);
  const proc = act.filter(e => e.topologia !== 'soporte' && vmap[e.id]);
  const tCal = cal.length ? Math.max(...cal) : 0;
  const tProc = proc.length ? Math.max(...proc.map(e => +vmap[e.id].minutos_arranque)) : 0;
  const tPost = proc.length ? Math.max(...proc.map(e => +vmap[e.id].minutos_post_setup)) : 0;
  const s = esc || {};
  const retraso = s.elimina_retraso ? 0 : +periodo.retraso_encendido_min || 0;
  const previo = Math.max(0, retraso + tCal - (+s.encendido_adelanto_min || 0));
  return { retraso, caldero: tCal, proceso: tProc, arranque: previo + tProc, postSetup: tPost };
}

/* Punto de entrada. filtros: {desde:'AAAA-MM', hasta, equipos:[ids], etapa, topologia, turno}. */
export function calcularOEE(ctx) {
  const { periodo, config, registros } = ctx;
  const filtros = ctx.filtros || {};
  const equipos = ctx.equipos.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const activos = equipos.filter(e => e.activo);
  const { porNombre, porId } = indiceEquipos(equipos);
  const turnoF = filtros.turno ? String(filtros.turno) : '';
  const factorTurno = turnoF ? 1 / periodo.turnos_dia : 1;
  const cal = calendarioOEE(periodo, factorTurno);
  let meses = mesesDelPeriodo(periodo);
  if (filtros.desde) meses = meses.filter(m => m >= filtros.desde);
  if (filtros.hasta) meses = meses.filter(m => m <= filtros.hasta);
  const enMeses = new Set(meses);
  const selEq = activos.filter(e => (!filtros.equipos || !filtros.equipos.length || filtros.equipos.indexOf(e.id) >= 0)
    && (!filtros.etapa || e.etapa === filtros.etapa) && (!filtros.topologia || e.topologia === filtros.topologia));
  const selSet = new Set(selEq.map(e => e.id));

  const omis = periodo.omisiones || [];
  const pasa = r => enMeses.has(r.mes) && (!turnoF || String(r.turno) === turnoF) && (!r.periodo_id || r.periodo_id === periodo.id) && !(omis.length && enOmision(r.dia_prod || r.inicio || '', omis));
  const R = {};
  ['correctivo', 'paradas_cortas', 'cambio_formato', 'no_conformidades', 'equipos_auxiliares', 'reuniones_emergencia']
    .forEach(k => R[k] = (registros[k] || []).filter(pasa));
  const vacioTabla = (registros.operacion_en_vacio || []).filter(v => !v.periodo_id || v.periodo_id === periodo.id);
  const vmap = {}; vacioTabla.forEach(v => vmap[v.equipo_id] = v);

  /* Horas-máquina por equipo y mes. */
  const hm = {}; activos.forEach(e => { hm[e.id] = {}; meses.forEach(m => hm[e.id][m] = cero()); });
  const nF = {}; activos.forEach(e => { nF[e.id] = {}; meses.forEach(m => nF[e.id][m] = 0); });
  const add = (id, m, k, h) => { if (hm[id] && hm[id][m]) hm[id][m][k] += h; };
  R.correctivo.forEach(r => { add(r.equipo_id, r.mes, 'correctivo', r.horas); if (nF[r.equipo_id] && nF[r.equipo_id][r.mes] != null) nF[r.equipo_id][r.mes]++; });
  R.paradas_cortas.forEach(r => add(r.equipo_id, r.mes, 'microparadas', r.horas));
  R.cambio_formato.forEach(r => { if (normCmp(r.clasificacion_actual) === 'interna') add(r.equipo_id, r.mes, 'setup', +r.duracion_actividad_h || 0); });
  R.no_conformidades.forEach(r => add(r.equipo_id, r.mes, normCmp(r.tipo_no_conformidad).indexOf('reproceso') === 0 ? 'reprocesos' : 'defectos', r.horas));
  R.reuniones_emergencia.forEach(r => {
    const alc = normCmp(r.equipos_afectados);
    const ids = alc === normCmp('Toda la línea') || !alc ? activos.map(e => e.id) : (porNombre[alc] ? [porNombre[alc].id] : []);
    ids.forEach(id => add(id, r.mes, 'reuniones', r.horas));
  });
  R.equipos_auxiliares.forEach(r => {
    const ids = ((config.etapas_afectadas || {})[r.etapa_afectada] || []).filter(id => porId[id] && porId[id].activo);
    const h = config.reparto_auxiliares === 'completo' ? r.horas : r.horas / (ids.length || 1);
    ids.forEach(id => add(id, r.mes, 'auxiliares', h));
  });
  /* Setups: cambios distintos por equipo y mes; arranques: días laborables (arranque de jornada en el turno 1). */
  const cambiosEq = {}, cambiosLinea = {};
  R.cambio_formato.forEach(r => {
    ((cambiosEq[r.equipo_id] = cambiosEq[r.equipo_id] || {})[r.mes] = cambiosEq[r.equipo_id][r.mes] || new Set()).add(r.n_cambio);
    (cambiosLinea[r.mes] = cambiosLinea[r.mes] || new Set()).add(r.n_cambio);
  });
  const arranques = m => (turnoF && turnoF !== '1') ? 0 : cal[m].laborables;
  activos.forEach(e => {
    const v = vmap[e.id]; if (!v) return;
    meses.forEach(m => {
      const ns = cambiosEq[e.id] && cambiosEq[e.id][m] ? cambiosEq[e.id][m].size : 0;
      hm[e.id][m].vacio = (arranques(m) * +v.minutos_arranque + ns * +v.minutos_post_setup) / 60;
    });
  });

  /* Mantenimiento planificado y de calidad EJECUTADO en jornada (órdenes cumplidas del programa): es una parada
     planificada, así que se descuenta del tiempo de carga de su propio equipo. En la línea pesa según la topología
     (un preventivo del autoclave detiene la línea; el de una prensa no). */
  const mtto = {}; activos.forEach(e => { mtto[e.id] = {}; meses.forEach(m => mtto[e.id][m] = 0); });
  (ctx.mantenimiento || []).filter(x => !enOmision(x.dia, omis)).forEach(x => { const m = String(x.dia).slice(0, 7); if (mtto[x.equipo_id] && mtto[x.equipo_id][m] != null) mtto[x.equipo_id][m] += (+x.horas || 0) * factorTurno; });
  const cargaEq = (id, m) => cal[m].carga - mtto[id][m];

  /* Resultados por máquina. */
  const maquina = {};
  activos.forEach(e => {
    maquina[e.id] = {};
    const tot = cero(); let nTot = 0, mTot = 0;
    meses.forEach(m => {
      const p = hm[e.id][m];
      maquina[e.id][m] = Object.assign(cadena(cargaEq(e.id, m), p), { n_fallas: nF[e.id][m], mttoPrograma: mtto[e.id][m] });
      Object.keys(tot).forEach(k => tot[k] += p[k]); nTot += nF[e.id][m]; mTot += mtto[e.id][m];
    });
    const cargaTot = suma(meses, m => cargaEq(e.id, m));
    maquina[e.id].total = Object.assign(cadena(cargaTot, tot), { n_fallas: nTot, mttoPrograma: mTot });
  });
  const mttoLinea = m => suma(activos, e => mtto[e.id][m] * factorLinea(e, 'D', config, activos));

  /* Horas de línea. */
  const vl = vacioLinea(periodo, equipos, vacioTabla);
  const linea = {}, lineaHM = {};
  const cap = +periodo.capacidad_cuello_botella || 0;
  const conv = (m) => {
    const p = cero(), crudo = cero();
    selEq.forEach(e => {
      const x = hm[e.id][m];
      CATEGORIAS.forEach(c => { if (c.k !== 'reuniones' && c.k !== 'auxiliares' && c.k !== 'vacio') crudo[c.k] += x[c.k]; });
      crudo.vacio += x.vacio; crudo.reuniones += x.reuniones; crudo.auxiliares += x.auxiliares;
      p.correctivo += x.correctivo * factorLinea(e, 'D', config, activos);
      p.setup += x.setup * factorLinea(e, 'D', config, activos);
      p.microparadas += x.microparadas * factorLinea(e, 'R', config, activos);
      const fq = factorLinea(e, 'Q', config, activos);
      p.defectos += x.defectos * fq; p.reprocesos += x.reprocesos * fq;
    });
    p.reuniones = suma(R.reuniones_emergencia.filter(r => r.mes === m), r => r.horas);
    p.auxiliares = suma(R.equipos_auxiliares.filter(r => r.mes === m), r => r.horas) * (config.factor_auxiliares_linea != null ? +config.factor_auxiliares_linea : 1);
    const nsL = cambiosLinea[m] ? cambiosLinea[m].size : 0;
    p.vacio = vacioTabla.length ? (arranques(m) * vl.arranque + nsL * vl.postSetup) / 60 : 0;
    return { p, crudo, nSetups: nsL };
  };
  const totL = cero(), totHM = cero(); let nsTot = 0;
  meses.forEach(m => {
    const { p, crudo, nSetups } = conv(m);
    linea[m] = Object.assign(cadena(cal[m].carga - mttoLinea(m), p), { produccion: 0, nSetups, mttoPrograma: mttoLinea(m) });
    linea[m].produccion = linea[m].va * cap;
    lineaHM[m] = crudo;
    Object.keys(totL).forEach(k => { totL[k] += p[k]; totHM[k] += crudo[k]; }); nsTot += nSetups;
  });
  const cargaTot = suma(meses, m => cal[m].carga - mttoLinea(m));
  linea.total = Object.assign(cadena(cargaTot, totL), { nSetups: nsTot, mttoPrograma: suma(meses, mttoLinea) });
  linea.total.produccion = linea.total.va * cap;
  lineaHM.total = totHM;
  meses.concat(['total']).forEach(m => {
    const L = linea[m], bench = +periodo.benchmark_oee || 0, margen = +periodo.margen_unitario || 0;
    L.brecha = L.OEE - bench;
    L.produccionBenchmark = bench * L.carga * cap;
    L.laminasBrecha = Math.max(0, L.produccionBenchmark - L.produccion);
    L.impacto = L.laminasBrecha * margen;
    L.valorPerdidas = {}; Object.keys(L.perdidas).forEach(k => L.valorPerdidas[k] = L.perdidas[k] * cap * margen);
  });

  /* Confiabilidad por equipo (periodo filtrado). */
  const umbral = config.umbral_validez;
  const confiabilidad = selEq.map(e => {
    const t = maquina[e.id].total, n = t.n_fallas, h = t.perdidas.correctivo;
    const mtbf = n ? t.bruto / n : null, mttr = n ? h / n : null;
    return { id: e.id, nombre: e.nombre, topologia: e.topologia, bruto: t.bruto, n, horas: h, mtbf, mttr,
      dinh: n ? mtbf / (mtbf + mttr) : null, validez: validez(n, umbral) };
  });

  /* Pareto: una fila por evento con su causa. */
  const nom = id => porId[id] ? porId[id].nombre : id;
  const pareto = [];
  R.correctivo.filter(r => selSet.has(r.equipo_id)).forEach(r => pareto.push({ cat: 'correctivo', equipo: nom(r.equipo_id), causa: r.causa_raiz, horas: r.horas }));
  R.equipos_auxiliares.forEach(r => pareto.push({ cat: 'auxiliares', equipo: r.equipo_auxiliar, causa: r.causa_raiz, horas: r.horas }));
  R.paradas_cortas.filter(r => selSet.has(r.equipo_id)).forEach(r => pareto.push({ cat: 'microparadas', equipo: nom(r.equipo_id), causa: r.tipo_evento, horas: r.horas }));
  R.cambio_formato.filter(r => selSet.has(r.equipo_id) && normCmp(r.clasificacion_actual) === 'interna')
    .forEach(r => pareto.push({ cat: 'setup', equipo: nom(r.equipo_id), causa: r.actividad, horas: +r.duracion_actividad_h || 0 }));
  R.no_conformidades.filter(r => selSet.has(r.equipo_id)).forEach(r => pareto.push({ cat: normCmp(r.tipo_no_conformidad).indexOf('reproceso') === 0 ? 'reprocesos' : 'defectos',
    equipo: nom(r.equipo_id), causa: r.codigo_causa + ' · ' + (r.descripcion_causa || ''), horas: r.horas, origen: r.origen_causa }));
  R.reuniones_emergencia.forEach(r => pareto.push({ cat: 'reuniones', equipo: r.equipos_afectados, causa: r.motivo, horas: r.horas }));

  /* Sumas directas de los registros (auditoría de integridad). */
  const sumas = {
    correctivo: suma(R.correctivo, r => r.horas),
    setup: suma(R.cambio_formato.filter(r => normCmp(r.clasificacion_actual) === 'interna'), r => r.duracion_actividad_h),
    reuniones: suma(R.reuniones_emergencia, r => r.horas),
    auxiliares: suma(R.equipos_auxiliares, r => r.horas),
    microparadas: suma(R.paradas_cortas, r => r.horas),
    defectos: suma(R.no_conformidades.filter(r => normCmp(r.tipo_no_conformidad).indexOf('reproceso') !== 0), r => r.horas),
    reprocesos: suma(R.no_conformidades.filter(r => normCmp(r.tipo_no_conformidad).indexOf('reproceso') === 0), r => r.horas)
  };

  return { periodo: periodo.id, meses, cal, equipos: activos.map(e => ({ id: e.id, nombre: e.nombre, etapa: e.etapa, topologia: e.topologia })),
    seleccion: selEq.map(e => e.id), maquina, linea, lineaHM, vacioLinea: vl, confiabilidad, pareto, sumas,
    mantenimiento: { ordenes: (ctx.mantenimiento || []).length, horas: suma(ctx.mantenimiento || [], x => x.horas) },
    conteos: Object.fromEntries(Object.keys(R).map(k => [k, R[k].length]).concat([['operacion_en_vacio', vacioTabla.length]])) };
}
