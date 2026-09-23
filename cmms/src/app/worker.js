/* Worker de simulación: ejecuta las réplicas fuera del hilo de la interfaz e informa el avance. */
import { iterarEscenario } from '../core/simulacion.js';
self.onmessage = e => {
  const { modelo, escenario, todos } = e.data;
  try {
    const it = iterarEscenario(modelo, escenario, todos);
    for (;;) { const x = it.next(); if (x.done) { self.postMessage({ tipo: 'fin', resultado: x.value }); break; } self.postMessage({ tipo: 'avance', hechas: x.value.hechas, objetivo: x.value.objetivo }); }
  } catch (err) { self.postMessage({ tipo: 'error', mensaje: err.message }); }
};
