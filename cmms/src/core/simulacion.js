/* Simulación de eventos discretos de la línea de láminas antiabrasivas.
   Reloj en minutos de TIEMPO DE CARGA: fuera de la ventana operativa nada avanza, y una parada que no
   termina en el turno 2 continúa en el turno 1 del día hábil siguiente. Cola de eventos con montículo binario.

   Flujo: Molino (lotes) → tolva → Extrusora (continua, una lámina cada masa/kg·h) → primera prensa libre (×N)
          → buffer de curado → Autoclave (lote completo) → Acabado → producto terminado. */
import { rng, muestrear, escalarDist, intervalo, pruebaDiferencia } from './estadistica.js';
import { copia } from './util.js';

class Monticulo {
  constructor() { this.t = []; this.d = []; this.n = 0; }
  push(t, d) { let i = this.n++; this.t[i] = t; this.d[i] = d; while (i > 0) { const p = (i - 1) >> 1; if (this.t[p] <= t) break; this.t[i] = this.t[p]; this.d[i] = this.d[p]; i = p; } this.t[i] = t; this.d[i] = d; }
  pop() {
    const t0 = this.t[0], d0 = this.d[0], t = this.t[--this.n], d = this.d[this.n]; let i = 0;
    for (;;) { let c = 2 * i + 1; if (c >= this.n) break; if (c + 1 < this.n && this.t[c + 1] < this.t[c]) c++; if (this.t[c] >= t) break; this.t[i] = this.t[c]; this.d[i] = this.d[c]; i = c; }
    this.t[i] = t; this.d[i] = d; this.ultimo = t0; return d0;
  }
}

const ESTADOS = ['procesando', 'calidad', 'parada', 'vacio', 'bloqueado', 'espera'];
const CATS = ['correctivo', 'setup', 'reuniones', 'auxiliares', 'microparadas', 'vacio', 'vapor', 'preventivo', 'calidad'];

/* Aplica un escenario (porcentajes editables) sobre una copia del modelo. */
export function aplicarEscenario(modeloBase, esc, todos) {
  const m = copia(modeloBase);
  let p = {};
  if (esc && esc.params && esc.params.combinar) esc.params.combinar.forEach(id => { const e = (todos || []).find(x => x.id === id); if (e) p = Object.assign(p, copia(e.params)); });
  else p = copia((esc && esc.params) || {});
  m.escenario = { id: esc ? esc.id : 'E0', nombre: esc ? esc.nombre : 'Línea base', params: p };
  if (p.mtbf_mejora) m.grupos.forEach(g => { const x = g.equipos.map(id => +p.mtbf_mejora[id] || 0).reduce((a, b) => Math.max(a, b), 0); if (x) g.tbfMedia *= 1 + x; });
  if (p.preventivo_h_mes) m.preventivo = Object.entries(p.preventivo_h_mes).filter(([, h]) => +h > 0).map(([id, h]) => ({ id, h: +h }));
  if (p.setup_reduccion != null) { const r = p.setup_reduccion === 'datos' ? m.smed.reduccion : +p.setup_reduccion; m.setupFactor = 1 - Math.max(0, Math.min(1, r)); m.setupReduccionAplicada = r; }
  if (p.nc_termica_eficacia != null) m.ncTermicaEficacia = Math.max(0, Math.min(1, +p.nc_termica_eficacia));
  if (p.micro_reduccion) Object.entries(p.micro_reduccion).forEach(([id, x]) => { if (m.micro[id]) m.micro[id].tasa *= 1 - Math.max(0, Math.min(1, +x)); });
  if (p.encendido_adelanto_min != null || p.elimina_retraso) {
    const ret = p.elimina_retraso ? 0 : m.vacio.retraso;
    m.vacio.previoAjustado = Math.max(0, ret + m.vacio.caldero - (+p.encendido_adelanto_min || 0));
  }
  return m;
}

