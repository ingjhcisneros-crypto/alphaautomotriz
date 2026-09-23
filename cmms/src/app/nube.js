/* Base compartida del artefacto (capacidad «db» de claude.ai). Cuando el CMMS se abre como artefacto publicado,
   todo lo que un usuario guarda queda disponible para quien entre después, en cualquier equipo.

   Diseño: IndexedDB sigue siendo la base de trabajo (rápida, transaccional, sin cambios en el resto del código) y
   este módulo la replica en documentos compartidos:
     cmms/manifiesto          versión, autor y huella de cada tabla
     tablas/<tabla>~<n>        el JSON de la tabla partido en trozos de 80 000 caracteres (≤ 240 KB aun con
                               acentos; el límite es 256 KB por documento), así ningún registro grande lo rompe
   Al abrir: se bajan las tablas cuya huella difiere de la local. Al escribir: se suben, con una pausa de 2.5 s
   que agrupa ráfagas (una carga de Excel = una subida). Si otro usuario guarda, llega por el manifiesto en vivo.
   Fuera del visor de claude.ai (archivo abierto desde el disco) no hace nada: la app funciona igual, en local. */
import * as BD from './db.js';
import { huella as h32 } from '../core/util.js';
const huella = filas => { const s = JSON.stringify(filas); return h32(s) + '.' + s.length; };

const TROZO = 80000, PAUSA = 2500;
const cliente = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
let db = null, version = 0, aplicando = false, sucias = new Set(), temporizador = null, subiendo = null, soloLectura = false;
const huellas = {};
const oyentes = [];
export const estado = { modo: 'local', texto: 'Solo este navegador', autor: '', fecha: '' };
const avisarEstado = (modo, texto) => { estado.modo = modo; estado.texto = texto; oyentes.forEach(f => { try { f(estado); } catch (e) { console.error(e); } }); };
export const alCambiarEstado = fn => oyentes.push(fn);

const tablasSincronizadas = () => BD.nombresTablas();
const idTrozo = (t, i) => t + '~' + i;
function partir(texto) {
  const out = [];
  for (let i = 0; i < texto.length; i += TROZO) out.push(texto.slice(i, i + TROZO));
  return out.length ? out : [''];
}

/* Espera la capacidad; null fuera del visor o si este usuario no la tiene. */
export async function conectar() {
  const c = globalThis.claude;
  if (!c || typeof c.use !== 'function') return null;
  try { db = await c.use('db'); } catch (e) { db = null; }
  if (!db) return null;
  avisarEstado('conectando', 'Conectando con la base compartida…');
  return db;
}

async function leerManifiesto() { const s = await db.doc('cmms/manifiesto').get(); return s.exists ? s.data() : null; }

/* Baja las tablas cuya huella compartida difiere de la local (salvo las que este usuario tiene sin subir).
   Se compara por huella de cada tabla, no por número de versión: así dos guardados simultáneos no se pisan. */
let alRemotoFn = null;
async function bajar(man, excluir) {
  const cambiadas = [];
  aplicando = true;
  try {
    for (const [t, info] of Object.entries(man.tablas || {})) {
      if (tablasSincronizadas().indexOf(t) < 0) continue;
      if (huellas[t] === info.huella || (excluir && excluir.has(t))) continue;
      let texto = '';
      for (let i = 0; i < info.partes; i++) {
        const s = await db.doc('tablas/' + idTrozo(t, i)).get();
        if (!s.exists) throw new Error('Falta el trozo ' + i + ' de ' + t + ' en la base compartida');
        texto += s.data().texto || '';
      }
      await BD.reemplazarTabla(t, texto ? JSON.parse(texto) : []);
      huellas[t] = info.huella; cambiadas.push(t);
    }
  } finally { aplicando = false; }
  version = Math.max(version, man.version || 0);
  estado.autor = man.autor_nombre || ''; estado.fecha = man.fecha || '';
  return cambiadas;
}

/* Al abrir: trae lo compartido antes de que la app lea la base local. */
export async function alAbrir() {
  if (!db) return false;
  for (const t of tablasSincronizadas()) huellas[t] = huella(await BD.todos(t));
  let man = null;
  try { man = await leerManifiesto(); } catch (e) { avisarEstado('error', 'Base compartida no disponible: se trabaja en este navegador'); db = null; return false; }
  if (!man) return false;                          // primera vez: se sube lo local tras iniciar
  await bajar(man);
  return true;
}

