/* Vista «Cálculo del OEE»: cadena de tiempos paso a paso (conserva el recorrido por etapas del avance original). */
import { $, esc, h1, n0, pc, pp, banda, registrarExportador, aviso } from './comun.js';
import { E, escuchar } from '../servicio.js';
import { etiquetaMes } from '../../core/calendario.js';

let etapa = '1', tablaActual = null;
export function montar() {
  $('calTabs').querySelectorAll('.etapa-b').forEach(b => b.onclick = () => { $('calTabs').querySelectorAll('.etapa-b').forEach(x => x.classList.toggle('on', x === b)); etapa = b.dataset.e; pintar(); });
  $('btnAlAnim').onclick = () => { const n = globalThis.LEGADO ? globalThis.LEGADO.alSimulador() : 0; aviso(n ? n + ' equipos de la animación actualizados con D, R, C, MTBF y MTTR calculados desde los registros' : 'Sin datos para llevar a la animación', n ? 'ok' : 'warn'); };
  escuchar('recalculo', () => { if ($('v-calculo').classList.contains('on')) pintar(); });
  registrarExportador('calCuerpo', () => tablaActual);
  registrarExportador('calMaq', () => tMaq);
  registrarExportador('calConv', () => tConv);
}
let tMaq = null, tConv = null;