/* Ejecuta una réplica. Devuelve indicadores de línea, por recurso y de colas. */
export function replica(M, semilla) {
  const r = rng(semilla), P = M.proceso, H = new Monticulo();
  let ahora = 0, seq = 0;
  const dia = M.cargaDia * 60, diasTot = P.calentamiento_dias + M.dias, fin = diasTot * dia, tW = P.calentamiento_dias * dia;
  const cicloEXT = M.masa / P.extrusora_kg_h * 60, cicloPR = P.prensa_ciclo_min, cicloACA = 60 / P.acabado_lam_h;
  const est = {};
  const nuevo = e => Object.assign({}, e, { stops: {}, nStops: 0, ocupado: false, fase: null, resto: 0, finT: 0, ver: 0, item: null, sale: null, cola: 0, acc: {}, estado: 'espera', desde: 0, hechos: 0 });
  M.estaciones.forEach(e => est[e.id] = nuevo(e));
  est.ACA = nuevo({ id: 'ACA', nombre: 'Acabado', etapa: 'Acabado', topologia: 'acabado', fD: 0, fR: 0, fQ: 0, arranque: 0, post: 0 });
  const todos = Object.keys(est);
  todos.forEach(id => ESTADOS.forEach(s => est[id].acc[s] = 0));
  const MOL = est.MOL, EXT = est.EXT, AUT = est.AUT, ACA = est.ACA;
  const prensas = M.estaciones.filter(e => e.topologia === 'paralelo').map(e => est[e.id]);
  let tolva = 0, buffer = [], bufArea = 0, bufMax = 0, bufT = 0, sumaEspera = 0, nEspera = 0;
  let producidas = 0, ultimaSalida = 0, maxHueco = 0;
  const takt = P.sincronizar_al_cuello ? 60 / M.cap : 0;
  /* Tiempo real de autoclave que consume cada lámina (ciclo efectivo ÷ lote): lo que ya costó una lámina descartada. */
  const horaPorLamina = P.autoclave_ciclo_min / 60 / P.autoclave_lote;
  let proxCuerda = 0, cuerdaPend = false;
  const calderosAbajo = {}; let vaporOK = true, vaporDesde = 0;
  const horasCat = {}; CATS.forEach(c => horasCat[c] = 0);
  const eventosCat = {}; CATS.forEach(c => eventosCat[c] = 0);
  const horasLinea = { correctivo: 0, setup: 0, reuniones: 0, auxiliares: 0, microparadas: 0, vacio: 0, defectos: 0, reprocesos: 0, preventivo: 0 };
  const enVentana = t => t >= tW;
  const rigido = P.acople_serie !== 'flujo';
  const lineaProc = M.estaciones.map(e => e.id), lineaTodo = lineaProc.concat(['ACA']);
  const alcance = id => (rigido && est[id] && est[id].topologia === 'serie') ? lineaProc : [id];

  const estadoDe = s => {
    if (s.nStops > 0) {
      const act = Object.keys(s.stops).filter(k => s.stops[k] > 0);
      return act.every(k => k === 'vacio') ? 'vacio' : act.every(k => k === 'calidad') ? 'calidad' : 'parada';
    }
    if (s.sale) return 'bloqueado';
    if (s.ocupado) return s.fase === 'calidad' ? 'calidad' : 'procesando';
    return 'espera';
  };
  const acumular = s => { const a = Math.max(s.desde, tW); if (ahora > a) s.acc[s.estado] += ahora - a; s.desde = ahora; };
  const refrescar = s => { acumular(s); s.estado = estadoDe(s); };
  const bufCambio = () => { const a = Math.max(bufT, tW); if (ahora > a) bufArea += buffer.length * (ahora - a); bufT = ahora; };
  const programar = (t, tipo, x) => { if (!isFinite(t)) throw new Error('Tiempo de evento no válido en ' + tipo); H.push(t, { tipo, x, seq: ++seq }); };

  /* Paradas: contador por categoría; el trabajo en curso se congela y se reanuda al liberar. Las paradas que
     dependen de la operación (fallas, microparadas, reuniones, auxiliares, arranque y setup) no pueden empezar
     sobre un equipo ya detenido: se difieren hasta que el equipo vuelve a operar, como ocurre en planta. */
  const pendientes = [];
  function detener(s, cat) {
    acumular(s);
    if (s.nStops === 0 && s.ocupado) { s.resto = Math.max(0, s.finT - ahora); s.ver++; }
    s.stops[cat] = (s.stops[cat] || 0) + 1; s.nStops++;
    s.estado = estadoDe(s);
  }
  function liberar(s, cat) {
    acumular(s);
    s.stops[cat]--; s.nStops--;
    if (s.nStops === 0 && s.ocupado) { s.finT = ahora + s.resto; programar(s.finT, 'fin', { s: s.id, v: ++s.ver }); }
    s.estado = estadoDe(s);
  }
  function aplicar(p) {
    p.ids.forEach(id => est[id] && detener(est[id], p.cat));
    programar(ahora + p.dur, 'libera', { ids: p.ids, cat: p.cat });
    if (p.alIniciar) p.alIniciar(ahora);
  }
  function parar(ids, cat, dur, alIniciar, diferible = true) {
    if (!(dur > 0)) { if (alIniciar) alIniciar(ahora, true); return; }
    const p = { ids: ids.filter(id => est[id]), cat, dur, alIniciar };
    if (diferible && p.ids.some(id => est[id].nStops > 0)) pendientes.push(p); else aplicar(p);
  }
  function revisarPendientes() {
    for (let i = 0; i < pendientes.length; i++) {
      const p = pendientes[i];
      if (p.ids.every(id => est[id].nStops === 0)) { pendientes.splice(i, 1); aplicar(p); i = -1; }
    }
  }

  function iniciar(s, dur, item) {
    acumular(s); s.ocupado = true; s.fase = 'proceso'; s.item = item; s.resto = dur;
    if (s.nStops === 0) { s.finT = ahora + dur; programar(s.finT, 'fin', { s: s.id, v: ++s.ver }); }
    s.estado = estadoDe(s);
  }
  const libre = s => !s.ocupado && !s.sale && s.nStops === 0;
  function producir(n) {
    if (enVentana(ahora)) { producidas += n; maxHueco = Math.max(maxHueco, ahora - Math.max(ultimaSalida, tW)); ultimaSalida = ahora; }
  }

  /* Empuja material aguas abajo y arranca estaciones libres, del final hacia el inicio. */
  function mover() {
    let cambio = true, g = 0;
    while (cambio && g++ < 60) {
      cambio = false;
      if (ACA.sale) { producir(ACA.sale.n); ACA.sale = null; refrescar(ACA); cambio = true; }
      if (libre(ACA) && ACA.cola > 0) { ACA.cola--; iniciar(ACA, cicloACA, { n: 1 }); cambio = true; }
      if (AUT.sale) { ACA.cola += AUT.sale.n; AUT.sale = null; refrescar(AUT); cambio = true; }
      if (libre(AUT) && buffer.length >= P.autoclave_lote) {
        bufCambio(); const lote = buffer.splice(0, P.autoclave_lote);
        if (enVentana(ahora)) lote.forEach(t => { sumaEspera += ahora - t; nEspera++; });
        iniciar(AUT, P.autoclave_ciclo_min, { n: P.autoclave_lote }); cambio = true;
      }
      for (const pr of prensas) if (pr.sale && buffer.length < P.buffer_curado) { bufCambio(); buffer.push(ahora); bufMax = Math.max(bufMax, buffer.length); pr.sale = null; refrescar(pr); cambio = true; }
      if (EXT.sale) { const pr = prensas.find(libre); if (pr) { EXT.sale = null; refrescar(EXT); iniciar(pr, cicloPR, { n: 1 }); cambio = true; } }
      if (libre(EXT) && tolva >= M.masa - 1e-9) {
        if (!takt || ahora + 1e-9 >= proxCuerda) { tolva -= M.masa; proxCuerda = ahora + takt; iniciar(EXT, cicloEXT, { n: 1 }); cambio = true; }
        else if (!cuerdaPend) { cuerdaPend = true; programar(proxCuerda, 'cuerda', {}); }
      }
      if (MOL.sale && tolva + P.molino_lote_kg <= P.tolva_extrusora_kg + 1e-9) { tolva += P.molino_lote_kg; MOL.sale = null; refrescar(MOL); cambio = true; }
      if (libre(MOL)) { iniciar(MOL, P.molino_ciclo_min, { kg: P.molino_lote_kg }); cambio = true; }
    }
  }

  /* Fin de proceso con posible no conformidad (Bernoulli por unidad o lote procesado). La demora registrada
     ocupa la estación; en el autoclave el defecto además descarta las láminas del lote. */
  function finProceso(s) {
    if (s.fase === 'proceso' && s.id !== 'ACA') {
      const q = M.calidad[s.id];
      if (q && q.pEfectiva > 0 && r() < q.pEfectiva) {
        const ev = (q.pool || q.eventos)[Math.floor(r() * (q.pool || q.eventos).length)];
        let extraH = ev.h, perdidas = 0;
        if (ev.tipo === 'D') { perdidas = Math.min(s.item.n || 1, Math.round(ev.lam)); extraH = Math.max(0, ev.h - perdidas * horaPorLamina); }
        if (enVentana(ahora)) horasLinea[ev.tipo === 'D' ? 'defectos' : 'reprocesos'] += ev.h * s.fQ;
        if (perdidas) s.item = { n: Math.max(0, (s.item.n || 1) - perdidas) };
        if (extraH > 0) {
          if (rigido && s.topologia === 'serie') parar(lineaProc, 'calidad', extraH * 60, null, false);
          else { acumular(s); s.fase = 'calidad'; s.resto = extraH * 60; s.estado = estadoDe(s); s.finT = ahora + s.resto; programar(s.finT, 'fin', { s: s.id, v: ++s.ver }); return; }
        }
      }
    }
    acumular(s); s.ocupado = false; s.fase = null; s.hechos++;
    const it = s.item; s.item = null;
    if (!(it && it.n === 0)) s.sale = it || { n: 1 };
    s.estado = estadoDe(s);
  }

  /* Distribuciones del escenario: medias ajustadas al periodo (MTBF = (carga − reparación) ÷ fallas). */
  const grupos = M.grupos.map(g => ({ g, tbf: escalarDist(g.tbf, g.tbfMedia), ttr: escalarDist(g.ttr, g.ttrMedia) }));
  Object.keys(M.calidad).forEach(id => {
    const q = M.calidad[id], e = M.ncTermicaEficacia || 0;
    q.pEfectiva = q.p; q.pool = null;
    if (e > 0) {
      const ter = q.eventos.filter(x => x.termico).length / q.eventos.length;
      q.pEfectiva = q.p * (1 - e * ter);
      const noTer = q.eventos.filter(x => !x.termico), terL = q.eventos.filter(x => x.termico);
      const nTer = Math.round(terL.length * (1 - e));
      q.pool = noTer.concat(terL.slice(0, nTer));
      if (!q.pool.length) { q.pool = q.eventos; q.pEfectiva = 0; }
    }
  });
  const expo = tasa => -Math.log(1 - r()) / tasa * 60;
  const tbf = G => (G.tbf.tipo === 'deterministica' ? G.g.tbfMedia : muestrear(G.tbf, r)) * 60;

  /* Eventos iniciales. */
  for (let d = 0; d < diasTot; d++) programar(d * dia, 'dia', { d });
  grupos.forEach((G, i) => programar(G.tbf.tipo === 'deterministica' ? r() * G.g.tbfMedia * 60 : tbf(G), 'falla', { i }));
  Object.entries(M.micro).forEach(([id, m]) => { if (est[id] && m.tasa > 0) programar(expo(m.tasa), 'micro', { id }); });
  if (M.reuniones && M.reuniones.tasa > 0) programar(expo(M.reuniones.tasa), 'reunion', {});
  (M.auxiliares || []).forEach((a, i) => { if (a.tasa > 0) programar(expo(a.tasa), 'aux', { i }); });

  const setupF = M.setupFactor != null ? M.setupFactor : 1;
  const previo = M.vacio.previoAjustado != null ? M.vacio.previoAjustado : M.vacio.retraso + M.vacio.caldero;
  const v0 = e => e.arranque > 0 ? (e.vapor ? previo : 0) + e.arranque : 0;
  const vacioLineaMin = Math.max(0, ...M.estaciones.map(v0));
  let setupsVentana = 0, diasVentana = 0;
  const cuenta = (cat, h, lineaH) => { if (!enVentana(ahora)) return; horasCat[cat] += h; eventosCat[cat]++; if (lineaH != null && horasLinea[cat] != null) horasLinea[cat] += lineaH; };

  function revisarVapor() {
    const abajo = M.soportes.filter(id => calderosAbajo[id] > 0).length;
    const ok = M.soportes.length - abajo >= (P.calderos_minimos || 1);
    if (ok === vaporOK) return;
    vaporOK = ok;
    const ids = rigido ? lineaProc : M.estaciones.filter(e => e.vapor).map(e => e.id);
    if (!ok) { ids.forEach(id => detener(est[id], 'vapor')); vaporDesde = ahora; }
    else { ids.forEach(id => liberar(est[id], 'vapor')); if (enVentana(ahora)) { horasCat.vapor += (ahora - Math.max(vaporDesde, tW)) / 60; horasLinea.correctivo += (ahora - Math.max(vaporDesde, tW)) / 60; } }
  }

  mover();
  while (H.n > 0) {
    const ev = H.pop(); ahora = H.ultimo;
    if (ahora > fin) break;
    const x = ev.x;
    switch (ev.tipo) {
      case 'fin': { const s = est[x.s]; if (x.v !== s.ver || s.nStops > 0) break; finProceso(s); break; }
      case 'libera': x.ids.forEach(id => est[id] && liberar(est[id], x.cat)); revisarPendientes(); break;
      case 'cuerda': cuerdaPend = false; break;
      case 'dia': {
        if (enVentana(ahora)) diasVentana++;
        const cambio = r() < M.probCambio;
        if (cambio && enVentana(ahora)) setupsVentana++;
        let tipoCambio = null;
        if (cambio && M.tiposCambio && M.tiposCambio.length) { let u = r(); tipoCambio = M.tiposCambio[M.tiposCambio.length - 1].tipo; for (const t of M.tiposCambio) { if (u < t.p) { tipoCambio = t.tipo; break; } u -= t.p; } }
        const distSetup = id => { const s = M.setup[id]; return (tipoCambio && s.porTipo && s.porTipo[tipoCambio]) ? s.porTipo[tipoCambio].dist : s.dist; };
        if (rigido) {
          /* Arranque de jornada: la línea espera el camino crítico (retraso + caldero + máx. de proceso). */
          parar(lineaProc, 'vacio', vacioLineaMin, null);
          if (cambio) {
            let maxSerie = 0;
            M.estaciones.forEach(e => {
              if (!M.setup[e.id]) return;
              const h = muestrear(distSetup(e.id), r) * setupF;
              if (e.topologia === 'serie') { maxSerie = Math.max(maxSerie, h); cuenta('setup', h, h * e.fD); }
              else parar([e.id], 'setup', h * 60, () => { cuenta('setup', h, h * e.fD); parar([e.id], 'vacio', e.post, null); });
            });
            if (maxSerie > 0) parar(lineaProc, 'setup', maxSerie * 60, () => parar(lineaProc, 'vacio', M.vacio.lineaPost, null));
          }
        } else {
          M.estaciones.forEach(e => {
            parar([e.id], 'vacio', v0(e), null);
            if (cambio && M.setup[e.id]) { const h = muestrear(distSetup(e.id), r) * setupF; parar([e.id], 'setup', h * 60, () => { cuenta('setup', h, h * e.fD); parar([e.id], 'vacio', e.post, null); }); }
          });
        }
        if (M.preventivo && x.d > 0 && x.d % Math.max(1, Math.round(M.dias / 12)) === 0)
          M.preventivo.forEach(pv => { if (est[pv.id]) parar(alcance(pv.id), 'preventivo', pv.h * 60, () => cuenta('preventivo', pv.h, pv.h * est[pv.id].fD)); });
        break;
      }
      case 'falla': {
        const G = grupos[x.i], id = G.g.equipos[Math.floor(r() * G.g.equipos.length)], dur = muestrear(G.ttr, r) * 60;
        if (M.soportes.indexOf(id) >= 0) {
          calderosAbajo[id] = (calderosAbajo[id] || 0) + 1; revisarVapor();
          programar(ahora + dur, 'caldero_ok', { id });
          if (enVentana(ahora)) { horasCat.correctivo += dur / 60; eventosCat.correctivo++; }
          programar(ahora + dur + tbf(G), 'falla', x);
        } else {
          const tA = ahora;
          parar(alcance(id), 'correctivo', dur, () => cuenta('correctivo', dur / 60, dur / 60 * est[id].fD));
          programar(tA + dur + tbf(G), 'falla', x);
        }
        break;
      }
      case 'caldero_ok': calderosAbajo[x.id]--; revisarVapor(); revisarPendientes(); break;
      case 'micro': {
        const m = M.micro[x.id], d = muestrear(m.dur, r) * 60;
        parar(alcance(x.id), 'microparadas', d, () => cuenta('microparadas', d / 60, d / 60 * est[x.id].fR));
        programar(ahora + expo(m.tasa), 'micro', x);
        break;
      }
      case 'reunion': {
        const d = muestrear(M.reuniones.dur, r) * 60;
        parar(lineaTodo, 'reuniones', d, () => cuenta('reuniones', d / 60, d / 60));
        programar(ahora + expo(M.reuniones.tasa), 'reunion', {});
        break;
      }
      case 'aux': {
        const a = M.auxiliares[x.i], d = muestrear(a.dur, r) * 60;
        let u = r(), et = a.etapas[a.etapas.length - 1]; for (const e of a.etapas) { if (u < e.p) { et = e; break; } u -= e.p; }
        let ids = et.etapa === 'Toda la línea' ? lineaTodo : et.equipos.filter(id => est[id]);
        if (rigido && ids.some(id => est[id].topologia === 'serie')) ids = Array.from(new Set(ids.concat(lineaProc)));
        parar(ids, 'auxiliares', d, () => cuenta('auxiliares', d / 60, d / 60 * M.factorAux));
        programar(ahora + expo(a.tasa), 'aux', x);
        break;
      }
    }
    mover();
  }
  ahora = fin;
  todos.forEach(id => acumular(est[id])); bufCambio();
  maxHueco = Math.max(maxHueco, fin - Math.max(ultimaSalida, tW));

  /* Contabilidad de línea con las mismas reglas del módulo de OEE. */
  const ventanaH = (fin - tW) / 60;
  horasLinea.vacio = (diasVentana * vacioLineaMin + setupsVentana * M.vacio.lineaPost) / 60;
  const cargaSim = ventanaH - horasLinea.preventivo;
  const perdD = horasLinea.correctivo + horasLinea.setup + horasLinea.reuniones + horasLinea.auxiliares;
  const bruto = cargaSim - perdD, va = producidas / M.cap, qH = horasLinea.defectos + horasLinea.reprocesos, neto = va + qH;
  const recursos = {};
  todos.forEach(id => {
    const s = est[id], tot = ESTADOS.reduce((a, k) => a + s.acc[k], 0) / 60;
    recursos[id] = { nombre: s.nombre, productivo: (s.acc.procesando + s.acc.calidad) / 60, parada: s.acc.parada / 60, vacio: s.acc.vacio / 60, bloqueado: s.acc.bloqueado / 60,
      espera: s.acc.espera / 60, total: tot, utilizacion: s.acc.procesando / (fin - tW), balance: Math.abs(tot - ventanaH) / ventanaH };
  });
  return {
    semilla, produccion: producidas, carga: cargaSim, D: bruto / cargaSim, R: bruto > 0 ? neto / bruto : 0, Q: neto > 0 ? va / neto : 0, OEE: va / cargaSim,
    horasLinea, horasMaquina: horasCat, eventos: eventosCat, recursos, setups: setupsVentana,
    buffer: { medio: bufArea / (fin - tW), maximo: bufMax, esperaMediaMin: nEspera ? sumaEspera / nEspera : 0 },
    bloqueoInterbloqueo: maxHueco / 60 > 5 * M.cargaDia, maxHuecoH: maxHueco / 60, pendientes: pendientes.length
  };
}