/* Primera publicación: sube todo lo local. Luego escucha cambios locales y remotos. */
export async function activar(alRemoto, nombreUsuario) {
  if (!db) return;
  activar.nombre = nombreUsuario; alRemotoFn = alRemoto;
  let man = null; try { man = await leerManifiesto(); } catch (e) { /* se reintenta al guardar */ }
  if (!man) { tablasSincronizadas().forEach(t => sucias.add(t)); await subir(true); }
  else avisarEstado('ok', 'Guardado en la nube del artefacto');
  BD.observar(t => { if (aplicando || !db || soloLectura) return; sucias.add(t); programar(); });
  db.doc('cmms/manifiesto').onSnapshot(async s => {
    if (!s.exists || s.metadata.hasPendingWrites) return;
    const man = s.data();
    if (man.cliente === cliente) return;
    await (subiendo || Promise.resolve());
    if (!Object.entries(man.tablas || {}).some(([t, i]) => huellas[t] !== i.huella && !sucias.has(t))) return;
    avisarEstado('bajando', 'Actualizando con los cambios de ' + (man.autor_nombre || 'otro usuario') + '…');
    try {
      const cambiadas = await bajar(man, sucias);
      avisarEstado('ok', 'Guardado en la nube del artefacto');
      if (cambiadas.length) await alRemoto(cambiadas, man);
    } catch (e) { console.error(e); avisarEstado('error', 'No se pudieron traer los cambios compartidos; recargue la página'); }
  }, e => { console.error(e); if (e.code === 'revoked') { db = null; avisarEstado('error', 'Acceso a la base compartida retirado'); } });
}

function programar() {
  avisarEstado('pendiente', 'Cambios por guardar…');
  clearTimeout(temporizador); temporizador = setTimeout(() => { subir(false); }, PAUSA);
}

/* Sube las tablas sucias, trozo por trozo, y al final el manifiesto (así nadie lee un estado a medias). */
async function subir(inicial) {
  if (!db || !sucias.size) return;
  if (subiendo) { await subiendo; return subir(inicial); }
  const lista = Array.from(sucias); sucias = new Set();
  subiendo = (async () => {
    avisarEstado('guardando', 'Guardando en la nube…');
    try {
      let man = null; try { man = await leerManifiesto(); } catch (e) { /* sin manifiesto aún */ }
      /* Primero se trae lo que otro usuario guardó en tablas que aquí no cambiaron. */
      const remotas = man && !inicial ? await bajar(man, new Set(lista.concat(Array.from(sucias)))) : [];
      const tablas = Object.assign({}, man ? man.tablas : {});
      for (const t of lista) {
        const filas = await BD.todos(t), texto = JSON.stringify(filas), h = h32(texto) + '.' + texto.length;
        if (!inicial && tablas[t] && tablas[t].huella === h) { huellas[t] = h; continue; }
        const partes = partir(texto);
        for (let i = 0; i < partes.length; i++) await db.doc('tablas/' + idTrozo(t, i)).set({ tabla: t, parte: i, texto: partes[i] });
        const antes = tablas[t] ? tablas[t].partes : 0;
        for (let i = partes.length; i < antes; i++) await db.doc('tablas/' + idTrozo(t, i)).delete();
        tablas[t] = { partes: partes.length, huella: h, filas: filas.length };
        huellas[t] = h;
      }
      version = Math.max(version, man ? man.version || 0 : 0) + 1;
      const fecha = new Date().toISOString();
      await db.doc('cmms/manifiesto').set({ version, cliente, autor_nombre: activar.nombre ? activar.nombre() : '', fecha, tablas });
      estado.autor = activar.nombre ? activar.nombre() : ''; estado.fecha = fecha;
      avisarEstado('ok', 'Guardado en la nube del artefacto');
      if (remotas.length && alRemotoFn) await alRemotoFn(remotas, man);
    } catch (e) {
      console.error(e);
      lista.forEach(t => sucias.add(t));
      if (e && e.code === 'invalid_argument') { soloLectura = true; avisarEstado('lectura', 'Solo lectura: su acceso al artefacto no permite guardar'); }
      else if (e && e.code === 'quota_exceeded') avisarEstado('error', 'La base compartida está llena: depure respaldos o bitácora');
      else { avisarEstado('error', 'No se pudo guardar en la nube; se reintentará'); clearTimeout(temporizador); temporizador = setTimeout(() => subir(false), 15000); }
    }
  })();
  try { await subiendo; } finally { subiendo = null; }
}

/* Guarda de inmediato lo pendiente (p. ej., antes de salir). */
export function guardarYa() { if (db && sucias.size) { clearTimeout(temporizador); return subir(false); } return Promise.resolve(); }
