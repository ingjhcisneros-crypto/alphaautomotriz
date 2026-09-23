/* Punto de entrada: inicia la base, restaura el estado heredado y conecta las vistas nuevas con la navegación
   original (que se conserva). Expone window.CMMS para el script heredado. */
import * as S from './servicio.js';
import { $, aviso, montarExportadores } from './ui/comun.js';
import * as Tablero from './ui/tablero.js';
import * as Calculo from './ui/calculo.js';
import * as Registros from './ui/registros.js';
import * as Parametros from './ui/parametros.js';
import * as Simulador from './ui/simulador.js';
import * as Auditoria from './ui/auditoria.js';

const PINTORES = { tablero: Tablero.pintar, calculo: Calculo.pintar, registros: Registros.pintar, param: Parametros.pintar, simdes: Simulador.pintar, audit: Auditoria.pintar };
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

async function arrancar() {
  const btn = $('btnEntrar'); if (btn) { btn.disabled = true; btn.textContent = 'Abriendo base de datos…'; }
  try {
    await S.iniciar();
    const leg = await S.BDexp.uno('estado_app', 'legado');
    if (leg && globalThis.LEGADO) { globalThis.LEGADO.restaurar(leg.datos); ultimoLegado = JSON.stringify(leg.datos); }
  } catch (e) {
    console.error(e);
    const m = $('loginMsg'); if (m) { m.className = 'login-msg error'; m.textContent = 'No se pudo abrir la base local: ' + e.message; }
    return;
  } finally { if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; } }
  S.escuchar('recalculo', chip);
  S.escuchar('recalculando', () => { const c = $('chipRecalculo'); if (c) { c.textContent = 'Recalculando…'; c.className = 'marcador m-warn'; } });
  [Tablero, Calculo, Registros, Parametros, Simulador, Auditoria].forEach(m => m.montar());
  Tablero.poblarFiltros(true);
  montarExportadores();
  listo = true; chip();
  setInterval(() => guardarLegado(false), 4000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guardarLegado(false); });
  window.addEventListener('beforeunload', () => guardarLegado(false));
}

globalThis.CMMS = {
  alNavegar(v) { if (!listo) return; const f = PINTORES[v]; if (f) f(); montarExportadores(); },
  alIniciarSesion() { if (!listo) return; const v = document.querySelector('.vista.on'); const id = v ? v.id.slice(2) : 'tablero'; if (PINTORES[id]) PINTORES[id](); },
  alCambiarLegado() { guardarLegado(false); },
  resultado: () => S.E.total,
  servicio: S
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