/* Resumen estadístico de un conjunto de réplicas. */
export function resumir(reps, confianza) {
  const ic = f => intervalo(reps.map(f), confianza);
  const recursos = {};
  Object.keys(reps[0].recursos).forEach(id => {
    recursos[id] = { nombre: reps[0].recursos[id].nombre };
    ['utilizacion', 'productivo', 'parada', 'vacio', 'bloqueado', 'espera', 'balance'].forEach(k => recursos[id][k] = ic(x => x.recursos[id][k]));
  });
  const hl = {}; Object.keys(reps[0].horasLinea).forEach(k => hl[k] = ic(x => x.horasLinea[k]));
  return {
    n: reps.length, OEE: ic(x => x.OEE), D: ic(x => x.D), R: ic(x => x.R), Q: ic(x => x.Q), produccion: ic(x => x.produccion), carga: ic(x => x.carga),
    horasLinea: hl, recursos, bufferMedio: ic(x => x.buffer.medio), bufferMax: ic(x => x.buffer.maximo), esperaAutoclave: ic(x => x.buffer.esperaMediaMin),
    interbloqueos: reps.filter(x => x.bloqueoInterbloqueo).length, balanceMax: Math.max(...reps.flatMap(x => Object.values(x.recursos).map(y => y.balance)))
  };
}

