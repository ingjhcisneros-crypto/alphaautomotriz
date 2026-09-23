/* Construye el modelo de simulación a partir de los MISMOS registros que usa el OEE. La simulación no tiene
   datos propios: toda distribución se ajusta aquí desde los registros, con prueba de bondad de ajuste. */
import { calcularOEE, vacioLinea, validez, factorLinea } from './oee.js';
import { horasOperativasEntre, aMin } from './calendario.js';
import { ajustar, media, escalarDist } from './estadistica.js';
import { agrupar, normCmp, suma, huella } from './util.js';

const CANDIDATOS = ['exponencial', 'weibull', 'lognormal', 'gamma', 'triangular'];

/* Ajuste según la validez estadística: con muestra suficiente se ajusta y elige por K-S; con muestra
   limitada o insuficiente se usa la distribución empírica (duraciones) o determinística con la media (tiempos
   entre eventos), y se deja constancia de la advertencia. */
function ajusteSegunValidez(valores, tipo, umbral, preferida) {
  const n = valores.length, v = validez(n, umbral);
  if (!n) return { n, validez: v, tratamiento: 'Sin datos', dist: null };
  if (v === 'Suficiente') {
    const a = ajustar(valores, CANDIDATOS, { minimo: umbral.suficiente });
    return { n, validez: v, tratamiento: 'Ajuste por máxima verosimilitud · mejor K-S', dist: { tipo: a.mejor.tipo, params: a.mejor.params },
      ks: a.mejor.ks, p: a.mejor.p, candidatos: a.candidatos, sugerida: preferida, mediaMuestral: a.mediaMuestral, muestra: valores };
  }
  if (tipo === 'duracion') return { n, validez: v, tratamiento: 'Distribución empírica (remuestreo de ' + n + ' valores)', dist: { tipo: 'empirica', params: { valores: valores.slice().sort((a, b) => a - b) } }, mediaMuestral: media(valores), muestra: valores };
  return { n, validez: v, tratamiento: 'Determinística con la media', dist: { tipo: 'deterministica', params: { valor: media(valores) } }, mediaMuestral: media(valores), muestra: valores };
}

