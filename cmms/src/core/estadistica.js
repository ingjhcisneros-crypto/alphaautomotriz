/* Estadística para la simulación: generador con semilla, ajuste de distribuciones por máxima verosimilitud,
   prueba de Kolmogorov-Smirnov, intervalos de confianza y pruebas t. Sin dependencias. */

/* Generador sfc32 con semilla: reproducible y rápido. */
export function rng(semilla) {
  let a = 0x9E3779B9 ^ semilla, b = 0x243F6A88 ^ (semilla * 31), c = 0xB7E15162 ^ (semilla * 131), d = semilla | 0;
  const f = () => { a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0; return (t >>> 0) / 4294967296; };
  for (let i = 0; i < 20; i++) f();
  let extra = null;
  f.normal = () => { if (extra != null) { const e = extra; extra = null; return e; } let u = 0, v = 0; while (u === 0) u = f(); v = f(); const r = Math.sqrt(-2 * Math.log(u)); extra = r * Math.sin(2 * Math.PI * v); return r * Math.cos(2 * Math.PI * v); };
  return f;
}

export const media = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
export function desv(a) { if (a.length < 2) return 0; const m = media(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); }

/* Funciones especiales. */
function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015;
  for (let j = 0; j < 6; j++) s += c[j] / ++y;
  return -t + Math.log(2.5066282746310005 * s / x);
}
function gammaP(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) { let ap = a, s = 1 / a, d = s; for (let n = 0; n < 500; n++) { ap++; d *= x / ap; s += d; if (Math.abs(d) < Math.abs(s) * 1e-12) break; } return s * Math.exp(-x + a * Math.log(x) - lgamma(a)); }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break; }
  return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}