/* Corre réplicas hasta cumplir el criterio de precisión (semiancho ≤ precisión × media) o el tope.
   Es un generador: produce el avance tras cada réplica para no bloquear a quien lo consume (worker o
   ejecución asíncrona por tramos). */
export function* iterarEscenario(modelo, esc, todos) {
  const P = modelo.proceso, M = aplicarEscenario(modelo, esc, todos);
  const base = P.semilla_fija ? +P.semilla : Math.floor(Math.random() * 1e9);
  const reps = [];
  let objetivo = Math.max(2, +P.replicas || 30);
  const tope = Math.max(objetivo, +P.replicas_max || 100);
  for (let i = 0; i < objetivo; i++) {
    reps.push(replica(M, base + i * 7919));
    if (i === objetivo - 1 && objetivo < tope) {
      const s = resumir(reps, P.confianza);
      const peor = Math.max(s.produccion.semiancho / (s.produccion.media || 1), s.OEE.semiancho / (s.OEE.media || 1));
      if (peor > P.precision_relativa) objetivo = Math.min(tope, objetivo + Math.max(5, Math.ceil(objetivo * ((peor / P.precision_relativa) ** 2 - 1))));
    }
    yield { hechas: i + 1, objetivo };
  }
  const resumen = resumir(reps, P.confianza);
  return { escenario: M.escenario, fecha: new Date().toISOString(), semillaBase: base, replicas: reps.length, resumen,
    reps: reps.map(x => ({ semilla: x.semilla, OEE: x.OEE, D: x.D, R: x.R, Q: x.Q, produccion: x.produccion, horasLinea: x.horasLinea })),
    parametrosModelo: { huellaDatos: modelo.huellaDatos, versionDatos: modelo.versionDatos, escenario: M.escenario, proceso: P }, advertencias: modelo.advertencias };
}
export function correrEscenario(modelo, esc, todos, opciones, progreso) {
  const it = iterarEscenario(modelo, esc, todos);
  for (;;) { const x = it.next(); if (x.done) return x.value; if (progreso) progreso(x.value.hechas, x.value.objetivo); }
}

