/* Ejecuta un escenario en un Web Worker (código empaquetado en el propio HTML); si el navegador no permite
   workers desde blob, lo ejecuta de forma asíncrona por tramos cediendo el hilo entre réplicas. */
import { iterarEscenario } from '../core/simulacion.js';

export function ejecutar(modelo, escenario, todos, alAvance) {
  return new Promise((ok, mal) => {
    const codigo = globalThis.__CODIGO_WORKER__;
    let w = null;
    try { if (codigo && typeof Worker !== 'undefined') w = new Worker(URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' }))); } catch (e) { w = null; }
    if (w) {
      w.onmessage = e => { const m = e.data; if (m.tipo === 'avance') alAvance && alAvance(m.hechas, m.objetivo); else if (m.tipo === 'fin') { w.terminate(); ok(m.resultado); } else { w.terminate(); mal(new Error(m.mensaje)); } };
      w.onerror = e => { w.terminate(); mal(new Error(e.message || 'Error en el worker de simulación')); };
      w.postMessage({ modelo, escenario, todos });
      return;
    }
    const it = iterarEscenario(modelo, escenario, todos);
    const paso = () => { try { const x = it.next(); if (x.done) return ok(x.value); alAvance && alAvance(x.value.hechas, x.value.objetivo); setTimeout(paso, 0); } catch (e) { mal(e); } };
    setTimeout(paso, 0);
  });
}