function erf(x) { const t = 1 / (1 + 0.5 * Math.abs(x)); const y = 1 - t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? y : -y; }
const phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
function betacf(a, b, x) {
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-300) d = 1e-300; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}
function betaI(a, b, x) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
/* Distribución t de Student: p bilateral y cuantil. */
export function tPbilateral(t, gl) { return betaI(gl / 2, 0.5, gl / (gl + t * t)); }
export function tCuantil(p, gl) {
  let lo = 0, hi = 1000;
  const obj = 2 * (1 - p);
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (tPbilateral(m, gl) > obj) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

/* Intervalo de confianza de la media. */
export function intervalo(a, confianza = 0.95) {
  const n = a.length, m = media(a), s = desv(a);
  if (n < 2) return { n, media: m, desv: 0, semiancho: 0, li: m, ls: m };
  const t = tCuantil(1 - (1 - confianza) / 2, n - 1), h = t * s / Math.sqrt(n);
  return { n, media: m, desv: s, semiancho: h, li: m - h, ls: m + h };
}
/* Prueba t pareada (réplicas con números aleatorios comunes) o de Welch si los tamaños difieren. */
export function pruebaDiferencia(a, b, confianza = 0.95) {
  if (a.length === b.length && a.length > 1) {
    const d = a.map((x, i) => x - b[i]), ic = intervalo(d, confianza);
    const t = ic.desv > 0 ? ic.media / (ic.desv / Math.sqrt(d.length)) : (ic.media === 0 ? 0 : Infinity);
    const p = isFinite(t) ? tPbilateral(Math.abs(t), d.length - 1) : 0;
    return { metodo: 't pareada', delta: ic.media, li: ic.li, ls: ic.ls, t, p, significativa: p < 1 - confianza };
  }
  const ma = media(a), mb = media(b), va = desv(a) ** 2 / a.length, vb = desv(b) ** 2 / b.length;
  const t = (ma - mb) / Math.sqrt(va + vb || 1e-12), gl = (va + vb) ** 2 / ((va * va) / (a.length - 1) + (vb * vb) / (b.length - 1) || 1);
  const p = tPbilateral(Math.abs(t), gl), q = tCuantil(1 - (1 - confianza) / 2, gl) * Math.sqrt(va + vb);
  return { metodo: 't de Welch', delta: ma - mb, li: ma - mb - q, ls: ma - mb + q, t, p, significativa: p < 1 - confianza };
}

/* ===== Distribuciones: ajuste, CDF, media y muestreo ===== */
export const DISTRIBUCIONES = {
  exponencial: {
    ajustar: x => ({ media: media(x) }),
    cdf: (p, v) => v <= 0 ? 0 : 1 - Math.exp(-v / p.media),
    media: p => p.media,
    escalar: (p, m) => ({ media: m }),
    muestra: (p, r) => -p.media * Math.log(1 - r()),
    texto: p => 'media ' + p.media.toFixed(3)
  },
  weibull: {
    ajustar: x => {
      const lx = x.map(Math.log), n = x.length; let k = 1.2 / (desv(lx) || 1);
      for (let i = 0; i < 100; i++) {
        let s0 = 0, s1 = 0, s2 = 0; x.forEach((v, j) => { const w = Math.pow(v, k); s0 += w; s1 += w * lx[j]; s2 += w * lx[j] * lx[j]; });
        const f = s1 / s0 - 1 / k - media(lx), df = (s2 / s0 - (s1 / s0) ** 2) + 1 / (k * k);
        const nk = k - f / df; if (!isFinite(nk) || nk <= 0) break; if (Math.abs(nk - k) < 1e-9) { k = nk; break; } k = nk;
      }
      const lam = Math.pow(x.reduce((s, v) => s + Math.pow(v, k), 0) / n, 1 / k);
      return { forma: k, escala: lam };
    },
    cdf: (p, v) => v <= 0 ? 0 : 1 - Math.exp(-Math.pow(v / p.escala, p.forma)),
    media: p => p.escala * Math.exp(lgamma(1 + 1 / p.forma)),
    escalar: (p, m) => ({ forma: p.forma, escala: m / Math.exp(lgamma(1 + 1 / p.forma)) }),
    muestra: (p, r) => p.escala * Math.pow(-Math.log(1 - r()), 1 / p.forma),
    texto: p => 'forma ' + p.forma.toFixed(3) + ', escala ' + p.escala.toFixed(3)
  },
  lognormal: {
    ajustar: x => { const l = x.map(Math.log); return { mu: media(l), sigma: Math.sqrt(l.reduce((s, v) => s + (v - media(l)) ** 2, 0) / l.length) || 1e-6 }; },
    cdf: (p, v) => v <= 0 ? 0 : phi((Math.log(v) - p.mu) / p.sigma),
    media: p => Math.exp(p.mu + p.sigma * p.sigma / 2),
    escalar: (p, m) => ({ mu: Math.log(m) - p.sigma * p.sigma / 2, sigma: p.sigma }),
    muestra: (p, r) => Math.exp(p.mu + p.sigma * r.normal()),
    texto: p => 'μ ' + p.mu.toFixed(3) + ', σ ' + p.sigma.toFixed(3)
  },
  gamma: {
    ajustar: x => {
      const m = media(x), s = Math.log(m) - media(x.map(Math.log));
      if (!(s > 1e-12)) throw new Error('muestra sin variabilidad');
      let k = (3 - s + Math.sqrt((s - 3) ** 2 + 24 * s)) / (12 * s);
      for (let i = 0; i < 50; i++) { const dg = digamma(k), tg = trigamma(k); const nk = k - (Math.log(k) - dg - s) / (1 / k - tg); if (!isFinite(nk) || nk <= 0) break; if (Math.abs(nk - k) < 1e-10) { k = nk; break; } k = nk; }
      return { forma: k, escala: m / k };
    },
    cdf: (p, v) => v <= 0 ? 0 : gammaP(p.forma, v / p.escala),
    media: p => p.forma * p.escala,
    escalar: (p, m) => ({ forma: p.forma, escala: m / p.forma }),
    muestra: (p, r) => muestraGamma(p.forma, r) * p.escala,
    texto: p => 'forma ' + p.forma.toFixed(3) + ', escala ' + p.escala.toFixed(3)
  },
  triangular: {
    ajustar: x => { const a = Math.min(...x), b = Math.max(...x); let c = 3 * media(x) - a - b; c = Math.max(a, Math.min(b, c)); return { min: a, moda: c, max: b === a ? a + 1e-6 : b }; },
    cdf: (p, v) => { const { min: a, moda: c, max: b } = p; if (v <= a) return 0; if (v >= b) return 1; return v <= c ? (v - a) ** 2 / ((b - a) * (c - a || 1e-12)) : 1 - (b - v) ** 2 / ((b - a) * (b - c || 1e-12)); },
    media: p => (p.min + p.moda + p.max) / 3,
    escalar: (p, m) => { const f = m / ((p.min + p.moda + p.max) / 3 || 1); return { min: p.min * f, moda: p.moda * f, max: p.max * f }; },
    muestra: (p, r) => { const { min: a, moda: c, max: b } = p, u = r(), F = (c - a) / (b - a || 1); return u < F ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c)); },
    texto: p => 'mín ' + p.min.toFixed(3) + ', moda ' + p.moda.toFixed(3) + ', máx ' + p.max.toFixed(3)
  },
  empirica: {
    ajustar: x => ({ valores: x.slice().sort((a, b) => a - b) }),
    cdf: (p, v) => { let k = 0; while (k < p.valores.length && p.valores[k] <= v) k++; return k / p.valores.length; },
    media: p => media(p.valores),
    escalar: (p, m) => { const f = m / (media(p.valores) || 1); return { valores: p.valores.map(v => v * f) }; },
    muestra: (p, r) => p.valores[Math.floor(r() * p.valores.length)],
    texto: p => p.valores.length + ' valores observados'
  },
  deterministica: {
    ajustar: x => ({ valor: media(x) }),
    cdf: (p, v) => v >= p.valor ? 1 : 0,
    media: p => p.valor,
    escalar: (p, m) => ({ valor: m }),
    muestra: p => p.valor,
    texto: p => 'constante ' + p.valor.toFixed(3)
  }
};
function digamma(x) { let r = 0; while (x < 6) { r -= 1 / x; x++; } const f = 1 / (x * x); return r + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f * (1 / 252 - f * (1 / 240 - f / 132)))); }
function trigamma(x) { let r = 0; while (x < 6) { r += 1 / (x * x); x++; } const f = 1 / (x * x); return r + 1 / x + f / 2 + f / x * (1 / 6 - f * (1 / 30 - f * (1 / 42 - f / 30))); }
function muestraGamma(k, r) {
  if (k < 1) return muestraGamma(k + 1, r) * Math.pow(r(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (let it = 0; it < 1000; it++) { let x, v; do { x = r.normal(); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = r(); if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; }
  return k;
}

/* Estadístico D de Kolmogorov-Smirnov y p-valor asintótico (corrección de Stephens). */
export function ks(x, cdf) {
  const s = x.slice().sort((a, b) => a - b), n = s.length; let D = 0;
  s.forEach((v, i) => { const F = cdf(v); D = Math.max(D, Math.abs((i + 1) / n - F), Math.abs(F - i / n)); });
  const l = (Math.sqrt(n) + 0.12 + 0.11 / Math.sqrt(n)) * D;
  let p = 0; for (let j = 1; j <= 100; j++) p += 2 * Math.pow(-1, j - 1) * Math.exp(-2 * j * j * l * l);
  return { D, p: Math.max(0, Math.min(1, n ? p : 1)) };
}

/* Ajusta los candidatos y elige el de menor D (mayor p). Con muestra insuficiente no ajusta. */
export function ajustar(x, candidatos, opciones) {
  const o = Object.assign({ minimo: 30 }, opciones || {});
  const datos = x.filter(v => v > 0 && isFinite(v));
  if (datos.length < o.minimo) return null;
  if (desv(datos) <= 1e-9 * Math.max(1, media(datos))) {
    const det = { tipo: 'deterministica', params: { valor: media(datos) }, ks: 0, p: 1, texto: 'constante ' + media(datos).toFixed(3) + ' (sin variabilidad)' };
    return { n: datos.length, mediaMuestral: media(datos), mejor: det, candidatos: [det] };
  }
  const res = candidatos.map(nombre => {
    try {
      const D = DISTRIBUCIONES[nombre], p = D.ajustar(datos);
      if (Object.values(p).some(v => typeof v === 'number' && !isFinite(v))) return null;
      const t = ks(datos, v => D.cdf(p, v));
      return { tipo: nombre, params: p, ks: t.D, p: t.p, texto: D.texto(p) };
    } catch (e) { return null; }
  }).filter(Boolean).sort((a, b) => a.ks - b.ks);
  return { n: datos.length, mediaMuestral: media(datos), mejor: res[0], candidatos: res };
}

export function muestrear(dist, r) { return Math.max(0, DISTRIBUCIONES[dist.tipo].muestra(dist.params, r)); }
export function mediaDist(dist) { return DISTRIBUCIONES[dist.tipo].media(dist.params); }
export function escalarDist(dist, m) { return { tipo: dist.tipo, params: DISTRIBUCIONES[dist.tipo].escalar(dist.params, m) }; }