/* Validación del escenario base contra la realidad medida y verificaciones del modelo. */
export function validarBase(res, modelo) {
  const T = modelo.proceso.tolerancias, s = res.resumen, real = modelo.real, filas = [];
  const pp = (k, nombre, tol) => { const m = s[k].media, d = (m - real[k]) * 100; filas.push({ indicador: nombre, real: real[k], simulado: m, li: s[k].li, ls: s[k].ls, desvio: d, unidad: 'pp', tolerancia: tol, ok: Math.abs(d) <= tol, icContiene: real[k] >= s[k].li && real[k] <= s[k].ls }); };
  pp('OEE', 'OEE de línea', T.oee_pp); pp('D', 'Disponibilidad', T.disponibilidad_pp); pp('R', 'Rendimiento', T.rendimiento_pp); pp('Q', 'Calidad', T.calidad_pp);
  const rel = (nombre, realV, ic, tol) => { const d = realV ? (ic.media - realV) / realV : 0; filas.push({ indicador: nombre, real: realV, simulado: ic.media, li: ic.li, ls: ic.ls, desvio: d * 100, unidad: '%', tolerancia: tol * 100, ok: Math.abs(d) <= tol, icContiene: realV >= ic.li && realV <= ic.ls }); };
  rel('Producción (láminas)', real.produccion, s.produccion, T.produccion_rel);
  rel('Horas de parada por correctivo (línea)', real.correctivo, s.horasLinea.correctivo, T.correctivo_rel);
  const util = Object.entries(s.recursos).map(([id, x]) => ({ id, nombre: x.nombre, u: x.utilizacion.media })).sort((a, b) => b.u - a.u);
  const verif = [
    { verificacion: 'El autoclave es el recurso de mayor utilización', ok: util[0].id === 'AUT', detalle: util.map(u => u.nombre + ' ' + (u.u * 100).toFixed(1) + ' %').join(' · ') },
    { verificacion: 'Balance de tiempos por recurso = tiempo de carga (± ' + (T.balance_rel * 100).toFixed(1) + ' %)', ok: s.balanceMax <= T.balance_rel, detalle: 'Desviación máxima ' + (s.balanceMax * 100).toFixed(4) + ' %' },
    { verificacion: 'Sin entidades bloqueadas indefinidamente (interbloqueo)', ok: s.interbloqueos === 0, detalle: s.interbloqueos + ' réplicas con más de 5 días sin producción' }
  ];
  const ok = filas.every(f => f.ok) && verif.every(v => v.ok);
  return { ok, fecha: new Date().toISOString(), filas, verificaciones: verif, huellaDatos: modelo.huellaDatos, replicas: res.replicas };
}

/* Comparación de un escenario contra la línea base con prueba de diferencia de medias. */
export function comparar(base, otro, modelo) {
  const conf = modelo.proceso.confianza;
  const campo = (k, f) => { const a = otro.reps.map(f), b = base.reps.map(f); return Object.assign({ indicador: k, base: b.reduce((x, y) => x + y, 0) / b.length, escenario: a.reduce((x, y) => x + y, 0) / a.length }, pruebaDiferencia(a, b, conf)); };
  const filas = [campo('OEE', x => x.OEE), campo('Disponibilidad', x => x.D), campo('Rendimiento', x => x.R), campo('Calidad', x => x.Q), campo('Producción (láminas)', x => x.produccion)];
  const prod = filas[4];
  return { escenario: otro.escenario, filas, economico: { margen: modelo.margen, delta: prod.delta * modelo.margen, li: prod.li * modelo.margen, ls: prod.ls * modelo.margen, laminas: prod.delta } };
}