function tabla(enc, filas, titulo, clasesFila) {
  tablaActual = { titulo, encabezados: enc, filas: filas.map(f => f.map(v => typeof v === 'number' ? +v.toFixed(4) : v)) };
  return '<div class="tabla-caja"><table><thead><tr>' + enc.map((h, i) => '<th' + (i ? ' class="num"' : '') + '>' + h + '</th>').join('') + '</tr></thead><tbody>' +
    filas.map((f, i) => '<tr class="' + ((clasesFila && clasesFila[i]) || '') + '">' + f.map((v, j) => j ? '<td class="num">' + (typeof v === 'number' ? (Math.abs(v) <= 1.0000001 && enc[j].indexOf('%') >= 0 ? pc(v) : h1(v)) : esc(v)) + '</td>' : '<td class="nombre">' + esc(v) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}

export function pintar() {
  const r = E.total; if (!r) return;
  const L = r.linea.total, C = r.cal;
  $('cA').textContent = n0(C.total.totalProduccion) + ' h'; $('cB').textContent = n0(L.carga) + ' h';
  $('cC').textContent = n0(L.bruto) + ' h'; $('cD').textContent = n0(L.neto) + ' h'; $('cE').textContent = n0(L.va) + ' h'; $('cO').textContent = pc(L.OEE);
  $('cO').style.color = banda(L.OEE).c;
  const meses = r.meses.concat(['total']), et = m => m === 'total' ? 'Periodo' : etiquetaMes(m);
  const eqs = r.equipos, P = E.periodo;
  const filaMaq = (f) => eqs.map(e => [e.nombre].concat(f(r.maquina[e.id].total, e))).concat([['Línea (horas de línea)'].concat(f(L, null))]);
  const cls = eqs.map(() => '').concat(['total']);
  let html = '';
  if (etapa === '1') {
    $('calTitulo').textContent = 'Tiempo total de producción';
    html = tabla(['Mes', 'Días', 'Domingos', 'Feriados', 'Laborables', 'Calendario (h)', 'Domingos (h)', 'Feriados (h)', 'Turno no laborable (h)', 'A. Total producción (h)'],
      meses.map(m => { const c = C[m]; return [et(m), c.dias, c.domingos, c.feriados, c.laborables, c.calendario, -c.hDomingos, -c.hFeriados, -c.hNoTurno, c.totalProduccion]; }), 'Tiempo total de producción', meses.map(m => m === 'total' ? 'total' : '')) +
      '<p class="nota">' + C.total.feriadosEnDomingo + ' feriado(s) del periodo cae(n) en domingo y se cuenta(n) una sola vez como domingo. Jornada: ' + P.turnos_dia + ' turnos de ' + P.horas_turno + ' h desde las ' + P.hora_inicio + '; un evento antes de las ' + P.hora_corte + ' pertenece al día de producción anterior.</p>';
  } else if (etapa === '2') {
    $('calTitulo').textContent = 'Tiempo de carga';
    html = tabla(['Mes', 'A. Total producción (h)', 'Almuerzos (h)', 'Capacitaciones (h)', 'Mtto. planificado (h)', 'B. Tiempo de carga (h)'],
      meses.map(m => { const c = C[m]; return [et(m), c.totalProduccion, -c.almuerzo, -c.capacitacion, -c.mtto, c.carga]; }), 'Tiempo de carga', meses.map(m => m === 'total' ? 'total' : '')) +
      '<p class="nota">Almuerzos = días laborables × ' + P.turnos_dia + ' turnos × ' + P.horas_almuerzo + ' h · Capacitación = ' + P.semanas_capacitacion + ' semanas × ' + P.turnos_dia + ' turnos × ' + P.horas_capacitacion + ' h, repartida por días calendario.</p>';
  } else if (etapa === '3') {
    $('calTitulo').textContent = 'Paradas no planificadas → tiempo bruto';
    html = tabla(['Máquina', 'B. Carga (h)', 'Correctivo (h)', 'Setup interno (h)', 'Reuniones (h)', 'Auxiliares (h)', 'C. Bruto (h)', 'Disponibilidad %'],
      filaMaq(x => [x.carga, -x.perdidas.correctivo, -x.perdidas.setup, -x.perdidas.reuniones, -x.perdidas.auxiliares, x.bruto, x.D]), 'Tiempo bruto', cls) +
      '<p class="nota">Solo el setup <b>interno</b> se descuenta. Las fallas de auxiliares se reparten entre los equipos de la etapa afectada (' + (E.config.reparto_auxiliares === 'completo' ? 'horas completas' : 'dividido entre equipos') + '); en la línea cuentan una sola vez.</p>';
  } else if (etapa === '4') {
    $('calTitulo').textContent = 'Pérdidas de rendimiento → tiempo neto';
    const v = r.vacioLinea;
    html = tabla(['Máquina', 'C. Bruto (h)', 'Microparadas (h)', 'Operación en vacío (h)', 'D. Neto (h)', 'Rendimiento %'],
      filaMaq(x => [x.bruto, -x.perdidas.microparadas, -x.perdidas.vacio, x.neto, x.R]), 'Tiempo neto', cls) +
      '<p class="nota">Vacío de línea por camino crítico: retraso de encendido ' + v.retraso + ' min + caldero ' + v.caldero + ' min + máx(equipos de proceso) ' + v.proceso + ' min = <b>' + v.arranque + ' min por arranque</b>; ' +
      v.postSetup + ' min por cambio de formato. ' + C.total.laborables + ' arranques × ' + v.arranque + ' min + ' + L.nSetups + ' setups × ' + v.postSetup + ' min = ' + h1(L.perdidas.vacio) + ' h.</p>';
  } else if (etapa === '5') {
    $('calTitulo').textContent = 'Pérdidas de calidad → tiempo de valor añadido';
    html = tabla(['Máquina', 'D. Neto (h)', 'Defectos (h)', 'Reprocesos (h)', 'E. Valor añadido (h)', 'Calidad %'],
      filaMaq(x => [x.neto, -x.perdidas.defectos, -x.perdidas.reprocesos, x.va, x.Q]), 'Tiempo de valor añadido', cls) +
      '<p class="nota">Reproceso: material recuperado que consume capacidad. Defecto: descarte, consume capacidad y material (S/ ' + P.costo_unitario + ' por lámina). En la línea, las unidades en paralelo reparten su calidad entre las unidades de la etapa.</p>';
  } else {
    $('calTitulo').textContent = 'OEE = Disponibilidad × Rendimiento × Calidad';
    html = tabla(['Máquina', 'Disponibilidad %', 'Rendimiento %', 'Calidad %', 'OEE %'], filaMaq(x => [x.D, x.R, x.Q, x.OEE]), 'OEE', cls) +
      '<div class="banda chica" style="margin-top:var(--s4)"><div class="m"><div class="v">' + n0(L.produccion) + '</div><div class="k">Producción = ' + h1(L.va) + ' h × ' + P.capacidad_cuello_botella + ' lám/h</div></div>' +
      '<div class="m"><div class="v">' + pp(L.brecha) + '</div><div class="k">Brecha frente a ' + (P.benchmark_oee * 100).toFixed(2) + ' % (' + esc(P.benchmark_fuente) + ')</div></div></div>';
  }
  $('calCuerpo').innerHTML = html;
  const cadena = tablaActual;
  $('calMaq').innerHTML = tabla(['Máquina', 'Carga (h)', 'Bruto (h)', 'Neto (h)', 'Valor añadido (h)', 'Disponibilidad %', 'Rendimiento %', 'Calidad %', 'OEE %'],
    filaMaq(x => [x.carga, x.bruto, x.neto, x.va, x.D, x.R, x.Q, x.OEE]), 'OEE por máquina y de línea', cls) +
    '<p class="nota">El OEE de línea no es el promedio ni el producto de los OEE individuales: se calcula con horas de línea.</p>';
  tMaq = tablaActual;
  const HM = r.lineaHM.total, cats = [['correctivo', 'Mantenimiento correctivo'], ['setup', 'Cambio de formato (interno)'], ['reuniones', 'Reuniones de emergencia'], ['auxiliares', 'Fallas de equipos auxiliares'], ['microparadas', 'Paradas cortas'], ['vacio', 'Operación en vacío'], ['defectos', 'Defectos de calidad'], ['reprocesos', 'Reprocesos']];
  const f = E.config.factores;
  $('calConv').innerHTML = tabla(['Categoría', 'Horas-máquina', 'Horas de línea', 'Reducción %'], cats.map(c => [c[1], HM[c[0]], L.perdidas[c[0]], HM[c[0]] > 0 ? 1 - L.perdidas[c[0]] / HM[c[0]] : 0]), 'Horas-máquina frente a horas de línea') +
    '<p class="nota">Factores vigentes · serie: ' + pc(f.serie.disponibilidad) + ' disponibilidad, ' + pc(f.serie.rendimiento) + ' rendimiento, ' + pc(f.serie.calidad) + ' calidad · paralelo: ' + pc(f.paralelo.disponibilidad) + ' / ' + pc(f.paralelo.rendimiento) + ' / ' + (f.paralelo.reparto_calidad ? 'calidad ÷ n.° de unidades' : pc(f.paralelo.calidad)) +
    ' · soporte: ' + pc(f.soporte.disponibilidad) + ' / ' + pc(f.soporte.rendimiento) + ' / ' + pc(f.soporte.calidad) + '. Reuniones: una sola vez; auxiliares: ' + pc(E.config.factor_auxiliares_linea) + '; vacío: camino crítico.</p>';
  tConv = tablaActual; tablaActual = cadena;
}