export function construirModelo(ctx, simParams) {
  const { periodo, config, equipos, registros } = ctx;
  const umbral = config.umbral_validez || { suficiente: 30, limitada: 5 };
  const oee = calcularOEE(Object.assign({}, ctx, { filtros: {} }));
  const L = oee.linea.total, carga = L.carga, dias = oee.cal.total.laborables;
  const act = equipos.filter(e => e.activo);
  const porId = {}; act.forEach(e => porId[e.id] = e);
  const R = k => (registros[k] || []).filter(r => !r.periodo_id || r.periodo_id === periodo.id);
  const ajustes = [];
  const reg = (equipo, variable, a, extra) => { ajustes.push(Object.assign({ equipo, variable, n: a.n, validez: a.validez, tratamiento: a.tratamiento,
    distribucion: a.dist ? a.dist.tipo : null, params: a.dist ? a.dist.params : null, ks: a.ks, p: a.p, candidatos: a.candidatos, sugerida: a.sugerida, media: a.mediaMuestral, muestra: a.muestra }, extra || {})); return a; };

  /* 1. Correctivo: tiempo entre fallas sobre el reloj de planta y tiempo de reparación. Prensas y calderos,
     con muestras individuales insuficientes, se agregan como estación y como grupo. */
  const corr = R('correctivo');
  const grupos = [];
  const serieInd = act.filter(e => e.topologia === 'serie');
  const paralelos = agrupar(act.filter(e => e.topologia === 'paralelo'), e => e.etapa);
  const soportes = act.filter(e => e.topologia === 'soporte');
  const defGrupos = serieInd.map(e => ({ id: e.id, nombre: e.nombre, equipos: [e.id] }))
    .concat(Object.keys(paralelos).map(k => ({ id: 'G-' + k, nombre: k + ' (estación de ' + paralelos[k].length + ' unidades)', equipos: paralelos[k].map(e => e.id) })))
    .concat(soportes.length ? [{ id: 'G-SOPORTE', nombre: 'Calderos (grupo de ' + soportes.length + ')', equipos: soportes.map(e => e.id) }] : []);
  defGrupos.forEach(g => {
    const ev = corr.filter(r => g.equipos.indexOf(r.equipo_id) >= 0).sort((a, b) => aMin(a.inicio) - aMin(b.inicio));
    const ttr = ev.map(r => r.horas);
    const sumaRep = suma(ttr);
    const tbfObs = [];
    for (let i = 1; i < ev.length; i++) { const h = horasOperativasEntre(ev[i - 1].fin || ev[i - 1].fecha_hora_reinicio, ev[i].inicio, periodo); if (h > 0) tbfObs.push(h); }
    const n = ev.length;
    const mediaTbf = n ? (carga - sumaRep) / n : null;
    const aT = ajusteSegunValidez(tbfObs.length >= umbral.suficiente ? tbfObs : (n ? [mediaTbf] : []), 'intervalo', umbral, 'exponencial');
    aT.n = n; aT.validez = validez(n, umbral);
    if (aT.validez !== 'Suficiente' && n) { aT.dist = { tipo: 'deterministica', params: { valor: mediaTbf } }; aT.tratamiento = 'Determinística con la media (tiempo de carga − reparación) ÷ ' + n; aT.mediaMuestral = mediaTbf; }
    const aR = ajusteSegunValidez(ttr, 'duracion', umbral, 'lognormal');
    reg(g.nombre, 'Tiempo entre fallas (h)', aT, { grupo: g.id, mediaObjetivo: mediaTbf, equipos: g.equipos });
    reg(g.nombre, 'Tiempo de reparación (h)', aR, { grupo: g.id, mediaObjetivo: n ? sumaRep / n : null, equipos: g.equipos });
    if (n) grupos.push({ id: g.id, nombre: g.nombre, equipos: g.equipos, n, tbf: aT.dist, tbfMedia: mediaTbf, ttr: aR.dist, ttrMedia: sumaRep / n, validez: validez(n, umbral) });
  });

  /* 2. Setup interno por cambio y equipo (triangular por equipo), probabilidad de cambio por día. */
  const cf = R('cambio_formato');
  const interno = cf.filter(r => normCmp(r.clasificacion_actual) === 'interna');
  const porEvento = agrupar(interno, r => r.equipo_id + '|' + r.n_cambio);
  const cambios = new Set(cf.map(r => r.n_cambio)).size;
  const setup = {};
  /* Tipo de cambio = formato saliente → entrante. Se ajusta una triangular por equipo y por tipo cuando hay al
     menos 3 cambios de ese tipo; si no, se usa la del equipo. La simulación sortea el tipo de cada cambio con
     la frecuencia observada en el registro. */
  const tipoDe = r => (r.formato_saliente || '?') + ' → ' + (r.formato_entrante || '?');
  const tipoEvento = {}; cf.forEach(r => tipoEvento[r.n_cambio] = tipoDe(r));
  const frecTipos = {}; Object.values(tipoEvento).forEach(t => frecTipos[t] = (frecTipos[t] || 0) + 1);
  const tiposCambio = Object.entries(frecTipos).map(([tipo, n]) => ({ tipo, p: n / (cambios || 1), n }));
  act.forEach(e => {
    const vals = Object.keys(porEvento).filter(k => k.split('|')[0] === e.id).map(k => suma(porEvento[k], r => r.duracion_actividad_h));
    if (!vals.length) return;
    const tri = ajustar(vals, ['triangular'], { minimo: 1 });
    /* La triangular (mín, moda, máx) se reescala a la media observada para conservar las horas de setup del registro. */
    const d = escalarDist(tri ? { tipo: tri.mejor.tipo, params: tri.mejor.params } : { tipo: 'deterministica', params: { valor: media(vals) } }, media(vals));
    setup[e.id] = { dist: d, media: media(vals), porTipo: {} };
    tiposCambio.forEach(t => {
      const vt = Object.keys(porEvento).filter(k => k.split('|')[0] === e.id && tipoEvento[k.slice(k.indexOf('|') + 1)] === t.tipo).map(k => suma(porEvento[k], r => r.duracion_actividad_h));
      if (vt.length >= 3) { const tt = ajustar(vt, ['triangular'], { minimo: 1 }); if (tt) setup[e.id].porTipo[t.tipo] = { dist: escalarDist({ tipo: tt.mejor.tipo, params: tt.mejor.params }, media(vt)), n: vt.length, media: media(vt) }; }
    });
    reg(e.nombre, 'Setup interno por cambio (h)', { n: vals.length, validez: validez(vals.length, umbral), tratamiento: 'Triangular (mín, moda, máx del registro)', dist: d, ks: tri ? tri.mejor.ks : null, p: tri ? tri.mejor.p : null, mediaMuestral: media(vals), muestra: vals });
  });
  const smedAct = suma(interno, r => r.duracion_actividad_h);
  const smedProp = suma(cf.filter(r => normCmp(r.clasificacion_propuesta) === 'interna'), r => +r.duracion_propuesta_h || 0);

  /* 3. Operación en vacío: minutos por equipo y camino crítico. */
  const vac = R('operacion_en_vacio'); const vmap = {}; vac.forEach(v => vmap[v.equipo_id] = v);
  const vl = vacioLinea(periodo, equipos, vac);

  /* 4. Reuniones y auxiliares. */
  const reu = R('reuniones_emergencia');
  const reuniones = reu.length ? { tasa: reu.length / carga, dur: ajusteSegunValidez(reu.map(r => r.horas), 'duracion', umbral).dist, n: reu.length } : null;
  if (reu.length) reg('Paradas de emergencia', 'Duración (h)', ajusteSegunValidez(reu.map(r => r.horas), 'duracion', umbral));
  const aux = R('equipos_auxiliares');
  const auxiliares = Object.entries(agrupar(aux, r => r.equipo_auxiliar)).map(([nombre, ev]) => {
    const a = ajusteSegunValidez(ev.map(r => r.horas), 'duracion', umbral, 'lognormal');
    reg(nombre, 'Duración de la falla (h)', a);
    const et = agrupar(ev, r => r.etapa_afectada);
    return { nombre, n: ev.length, tasa: ev.length / carga, dur: a.dist, etapas: Object.keys(et).map(k => ({ etapa: k, p: et[k].length / ev.length, equipos: (config.etapas_afectadas || {})[k] || [] })) };
  });

  /* 5. Microparadas por equipo: exponencial con la media observada. */
  const pc = R('paradas_cortas');
  const micro = {};
  Object.entries(agrupar(pc, r => r.equipo_id)).forEach(([id, ev]) => {
    if (!porId[id]) return;
    const m = media(ev.map(r => r.horas)), a = ajusteSegunValidez(ev.map(r => r.horas), 'duracion', umbral, 'exponencial');
    micro[id] = { tasa: ev.length / carga, dur: { tipo: 'exponencial', params: { media: m } }, n: ev.length };
    reg(porId[id].nombre, 'Microparada (h)', a, { usada: 'exponencial (media ' + m.toFixed(3) + ' h)' });
  });

  /* 6. Calidad: probabilidad Bernoulli por unidad procesada y remuestreo de los eventos observados. */
  const nc = R('no_conformidades');
  const prodRef = L.produccion, P = simParams;
  const nPar = {}; act.forEach(e => nPar[e.id] = e.topologia === 'paralelo' ? (paralelos[e.etapa] || []).length : 1);
  /* Unidades procesadas en el periodo: producción de valor añadido más las láminas descartadas, que también
     ocuparon la estación; el molino y el autoclave trabajan por lote. */
  const descartadas = suma(nc.filter(r => normCmp(r.tipo_no_conformidad).indexOf('reproceso') !== 0), r => r.laminas_equivalentes);
  const unidades = id => { const u = prodRef + descartadas; return id === 'MOL' ? u * periodo.masa_unitaria_kg / P.molino_lote_kg : id === 'AUT' ? u / P.autoclave_lote : u / (nPar[id] || 1); };
  const calidad = {};
  Object.entries(agrupar(nc, r => r.equipo_id)).forEach(([id, ev]) => {
    if (!porId[id]) return;
    const u = unidades(id);
    calidad[id] = { p: u > 0 ? Math.min(1, ev.length / u) : 0, n: ev.length,
      eventos: ev.map(r => ({ lam: r.laminas_equivalentes, h: r.horas, tipo: normCmp(r.tipo_no_conformidad).indexOf('reproceso') === 0 ? 'R' : 'D', termico: normCmp(r.origen_causa).indexOf('termica') >= 0 })) };
    const ter = ev.filter(r => normCmp(r.origen_causa).indexOf('termica') >= 0);
    ajustes.push({ equipo: porId[id].nombre, variable: 'Tasa de no conformidad (Bernoulli)', n: ev.length, validez: validez(ev.length, umbral),
      tratamiento: 'p = ' + ev.length + ' eventos ÷ ' + Math.round(u) + ' unidades procesadas', distribucion: 'bernoulli', params: { p: calidad[id].p },
      media: calidad[id].p, termico: ter.length / ev.length });
  });
  const ncH = suma(nc, r => r.horas), ncTer = suma(nc.filter(r => normCmp(r.origen_causa).indexOf('termica') >= 0), r => r.horas);

  const estaciones = act.filter(e => e.topologia !== 'soporte').map(e => ({ id: e.id, nombre: e.nombre, etapa: e.etapa, topologia: e.topologia,
    fD: factorLinea(e, 'D', config, act), fR: factorLinea(e, 'R', config, act), fQ: factorLinea(e, 'Q', config, act),
    arranque: vmap[e.id] ? +vmap[e.id].minutos_arranque : 0, post: vmap[e.id] ? +vmap[e.id].minutos_post_setup : 0, vapor: e.etapa !== 'Molienda' }));

  /* Ciclo real del cuello de botella: con «capacidad demostrada» el ciclo del autoclave es lote ÷ capacidad
     demostrada del catálogo (pérdida de velocidad no registrada en los partes); con «ficha», el ciclo nominal. */
  const proceso = Object.assign({}, simParams);
  const cuello = porId[periodo.equipo_cuello_botella];
  if (simParams.ciclo_cuello_segun === 'demostrada' && cuello && +cuello.capacidad_demostrada > 0)
    proceso.autoclave_ciclo_min = simParams.autoclave_lote / +cuello.capacidad_demostrada * 60;
  proceso.autoclave_ciclo_nominal_min = simParams.autoclave_ciclo_min;

  const modelo = {
    creado: new Date().toISOString(), periodo: periodo.id, carga, dias, cargaDia: carga / dias, cap: +periodo.capacidad_cuello_botella, masa: +periodo.masa_unitaria_kg,
    margen: +periodo.margen_unitario, proceso, estaciones, soportes: soportes.map(e => e.id),
    grupos, setup, tiposCambio, probCambio: dias ? cambios / dias : 0, cambios, vacio: { retraso: vl.retraso, caldero: vl.caldero, lineaArranque: vl.arranque, lineaPost: vl.postSetup },
    reuniones, auxiliares, micro, calidad, factorAux: config.factor_auxiliares_linea != null ? +config.factor_auxiliares_linea : 1,
    smed: { actual: smedAct, propuesta: smedProp, reduccion: smedAct > 0 ? 1 - smedProp / smedAct : 0 },
    calidadTermica: { horas: ncH, termica: ncTer, proporcion: ncH > 0 ? ncTer / ncH : 0 },
    real: { OEE: L.OEE, D: L.D, R: L.R, Q: L.Q, produccion: L.produccion, correctivo: L.perdidas.correctivo, carga, perdidas: L.perdidas },
    ajustes
  };
  modelo.huellaDatos = huella({ c: oee.conteos, s: oee.sumas, v: vac.map(v => [v.equipo_id, v.minutos_arranque, v.minutos_post_setup]) });
  modelo.advertencias = ajustes.filter(a => a.validez !== 'Suficiente').map(a => a.equipo + ' · ' + a.variable + ': ' + a.n + ' eventos, validez ' + a.validez.toLowerCase() + ' — ' + a.tratamiento);
  return modelo;
}
