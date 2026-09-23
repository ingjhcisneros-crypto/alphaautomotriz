/* Utilidades puras, sin DOM. */

export const suma = (a, f = x => x) => a.reduce((s, x) => s + (+f(x) || 0), 0);
export const r1 = v => Math.round((+v || 0) * 10) / 10;
export const r2 = v => Math.round((+v || 0) * 100) / 100;
export const r4 = v => Math.round((+v || 0) * 10000) / 10000;
export const pct = v => r2((+v || 0) * 100);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const agrupar = (a, f) => a.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
export const unico = a => Array.from(new Set(a));
export const copia = o => JSON.parse(JSON.stringify(o));

/* Normaliza texto para comparar catálogos sin distinguir mayúsculas ni espacios extremos. */
export const norm = s => String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
export const normCmp = s => norm(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* Huella estable (FNV-1a) para detectar cambios de datos o de parámetros. */
export function huella(obj) {
  const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
