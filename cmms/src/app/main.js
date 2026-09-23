/* Punto de entrada: inicia la base, restaura el estado heredado y conecta las vistas nuevas con la navegación
   original (que se conserva). Expone window.CMMS para el script heredado. */
import * as S from './servicio.js';
import { $, aviso, montarExportadores } from './ui/comun.js';
import * as Linea from './ui/linea.js';
import * as Maquina from './ui/maquina.js';
import * as Paradas from './ui/paradas.js';
import * as Registros from './ui/registros.js';
import * as Parametros from './ui/parametros.js';
import * as Simulador from './ui/simulador.js';
import * as Auditoria from './ui/auditoria.js';
import { imprimir, tablaPDF } from './ui/pdf.js';

const PINTORES = { linea: Linea.pintar, maquina: Maquina.pintar, paradas: Paradas.pintar, registros: Registros.pintar, param: Parametros.pintar, simdes: Simulador.pintar, audit: Auditoria.pintar };
let listo = false, ultimoLegado = '';

function chip() {
  const c = $('chipRecalculo'); if (!c || !S.E.ultimoRecalculo) return;
  c.textContent = 'Recalculado ' + S.E.ultimoRecalculo.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  c.title = 'Último recálculo del OEE: ' + S.E.ultimoRecalculo.toLocaleString('es-PE') + ' (' + S.E.duracionRecalculo.toFixed(0) + ' ms)';
  c.className = 'marcador m-ok';
}

async function guardarLegado(forzar) {
  if (!listo || !globalThis.LEGADO) return;
  let txt; try { txt = JSON.stringify(globalThis.LEGADO.instantanea()); } catch (e) { return; }
  if (!forzar && txt === ultimoLegado) return;
  ultimoLegado = txt;
  await S.BDexp.poner('estado_app', { id: 'legado', fecha: new Date().toISOString(), datos: JSON.parse(txt) });
}

async function sincronizarLegado() {
  if (!globalThis.LEGADO || !S.E.periodo) return;
  const periodos = await S.periodos();
  globalThis.LEGADO.sincronizar({ periodo: S.E.periodo, periodos, omisiones: S.E.config.omisiones || [], programa: S.E.config.programa, equipos: S.E.equipos, sim: S.E.sim, laborables: S.E.total ? S.E.total.cal.total.laborables : 297 });
}
async function arrancar() {
  const btn = $('btnEntrar'); if (btn) { btn.disabled = true; btn.textContent = 'Abriendo base de datos…'; }
  try {
    await S.iniciar();
    const leg = await S.BDexp.uno('estado_app', 'legado');
    if (leg && globalThis.LEGADO) { globalThis.LEGADO.restaurar(leg.datos); ultimoLegado = JSON.stringify(leg.datos); }
    if (globalThis.LEGADO) { await globalThis.LEGADO.asegurarHashes(); await sincronizarLegado(); }
  } catch (e) {
    console.error(e);
    const m = $('loginMsg'); if (m) { m.className = 'login-msg error'; m.textContent = 'No se pudo abrir la base local: ' + e.message; }
    return;
  } finally { if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; } }
  S.escuchar('recalculo', chip);
  S.escuchar('recalculando', () => { const c = $('chipRecalculo'); if (c) { c.textContent = 'Recalculando…'; c.className = 'marcador m-warn'; } });
  [Linea, Maquina, Paradas, Registros, Parametros, Simulador, Auditoria].forEach(m => m.montar());
  /* Automatización: la animación toma D, R, C, MTBF y MTTR del motor cada vez que se recalcula, y el código
     heredado se resincroniza con Parámetros cuando cambian. */
  S.escuchar('recalculo', () => { if (globalThis.LEGADO) globalThis.LEGADO.alSimulador(); });
  S.escuchar('config', async () => { await sincronizarLegado(); S.recalcular('sincronización'); });
  montarExportadores();
  listo = true; chip(); guardarLegado(true);
  /* Al cambiar de tema, los gráficos toman los colores nuevos repintando la vista activa. */
  const tema = $('btnTema'); if (tema) tema.addEventListener('click', () => setTimeout(() => globalThis.CMMS.alIniciarSesion(), 30));
  setInterval(() => guardarLegado(false), 4000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guardarLegado(false); });
  window.addEventListener('beforeunload', () => guardarLegado(false));
}

globalThis.CMMS = {
  alNavegar(v) { if (!listo) return; const f = PINTORES[v]; if (f) f(); montarExportadores(); },
  alIniciarSesion() { if (!listo) return; const v = document.querySelector('.vista.on'); const id = v ? v.id.slice(2) : 'linea'; if (PINTORES[id]) PINTORES[id](); },
  alCambiarLegado() { guardarLegado(false); if (listo) S.alCambiarPrograma(); },
  resultado: () => S.E.total,
  servicio: S,
  pdf: { imprimir, tablaPDF }
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
