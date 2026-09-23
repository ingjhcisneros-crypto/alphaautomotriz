/* Persistencia local con IndexedDB. Elegida frente a un backend porque la planta opera sin internet estable,
   con un puesto de ingeniería: los datos quedan en el equipo, sobreviven al cierre del navegador y no requieren
   servidor. Esquema (versión 1):
     config, equipos, listas, codigos_causa, periodos, productos      catálogos y parámetros
     mantenimiento_correctivo, paradas_cortas, cambio_formato,         registros operativos (clave autonumérica,
     no_conformidades, equipos_auxiliares, operacion_en_vacio,         índices periodo_id y equipo)
     reuniones_emergencia
     escenarios, modelo_sim, resultados_sim                             simulación
     respaldos, bitacora, estado_app                                    respaldo, auditoría y estado heredado */
import { REGISTROS } from '../core/registros.js';

export const NOMBRE_BD = 'cmms_lexacaucho';
const VERSION = 1;
export const TABLAS_REGISTRO = Object.values(REGISTROS).map(d => d.tabla);

let bd = null;
export function abrir(nombre = NOMBRE_BD) {
  return new Promise((ok, mal) => {
    if (!('indexedDB' in globalThis)) return mal(new Error('Este navegador no soporta IndexedDB'));
    const req = indexedDB.open(nombre, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      const crear = (n, o) => d.objectStoreNames.contains(n) ? null : d.createObjectStore(n, o);
      crear('config', { keyPath: 'id' }); crear('equipos', { keyPath: 'id' }); crear('listas', { keyPath: 'nombre' });
      crear('codigos_causa', { keyPath: 'codigo' }); crear('periodos', { keyPath: 'id' }); crear('productos', { keyPath: 'id' });
      Object.values(REGISTROS).forEach(def => {
        const s = crear(def.tabla, { keyPath: 'id', autoIncrement: true });
        if (s) { s.createIndex('periodo_id', 'periodo_id'); s.createIndex('equipo', def.equipo); }
      });
      crear('escenarios', { keyPath: 'id' }); crear('modelo_sim', { keyPath: 'id' }); crear('resultados_sim', { keyPath: 'id' });
      crear('respaldos', { keyPath: 'id', autoIncrement: true }); crear('bitacora', { keyPath: 'id', autoIncrement: true }); crear('estado_app', { keyPath: 'id' });
    };
    req.onsuccess = () => { bd = req.result; ok(bd); };
    req.onerror = () => mal(req.error);
    req.onblocked = () => mal(new Error('La base de datos está bloqueada por otra pestaña abierta del CMMS'));
  });
}

function tx(tablas, modo, fn) {
  return new Promise((ok, mal) => {
    const t = bd.transaction(tablas, modo); let res;
    t.oncomplete = () => ok(res); t.onerror = () => mal(t.error); t.onabort = () => mal(t.error || new Error('Transacción abortada'));
    res = fn(t);
  });
}
const pedir = r => new Promise((ok, mal) => { r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); });

/* Aviso de escritura por tabla: lo usa la sincronización con la base compartida del artefacto. */
let observador = null;
export const observar = fn => { observador = fn; };
const avisar = tabla => { if (observador) try { observador(tabla); } catch (e) { console.error(e); } };

export const todos = tabla => pedir(bd.transaction([tabla]).objectStore(tabla).getAll());
export const uno = (tabla, clave) => pedir(bd.transaction([tabla]).objectStore(tabla).get(clave));
export const contar = tabla => pedir(bd.transaction([tabla]).objectStore(tabla).count());
export function poner(tabla, obj) { let clave; return tx([tabla], 'readwrite', t => { const r = t.objectStore(tabla).put(obj); r.onsuccess = () => { clave = r.result; }; }).then(() => { avisar(tabla); return clave; }); }
export function ponerVarios(tabla, lista) {
  const claves = [];
  return tx([tabla], 'readwrite', t => { const s = t.objectStore(tabla); lista.forEach((o, i) => { const r = s.put(o); r.onsuccess = () => { claves[i] = r.result; }; }); }).then(() => { avisar(tabla); return claves; });
}
export const borrar = (tabla, clave) => tx([tabla], 'readwrite', t => { t.objectStore(tabla).delete(clave); }).then(() => avisar(tabla));
export const borrarVarios = (tabla, claves) => tx([tabla], 'readwrite', t => { const s = t.objectStore(tabla); claves.forEach(k => s.delete(k)); }).then(() => avisar(tabla));
export const vaciar = tabla => tx([tabla], 'readwrite', t => { t.objectStore(tabla).clear(); }).then(() => avisar(tabla));
/* Reemplaza el contenido completo de una tabla sin avisar (lo usa la sincronización al bajar datos compartidos). */
export const reemplazarTabla = (tabla, filas) => tx([tabla], 'readwrite', t => { const s = t.objectStore(tabla); s.clear(); filas.forEach(o => s.put(o)); });

/* Reemplazo atómico: borra los registros del periodo e inserta los nuevos en una sola transacción. */
export function reemplazarPeriodo(tabla, periodoId, nuevos) {
  return tx([tabla], 'readwrite', t => {
    const s = t.objectStore(tabla);
    const cur = s.index('periodo_id').openCursor(IDBKeyRange.only(periodoId));
    cur.onsuccess = () => { const c = cur.result; if (c) { c.delete(); c.continue(); } else nuevos.forEach(o => s.put(o)); };
  }).then(() => avisar(tabla));
}

export function nombresTablas() { return Array.from(bd.objectStoreNames); }
