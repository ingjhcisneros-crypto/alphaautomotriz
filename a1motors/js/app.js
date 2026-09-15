/* ═══════════════════════════════════════════════════════════════════
   A1 MOTORS PERÚ — Lógica del sitio
   js/app.js

   Regla de oro de este archivo:
   ──────────────────────────────────────────────────────────────────
   El contenido del sitio vive SIEMPRE en el servidor. El navegador
   no guarda nada propio: ni imágenes, ni números, ni enlaces.
   Por eso lo que cambias en el panel lo ve todo el mundo, y por eso
   un cambio sólo se da por bueno cuando el servidor lo confirma al
   volver a leerlo. Si algo falla, se dice en voz alta.
═══════════════════════════════════════════════════════════════════ */
'use strict';

/* ══════════════════════════════════════════════════════════════════
   1 · ESTADO Y UTILIDADES
══════════════════════════════════════════════════════════════════ */

const API = 'admin/api.php';

const estado = {
  textos:   {},      // clave -> valor, tal cual está en el servidor
  imagenes: {},      // slot  -> { url, w, h }
  version:  null,    // sello que cambia con cada guardado
  csrf:     null,
  catalogo: null,
  sesion:   false,
};

/* Valores de emergencia: sólo se usan si el servidor no responde,
   para que la web nunca quede rota delante de un cliente. */
const RESPALDO = {
  wa_mecanica: '997319758',
  wa_pintura:  '959172262',
  wa_gnv:      '993210651',
  wa_saludo:   'Hola, vengo de la web de A1 Motors',
  url_ig:  'https://www.instagram.com/a1motorsperu/',
  url_fb:  'https://www.facebook.com/A1MotorsPeru',
  url_tt:  'https://www.tiktok.com/@a1motorsperu',
  url_map: 'https://share.google/3iEyquITbFgwXLkZI',
  cursor_estilo: 'precision',
  acento_color:  'cian',
};

const $  = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

const escapar = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/** Llama a la API y devuelve el JSON. Cualquier fallo llega como Error con texto legible. */
async function api(accion, opciones = {}) {
  const url = `${API}?a=${encodeURIComponent(accion)}&_=${Date.now()}`;
  let respuesta;
  try {
    respuesta = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...opciones });
  } catch (e) {
    throw new Error('No se pudo contactar con el servidor. Revisa tu conexión a internet.');
  }

  const crudo = await respuesta.text();
  let datos;
  try {
    datos = JSON.parse(crudo);
  } catch {
    // El servidor devolvió HTML: casi siempre un error de PHP o una ruta equivocada.
    if (respuesta.status === 404) {
      throw new Error('No se encuentra admin/api.php en el servidor. Comprueba que subiste la carpeta admin/.');
    }
    throw new Error(
      `El servidor respondió algo que no es JSON (HTTP ${respuesta.status}). ` +
      `Esto pasa cuando el hosting no ejecuta PHP o hay un error en admin/config.php. ` +
      `Abre admin/diagnostico.php para ver el detalle.`
    );
  }

  /* Estas acciones informan del fallo dentro del propio JSON (intentos
     restantes, campos rechazados…). Devolverlas tal cual permite a la
     interfaz reaccionar con detalle en vez de con un error genérico. */
  const FALLO_ESTRUCTURADO = new Set(['entrar', 'guardar']);
  if (FALLO_ESTRUCTURADO.has(accion)) return datos;

  if (datos.ok === false && datos.error) throw new Error(datos.error);
  if (!respuesta.ok) throw new Error(`El servidor respondió con un error (HTTP ${respuesta.status}).`);
  return datos;
}

const apiJSON = (accion, cuerpo) => api(accion, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ csrf: estado.csrf, ...cuerpo }),
});

/* Imagen de relleno cuando un hueco todavía no tiene archivo */
function relleno(texto = '') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300">
    <rect width="100%" height="100%" fill="#0f1418"/>
    <text x="50%" y="48%" fill="#33ceff" fill-opacity=".28" font-family="sans-serif"
          font-size="46" text-anchor="middle">&#128247;</text>
    <text x="50%" y="66%" fill="#7aaccb" fill-opacity=".5" font-family="sans-serif"
          font-size="15" text-anchor="middle">${escapar(texto)}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* ══════════════════════════════════════════════════════════════════
   2 · APLICAR EL CONTENIDO DEL SERVIDOR A LA PÁGINA
══════════════════════════════════════════════════════════════════ */

/* Qué hacer cuando una imagen no llega a cargar */
function alFallarImagen(el, slot) {
  if (el.dataset.alterno) {              // el logo cae al texto "A1 MOTORS"
    el.hidden = true;
    const alterno = document.getElementById(el.dataset.alterno);
    if (alterno) alterno.hidden = false;
    return;
  }
  el.src = relleno(slot);
  el.classList.add('sin-archivo');
}

function aplicarImagenes() {
  $$('[data-img]').forEach((el) => {
    const slot  = el.dataset.img;
    const attr  = el.dataset.attr || 'src';
    const ficha = estado.imagenes[slot];

    /* 1 · Lo normal: la imagen registrada en la base de datos. */
    if (ficha) {
      if (el.getAttribute(attr) !== ficha.url) el.setAttribute(attr, ficha.url);
      el.classList.remove('sin-archivo');
      el.hidden = false;
      return;
    }

    if (attr !== 'src') return;          // el favicon conserva su valor del HTML

    /* 2 · Sin registro: se prueba el archivo suelto de la carpeta, por si
       se subió por FTP sin pasar por el panel. Una sola vez por imagen. */
    if (el.dataset.intentado) return;
    el.dataset.intentado = '1';

    const respaldo = el.dataset.respaldo;
    if (!respaldo) { alFallarImagen(el, slot); return; }

    el.addEventListener('error', () => alFallarImagen(el, slot), { once: true });
    el.src = respaldo;
  });
}

function aplicarTextos() {
  $$('[data-txt]').forEach((el) => {
    const clave = el.dataset.txt;
    if (!(clave in estado.textos)) return;
    const valor = estado.textos[clave];
    el.textContent = valor;
    /* Un nombre vacío no debe dejar un hueco raro bajo el logo */
    if (el.classList.contains('empresa-nombre') || el.classList.contains('marca-nombre')) {
      el.style.display = valor.trim() ? '' : 'none';
    }
  });
}

function aplicarEnlaces() {
  const mapa = { ig: 'url_ig', fb: 'url_fb', tt: 'url_tt', map: 'url_map' };
  $$('[data-red]').forEach((el) => {
    const url = texto(mapa[el.dataset.red]);
    if (url) {
      el.href = url;
      el.style.display = '';
    } else {
      el.style.display = 'none';          // sin URL configurada, se oculta
    }
  });
  const mapaContacto = $('#mapaContacto');
  if (mapaContacto) mapaContacto.href = texto('url_map') || '#';
}

function aplicarApariencia() {
  document.body.dataset.cursor = texto('cursor_estilo') || 'precision';
  document.documentElement.dataset.acento = texto('acento_color') || 'cian';
}

/** Valor de un texto, con respaldo si el servidor no contestó. */
function texto(clave) {
  const v = estado.textos[clave];
  if (v !== undefined && v !== null && v !== '') return v;
  if (v === '') return '';                      // vacío a propósito
  return RESPALDO[clave] ?? '';
}

function aplicarTodo() {
  aplicarImagenes();
  aplicarTextos();
  aplicarEnlaces();
  aplicarApariencia();
}

/** Trae el contenido del servidor. Devuelve true si lo consiguió. */
async function cargarContenido({ silencioso = false } = {}) {
  try {
    const d = await api('contenido');
    estado.textos   = d.textos   || {};
    estado.imagenes = d.imagenes || {};
    estado.version  = d.version;
    estado.sesion   = !!d.sesion;
    aplicarTodo();
    ocultarAlertaServidor();
    return true;
  } catch (e) {
    console.error('[A1 Motors] No se pudo cargar el contenido:', e.message);
    /* La web sigue viéndose con los valores de respaldo, pero quien
       administra tiene que enterarse de que nada se está guardando. */
    if (!silencioso) mostrarAlertaServidor(e.message);
    estado.textos = { ...RESPALDO, ...estado.textos };
    aplicarTodo();
    return false;
  }
}

function mostrarAlertaServidor(mensaje) {
  const caja = $('#alertaServidor');
  if (!caja) return;
  /* Sólo para quien administra: un cliente no debe ver avisos técnicos.
     La marca se pone al entrar al panel y dura lo que la pestaña. */
  let esAdmin = false;
  try { esAdmin = sessionStorage.getItem('a1_panel') === '1'; } catch { /* modo privado */ }
  if (!esAdmin && !estado.sesion) return;
  $('#alertaServidorTexto').textContent =
    mensaje + ' Mientras tanto se muestran los valores de respaldo y los cambios del panel NO se guardarán.';
  caja.classList.add('visible');
}
function ocultarAlertaServidor() { $('#alertaServidor')?.classList.remove('visible'); }

/* ══════════════════════════════════════════════════════════════════
   3 · WHATSAPP
══════════════════════════════════════════════════════════════════ */

const ETIQUETA_AREA = {
  mecanica: 'Mecánica General',
  pintura:  'Planchado y Pintura',
  gnv:      'Conversiones GNV / GLP',
};

/** Número completo con prefijo de Perú, listo para wa.me */
function numeroWA(area) {
  const n = String(texto('wa_' + area) || '').replace(/\D/g, '');
  return n.length === 9 ? '51' + n : n;
}

function abrirWA(area, mensaje) {
  const numero = numeroWA(area);
  if (!numero) {
    alert('Todavía no se ha configurado el número de WhatsApp de esta área.');
    return;
  }
  const encabezado = `🌐 *${texto('wa_saludo')}*\n\n`;
  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(encabezado + mensaje)}`, '_blank', 'noopener');
}

const consultaArea = (area) =>
  abrirWA(area, `Necesito información sobre *${ETIQUETA_AREA[area]}*.`);

const solicitarOferta = (area) =>
  abrirWA(area, `Vi la oferta de *${ETIQUETA_AREA[area]}* en su página web y me gustaría más información.\n` +
                `¿Podría indicarme los detalles y la disponibilidad?`);

/* ══════════════════════════════════════════════════════════════════
   4 · INTERFAZ
══════════════════════════════════════════════════════════════════ */

function iniciarCursor() {
  const punto  = $('#cursor');
  const estela = $('#cursorEstela');
  if (!punto || !estela) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  let x = -100, y = -100, ex = -100, ey = -100, animando = false;

  const mover = () => {
    ex += (x - ex) * 0.18;
    ey += (y - ey) * 0.18;
    estela.style.transform = `translate(${ex}px, ${ey}px)`;
    if (Math.abs(x - ex) > 0.1 || Math.abs(y - ey) > 0.1) {
      requestAnimationFrame(mover);
    } else { animando = false; }
  };

  document.addEventListener('mousemove', (e) => {
    x = e.clientX; y = e.clientY;
    punto.style.transform = `translate(${x}px, ${y}px)`;
    if (!animando) { animando = true; requestAnimationFrame(mover); }
  }, { passive: true });

  const interactivo = 'a, button, input, select, textarea, label, [role="button"], .promo, .svc, .sis-nodo';
  document.addEventListener('mouseover', (e) => {
    const activo = e.target.closest?.(interactivo);
    punto.classList.toggle('activo', !!activo);
    estela.classList.toggle('activo', !!activo);
  });
  document.addEventListener('mouseleave', () => {
    punto.style.opacity = '0'; estela.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    punto.style.opacity = '1'; estela.style.opacity = '1';
  });
}

function iniciarCabecera() {
  const cabecera = $('#cabecera');
  const arriba   = $('#botonArriba');
  const enlaces  = $$('.nav-enlaces a');
  const secciones = enlaces
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  const alDesplazar = () => {
    const y = window.scrollY;
    cabecera?.classList.toggle('compacta', y > 40);
    arriba?.classList.toggle('visible', y > 600);

    let actual = null;
    for (const sec of secciones) {
      if (sec.getBoundingClientRect().top <= 140) actual = sec.id;
    }
    enlaces.forEach((a) => a.classList.toggle('activo', a.getAttribute('href') === '#' + actual));
  };

  window.addEventListener('scroll', alDesplazar, { passive: true });
  alDesplazar();
  arriba?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function iniciarMenuMovil() {
  const menu   = $('#navMovil');
  const abrir  = $('#menuBtn');
  const cerrar = $('#menuCerrar');
  if (!menu || !abrir) return;

  const alternar = (visible) => {
    menu.classList.toggle('abierto', visible);
    abrir.setAttribute('aria-expanded', String(visible));
    document.body.style.overflow = visible ? 'hidden' : '';
  };
  abrir.addEventListener('click', () => alternar(true));
  cerrar?.addEventListener('click', () => alternar(false));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => alternar(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') alternar(false); });
}

function iniciarRevelado() {
  const objetivos = $$('.revelar');
  if (!('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    objetivos.forEach((el) => el.classList.add('visible'));
    return;
  }
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada, i) => {
      if (!entrada.isIntersecting) return;
      setTimeout(() => entrada.target.classList.add('visible'), i * 70);
      observador.unobserve(entrada.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  objetivos.forEach((el) => observador.observe(el));
}

function iniciarCarruselMarcas() {
  const pista = $('#marcasPista');
  if (!pista) return;
  /* Se duplica el juego de marcas para que el desplazamiento infinito
     no muestre un corte al reiniciar la animación. */
  pista.querySelectorAll('.marca').forEach((m) => {
    const copia = m.cloneNode(true);
    copia.setAttribute('aria-hidden', 'true');
    pista.appendChild(copia);
  });
}

function abrirModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('abierto');
  document.body.style.overflow = 'hidden';
  m.querySelector('button')?.focus();
}
function cerrarModal(m) {
  (typeof m === 'string' ? document.getElementById(m) : m)?.classList.remove('abierto');
  if (!$('.modal.abierto') && !$('.visor.abierto') && !$('.nav-movil.abierto')) {
    document.body.style.overflow = '';
  }
}

function iniciarModales() {
  $$('[data-cerrar-modal]').forEach((b) =>
    b.addEventListener('click', () => cerrarModal(b.closest('.modal'))));

  $$('.modal').forEach((m) =>
    m.addEventListener('click', (e) => { if (e.target === m) cerrarModal(m); }));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    $$('.modal.abierto').forEach(cerrarModal);
    cerrarVisor();
  });

  $('#botonWA')?.addEventListener('click', () => abrirModal('modalWA'));
  $$('[data-area]').forEach((b) => b.addEventListener('click', () => {
    consultaArea(b.dataset.area);
    cerrarModal('modalWA');
  }));
  $$('[data-oferta]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    solicitarOferta(b.dataset.oferta);
  }));
}

function iniciarRedesFlotantes() {
  const btn   = $('#redesBtn');
  const menu  = $('#redesMenu');
  const icono = $('#redesIcono');
  if (!btn || !menu) return;

  const alternar = (visible) => {
    menu.classList.toggle('abierto', visible);
    btn.classList.toggle('abierto', visible);
    btn.setAttribute('aria-expanded', String(visible));
    if (icono) icono.className = visible ? 'fas fa-times' : 'fas fa-share-alt';
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    alternar(!menu.classList.contains('abierto'));
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.redes-flot')) alternar(false);
  });
}

/* — Visor de promociones — */
let visorArea = 'mecanica';

function abrirVisor(figura) {
  const img = figura.querySelector('img');
  if (!img || img.classList.contains('sin-archivo')) return;
  visorArea = figura.querySelector('[data-oferta]')?.dataset.oferta || 'mecanica';
  $('#visorImg').src = img.currentSrc || img.src;
  $('#visor').classList.add('abierto');
  document.body.style.overflow = 'hidden';
  $('#visorCerrar')?.focus();
}
function cerrarVisor() {
  const v = $('#visor');
  if (!v?.classList.contains('abierto')) return;
  v.classList.remove('abierto');
  if (!$('.modal.abierto')) document.body.style.overflow = '';
}

function iniciarVisor() {
  $$('[data-visor]').forEach((fig) => {
    fig.addEventListener('click', (e) => {
      if (e.target.closest('.promo-wa')) return;   // el botón de WhatsApp manda
      abrirVisor(fig);
    });
    fig.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirVisor(fig); }
    });
  });
  $('#visorCerrar')?.addEventListener('click', cerrarVisor);
  $('#visor')?.addEventListener('click', (e) => { if (e.target.id === 'visor') cerrarVisor(); });
  $('#visorWA')?.addEventListener('click', () => { solicitarOferta(visorArea); cerrarVisor(); });
}

/* — Formulario de cita — */
function iniciarFormulario() {
  const form = $('#formCita');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const aviso    = $('#formAviso');
    const nombre   = $('#f-nombre').value.trim();
    const servicio = $('#f-servicio').value;

    if (!nombre || !servicio) {
      aviso.textContent = 'Completa al menos tu nombre y el servicio que necesitas.';
      aviso.classList.add('visible');
      (!nombre ? $('#f-nombre') : $('#f-servicio')).focus();
      return;
    }
    aviso.classList.remove('visible');
    $('#formResumen').textContent = servicio;
    abrirModal('modalForm');
  });

  $$('[data-area-form]').forEach((b) => b.addEventListener('click', () => {
    const d = {
      nombre:   $('#f-nombre').value.trim(),
      modelo:   $('#f-modelo').value.trim(),
      placa:    $('#f-placa').value.trim().toUpperCase(),
      servicio: $('#f-servicio').value,
      desc:     $('#f-desc').value.trim(),
    };
    const mensaje =
      `📋 *Solicitud de servicio*\n\n` +
      `👤 *Nombre:* ${d.nombre}\n` +
      (d.modelo ? `🚘 *Vehículo:* ${d.modelo}\n` : '') +
      (d.placa  ? `🔖 *Placa:* ${d.placa}\n`     : '') +
      `🔧 *Servicio:* ${d.servicio}` +
      (d.desc   ? `\n📝 *Detalle:* ${d.desc}`    : '');
    abrirWA(b.dataset.areaForm, mensaje);
    cerrarModal('modalForm');
  }));
}

/* ══════════════════════════════════════════════════════════════════
   5 · REFRESCO AUTOMÁTICO
   Si alguien guarda desde el panel, el resto de pestañas abiertas
   se actualizan solas: comparamos el sello de versión del servidor.
   No hace falta recargar la página ni en computadora ni en celular.
══════════════════════════════════════════════════════════════════ */

/* Cada cuánto se pregunta al servidor si hubo cambios (milisegundos).
   La respuesta es diminuta, así que 30 s no pesa nada. */
const INTERVALO_REFRESCO = 30000;

function iniciarRefresco() {
  let fallos = 0;

  const comprobar = async () => {
    if (document.hidden) return;
    if ($('#adminCapa')?.classList.contains('abierta')) return;   // no molestar mientras se edita
    try {
      const d = await api('contenido');
      fallos = 0;
      if (d.version !== estado.version) {
        estado.textos   = d.textos   || {};
        estado.imagenes = d.imagenes || {};
        estado.version  = d.version;
        aplicarTodo();
      }
    } catch {
      fallos++;   // en silencio: el visitante no tiene por qué ver esto
    }
  };

  setInterval(comprobar, INTERVALO_REFRESCO);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) comprobar(); });
}

/* ══════════════════════════════════════════════════════════════════
   6 · PANEL ADMINISTRATIVO
   El panel se dibuja a partir del catálogo que envía el servidor.
   Nada está escrito a mano dos veces, así que no puede desajustarse.
══════════════════════════════════════════════════════════════════ */

const admin = {
  cambiosTexto:   {},   // clave -> valor nuevo pendiente de guardar
  archivos:       {},   // slot  -> File pendiente de subir
  quitar:         {},   // slot  -> true (imagen a eliminar)
  vistasPrevias:  {},   // slot  -> dataURL, sólo para la vista previa
};

function adminHayCambios() {
  return Object.keys(admin.cambiosTexto).length +
         Object.keys(admin.archivos).length +
         Object.keys(admin.quitar).length;
}

function adminActualizarContador() {
  const n = adminHayCambios();
  const el = $('#adminPendientes');
  if (!el) return;
  el.innerHTML = n
    ? `Tienes <strong>${n}</strong> cambio(s) sin guardar.`
    : 'Sin cambios pendientes.';
  const btn = $('#adminGuardar');
  if (btn) btn.disabled = n === 0;
}

function adminLimpiarCambios() {
  admin.cambiosTexto = {};
  admin.archivos = {};
  admin.quitar = {};
  admin.vistasPrevias = {};
  adminActualizarContador();
}

function avisar(id, texto, tipo = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `aviso ${tipo} visible`;
  el.innerHTML = texto;
}
function limpiarAviso(id) { document.getElementById(id)?.classList.remove('visible'); }

/* ── Acceso ─────────────────────────────────────────────────────── */

function abrirPanel() {
  $('#adminCapa').classList.add('abierta');
  $('#adminAcceso').style.display = 'flex';
  $('#adminTablero').classList.remove('visible');
  $('#adminClave').value = '';
  limpiarAviso('adminAvisoAcceso');
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('#adminClave').focus(), 60);
}

function cerrarPanel() {
  $('#adminCapa').classList.remove('abierta');
  document.body.style.overflow = '';
}

function formatearEspera(segundos) {
  if (segundos >= 3600) return `${Math.ceil(segundos / 3600)} hora(s)`;
  if (segundos >= 60)   return `${Math.ceil(segundos / 60)} minuto(s)`;
  return `${segundos} segundo(s)`;
}

async function adminEntrar() {
  const clave = $('#adminClave').value;
  const btn   = $('#adminEntrar');
  if (!clave) { avisar('adminAvisoAcceso', 'Escribe la contraseña.'); return; }

  btn.disabled = true;
  btn.textContent = 'COMPROBANDO…';
  try {
    const r = await api('entrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave }),
    });

    if (r.ok) {
      estado.csrf   = r.csrf;
      estado.sesion = true;
      try { sessionStorage.setItem('a1_panel', '1'); } catch { /* modo privado */ }
      limpiarAviso('adminAvisoAcceso');
      $('#adminAcceso').style.display = 'none';
      $('#adminTablero').classList.add('visible');
      await adminCargarCatalogo();
      return;
    }

    if (r.bloqueado) {
      avisar('adminAvisoAcceso',
        `🔒 Acceso bloqueado por intentos fallidos. Vuelve a intentarlo en <strong>${formatearEspera(r.segundos)}</strong>.`);
      $('#adminIntentos').textContent = '';
    } else {
      avisar('adminAvisoAcceso', 'Contraseña incorrecta.');
      $('#adminIntentos').textContent =
        r.restantes > 0 ? `Intentos restantes antes del bloqueo: ${r.restantes}` : '';
    }
    $('#adminClave').value = '';
  } catch (e) {
    avisar('adminAvisoAcceso', escapar(e.message));
  } finally {
    btn.disabled = false;
    btn.textContent = 'INGRESAR';
  }
}

/* ── Construcción del panel ─────────────────────────────────────── */

async function adminCargarCatalogo() {
  const contenido = $('#adminContenido');
  contenido.innerHTML = '<div class="admin-cargando"><div class="girador"></div>Cargando el panel…</div>';

  try {
    const cat = await api('catalogo');
    estado.catalogo = cat;
    estado.csrf     = cat.csrf || estado.csrf;
    estado.imagenes = cat.actuales || {};
    estado.textos   = cat.valores  || {};
    adminLimpiarCambios();
    adminDibujar();
    $('#adminEstado').classList.remove('malo');
    $('#adminEstado').innerHTML = '<span class="punto"></span> Conectado a la base de datos';
  } catch (e) {
    contenido.innerHTML =
      `<div class="aviso error visible">
         <strong>No se pudo cargar el panel.</strong><br>${escapar(e.message)}<br><br>
         Abre <code>admin/diagnostico.php</code> para ver qué falta.
       </div>`;
    $('#adminEstado').classList.add('malo');
    $('#adminEstado').innerHTML = '<span class="punto"></span> Sin conexión con la base de datos';
  }
}

function adminDibujar() {
  const cat = estado.catalogo;

  const pestanas = [
    { id: 'imagenes',   nombre: 'Imágenes',   icono: 'fa-images' },
    { id: 'textos',     nombre: 'Textos y contactos', icono: 'fa-keyboard' },
    { id: 'apariencia', nombre: 'Apariencia', icono: 'fa-wand-magic-sparkles' },
    { id: 'seguridad',  nombre: 'Seguridad',  icono: 'fa-shield-halved' },
  ];

  $('#adminPestanas').innerHTML = pestanas.map((p, i) => `
    <button class="admin-pestana ${i === 0 ? 'activa' : ''}" role="tab" data-pestana="${p.id}">
      <i class="fas ${p.icono}"></i> ${p.nombre}
    </button>`).join('');

  $('#adminContenido').innerHTML = `
    <div class="admin-panel activo" data-panel="imagenes">${adminHTMLImagenes(cat)}</div>
    <div class="admin-panel" data-panel="textos">${adminHTMLTextos(cat)}</div>
    <div class="admin-panel" data-panel="apariencia">${adminHTMLApariencia(cat)}</div>
    <div class="admin-panel" data-panel="seguridad">${adminHTMLSeguridad()}</div>`;

  adminConectarEventos();
  adminActualizarContador();
}

function adminHTMLImagenes(cat) {
  const total = Object.values(cat.imagenes).reduce((n, g) => n + Object.keys(g.slots).length, 0);
  let html = `
    <div class="aviso info visible">
      <strong>Las ${total} imágenes del sitio se cambian desde aquí.</strong>
      Todas viven en la carpeta <code>imagenes/</code> del servidor, así que al guardarlas
      las ve todo el mundo. Formatos: PNG, JPG, WEBP o GIF · máximo ${cat.limite_mb} MB cada una.
    </div>`;

  for (const grupo of Object.values(cat.imagenes)) {
    html += `
      <div class="admin-tarjeta">
        <div class="admin-tarjeta-titulo"><i class="fas ${grupo.icono}"></i> ${escapar(grupo.titulo)}</div>
        ${grupo.nota ? `<div class="admin-tarjeta-nota">${escapar(grupo.nota)}</div>` : ''}
        <div class="admin-imagenes">
          ${Object.entries(grupo.slots).map(([slot, d]) => adminHTMLHueco(slot, d, cat)).join('')}
        </div>
      </div>`;
  }
  return html;
}

function adminHTMLHueco(slot, d, cat) {
  const actual = cat.actuales[slot];
  const vista  = actual
    ? `<img src="${escapar(actual.url)}" alt="">`
    : `<div class="vacio"><i class="fas fa-image"></i><span>Sin imagen</span></div>`;
  const info = actual ? `${actual.w}×${actual.h} px` : 'Usará el archivo de la carpeta si existe';

  return `
    <div class="admin-hueco" data-slot="${slot}">
      <div class="admin-hueco-vista" data-forma="${d.forma}">${vista}</div>
      <div class="admin-hueco-nombre">${escapar(d.nombre)}</div>
      <div class="admin-hueco-guia">${escapar(d.guia)}</div>
      <div class="admin-hueco-info">${escapar(info)}</div>
      <div class="admin-hueco-acciones">
        <label class="admin-subir">
          <i class="fas fa-upload"></i> Cambiar
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-subir="${slot}">
        </label>
        ${actual ? `<button class="admin-quitar" data-quitar="${slot}" title="Quitar esta imagen"><i class="fas fa-trash"></i></button>` : ''}
      </div>
    </div>`;
}

function adminHTMLTextos(cat) {
  let html = `
    <div class="aviso info visible">
      Todo lo que escribas aquí se guarda en la base de datos y se aplica
      para <strong>todos los visitantes</strong>, no sólo en este equipo.
    </div>`;

  for (const [id, grupo] of Object.entries(cat.textos)) {
    if (id === 'apariencia') continue;   // tiene su propia pestaña
    html += `
      <div class="admin-tarjeta">
        <div class="admin-tarjeta-titulo"><i class="${grupo.marca || 'fas'} ${grupo.icono}"></i> ${escapar(grupo.titulo)}</div>
        ${grupo.nota ? `<div class="admin-tarjeta-nota">${escapar(grupo.nota)}</div>` : ''}
        <div class="admin-campos">
          ${Object.entries(grupo.campos).map(([clave, d]) => adminHTMLCampo(clave, d, cat)).join('')}
        </div>
      </div>`;
  }
  return html;
}

function adminHTMLCampo(clave, d, cat) {
  const valor  = cat.valores[clave] ?? d.def ?? '';
  const ancho  = d.tipo === 'area' ? ' ancho' : '';
  const ayuda  = d.ayuda ? `<div class="admin-campo-ayuda">${escapar(d.ayuda)}</div>` : '';

  let control;
  if (d.tipo === 'telefono') {
    control = `
      <div class="admin-tel">
        <span class="admin-tel-prefijo">+51</span>
        <input type="tel" inputmode="numeric" maxlength="9" data-campo="${clave}"
               value="${escapar(valor)}" placeholder="9XXXXXXXX">
      </div>`;
  } else if (d.tipo === 'area') {
    control = `<textarea class="f-campo" data-campo="${clave}" rows="3">${escapar(valor)}</textarea>`;
  } else if (d.tipo === 'url') {
    control = `<input class="f-campo" type="url" data-campo="${clave}" value="${escapar(valor)}" placeholder="https://…">`;
  } else {
    control = `<input class="f-campo" type="text" data-campo="${clave}" value="${escapar(valor)}">`;
  }

  return `
    <div class="admin-campo${ancho}" data-campo-caja="${clave}">
      <label class="admin-campo-nombre">${escapar(d.nombre)}</label>
      ${control}
      ${ayuda}
      <div class="admin-campo-error" hidden></div>
    </div>`;
}

function adminHTMLApariencia(cat) {
  const grupo = cat.textos.apariencia;
  if (!grupo) return '';

  const muestras = {
    cursor_estilo: {
      clasico:   '<i class="fas fa-mouse-pointer"></i>',
      precision: '<i class="fas fa-crosshairs"></i>',
      halo:      '<i class="far fa-circle-dot"></i>',
      neon:      '<i class="fas fa-location-arrow"></i>',
    },
    acento_color: {
      cian:    '#33ceff', ambar: '#ffb020',
      verde:   '#6ee36e', violeta: '#b085ff',
    },
  };

  let html = `
    <div class="aviso info visible">
      Los cambios de apariencia se aplican <strong>al instante</strong> para que los veas,
      pero sólo quedan fijos para todos cuando pulsas «Guardar cambios».
    </div>`;

  for (const [clave, d] of Object.entries(grupo.campos)) {
    const actual = cat.valores[clave] ?? d.def;
    html += `
      <div class="admin-tarjeta">
        <div class="admin-tarjeta-titulo"><i class="fas ${grupo.icono}"></i> ${escapar(d.nombre)}</div>
        ${grupo.nota && clave === 'cursor_estilo' ? `<div class="admin-tarjeta-nota">${escapar(grupo.nota)}</div>` : ''}
        <div class="admin-opciones">
          ${Object.entries(d.opciones).map(([valor, etiqueta]) => {
            const esColor = clave === 'acento_color';
            const muestra = esColor
              ? `<span class="admin-opcion-muestra color" style="background:${muestras.acento_color[valor]}"></span>`
              : `<span class="admin-opcion-muestra">${muestras.cursor_estilo[valor] || ''}</span>`;
            return `
              <label class="admin-opcion ${valor === actual ? 'elegida' : ''}">
                <input type="radio" name="op-${clave}" value="${valor}" data-opcion="${clave}"
                       ${valor === actual ? 'checked' : ''}>
                ${muestra}
                <span class="admin-opcion-texto">${escapar(etiqueta)}</span>
              </label>`;
          }).join('')}
        </div>
      </div>`;
  }
  return html;
}

function adminHTMLSeguridad() {
  return `
    <div class="admin-tarjeta">
      <div class="admin-tarjeta-titulo"><i class="fas fa-key"></i> Cambiar la contraseña del panel</div>
      <div class="admin-tarjeta-nota">
        La contraseña se guarda cifrada en la base de datos: ni siquiera nosotros podemos leerla.
        Usa al menos 10 caracteres, mezclando letras, números y algún símbolo.
      </div>
      <div class="aviso" id="avisoClave" role="alert"></div>
      <div class="admin-campos">
        <div class="admin-campo">
          <label class="admin-campo-nombre" for="claveActual">Contraseña actual</label>
          <input class="f-campo" type="password" id="claveActual" autocomplete="current-password">
        </div>
        <div class="admin-campo">
          <label class="admin-campo-nombre" for="claveNueva">Contraseña nueva</label>
          <input class="f-campo" type="password" id="claveNueva" autocomplete="new-password">
        </div>
        <div class="admin-campo">
          <label class="admin-campo-nombre" for="claveRepetir">Repite la nueva</label>
          <input class="f-campo" type="password" id="claveRepetir" autocomplete="new-password">
        </div>
      </div>
      <button class="admin-btn auto" id="btnCambiarClave" style="margin-top:20px;">
        <i class="fas fa-lock"></i> Cambiar contraseña
      </button>
    </div>

    <div class="admin-tarjeta">
      <div class="admin-tarjeta-titulo"><i class="fas fa-list-check"></i> Recomendaciones</div>
      <div class="admin-tarjeta-nota" style="margin-bottom:0">
        <ul style="margin-left:18px; line-height:2;">
          <li>Borra del servidor <code>admin/instalar.php</code> y <code>admin/diagnostico.php</code> cuando ya no los necesites.</li>
          <li>Cambia la contraseña inicial que venía en <code>config.php</code>.</li>
          <li>Tras 3 intentos fallidos el acceso se bloquea 1 hora; a los 3 siguientes, 1 día.</li>
          <li>El bloqueo lo controla el servidor, así que no se salta cambiando de navegador.</li>
        </ul>
      </div>
    </div>`;
}

/* ── Eventos del panel ──────────────────────────────────────────── */

function adminConectarEventos() {
  /* Pestañas */
  $$('[data-pestana]').forEach((b) => b.addEventListener('click', () => {
    $$('.admin-pestana').forEach((x) => x.classList.remove('activa'));
    b.classList.add('activa');
    $$('.admin-panel').forEach((p) => p.classList.toggle('activo', p.dataset.panel === b.dataset.pestana));
    $('#adminBarraGuardar').style.display = b.dataset.pestana === 'seguridad' ? 'none' : '';
  }));

  /* Subir imagen: sólo vista previa, se envía al guardar */
  $$('[data-subir]').forEach((input) => input.addEventListener('change', () => {
    const archivo = input.files?.[0];
    if (!archivo) return;
    const slot  = input.dataset.subir;
    const hueco = input.closest('.admin-hueco');
    const limite = (estado.catalogo?.limite_mb || 8) * 1024 * 1024;

    if (archivo.size > limite) {
      alert(`«${archivo.name}» pesa ${(archivo.size / 1048576).toFixed(1)} MB y el máximo es ${estado.catalogo.limite_mb} MB.\n\nReduce la imagen y vuelve a intentarlo.`);
      input.value = '';
      return;
    }

    const lector = new FileReader();
    lector.onload = (e) => {
      admin.archivos[slot]      = archivo;
      admin.vistasPrevias[slot] = e.target.result;
      delete admin.quitar[slot];
      hueco.querySelector('.admin-hueco-vista').innerHTML = `<img src="${e.target.result}" alt="">`;
      hueco.querySelector('.admin-hueco-info').textContent =
        `Nueva · ${(archivo.size / 1024).toFixed(0)} KB · sin guardar`;
      hueco.classList.add('pendiente');
      adminActualizarContador();
    };
    lector.readAsDataURL(archivo);
  }));

  /* Quitar imagen */
  $$('[data-quitar]').forEach((b) => b.addEventListener('click', () => {
    const slot  = b.dataset.quitar;
    const hueco = b.closest('.admin-hueco');
    if (!confirm('¿Quitar esta imagen? El hueco volverá a quedar vacío para todos los visitantes.')) return;
    admin.quitar[slot] = true;
    delete admin.archivos[slot];
    delete admin.vistasPrevias[slot];
    hueco.querySelector('.admin-hueco-vista').innerHTML =
      '<div class="vacio"><i class="fas fa-trash"></i><span>Se quitará al guardar</span></div>';
    hueco.classList.add('pendiente');
    adminActualizarContador();
  }));

  /* Campos de texto */
  $$('[data-campo]').forEach((campo) => campo.addEventListener('input', () => {
    const clave = campo.dataset.campo;
    if (campo.type === 'tel') campo.value = campo.value.replace(/\D/g, '').slice(0, 9);
    admin.cambiosTexto[clave] = campo.value;
    $(`[data-campo-caja="${clave}"]`)?.classList.remove('malo');
    adminActualizarContador();
  }));

  /* Apariencia: se ve al momento, se guarda al pulsar Guardar */
  $$('[data-opcion]').forEach((radio) => radio.addEventListener('change', () => {
    const clave = radio.dataset.opcion;
    admin.cambiosTexto[clave] = radio.value;
    radio.closest('.admin-opciones').querySelectorAll('.admin-opcion')
      .forEach((l) => l.classList.remove('elegida'));
    radio.closest('.admin-opcion').classList.add('elegida');

    if (clave === 'cursor_estilo') document.body.dataset.cursor = radio.value;
    if (clave === 'acento_color')  document.documentElement.dataset.acento = radio.value;
    adminActualizarContador();
  }));

  /* Cambiar contraseña */
  $('#btnCambiarClave')?.addEventListener('click', adminCambiarClave);
}

/* ── Guardar con verificación ───────────────────────────────────── */

async function adminGuardar() {
  const btn  = $('#adminGuardar');
  const caja = $('#adminResultado');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GUARDANDO…';
  caja.innerHTML = '';

  const problemas = [];
  let guardados = 0;

  /* — 1. Textos — */
  const textosPendientes = { ...admin.cambiosTexto };
  let valoresServidor = null;
  if (Object.keys(textosPendientes).length) {
    try {
      const r = await apiJSON('guardar', { cambios: textosPendientes });
      guardados += r.guardados || 0;
      valoresServidor = r.valores || null;
      (r.rechazados || []).forEach((x) => {
        problemas.push(`<strong>${escapar(nombreCampo(x.campo))}</strong>: ${escapar(x.motivo)}`);
        const cajaCampo = $(`[data-campo-caja="${x.campo}"]`);
        if (cajaCampo) {
          cajaCampo.classList.add('malo');
          const err = cajaCampo.querySelector('.admin-campo-error');
          if (err) { err.textContent = x.motivo; err.hidden = false; }
        }
        delete textosPendientes[x.campo];
      });
    } catch (e) {
      problemas.push(`No se pudieron guardar los textos: ${escapar(e.message)}`);
      Object.keys(textosPendientes).forEach((k) => delete textosPendientes[k]);
    }
  }

  /* — 2. Imágenes a quitar — */
  for (const slot of Object.keys(admin.quitar)) {
    try {
      await apiJSON('quitar', { slot });
      guardados++;
    } catch (e) {
      problemas.push(`No se pudo quitar «${escapar(slot)}»: ${escapar(e.message)}`);
    }
  }

  /* — 3. Imágenes a subir, una a una para poder informar de cada fallo — */
  const subidas = [];
  for (const [slot, archivo] of Object.entries(admin.archivos)) {
    const hueco = $(`.admin-hueco[data-slot="${slot}"]`);
    hueco?.classList.add('subiendo');
    try {
      const fd = new FormData();
      fd.append('csrf', estado.csrf);
      fd.append('slot', slot);
      fd.append('archivo', archivo);
      const r = await api('subir', { method: 'POST', body: fd });
      if (r.ok) { guardados++; subidas.push(slot); }
      else problemas.push(`<strong>${escapar(slot)}</strong>: ${escapar(r.error || 'error desconocido')}`);
    } catch (e) {
      problemas.push(`<strong>${escapar(slot)}</strong>: ${escapar(e.message)}`);
    } finally {
      hueco?.classList.remove('subiendo');
    }
  }

  /* — 4. VERIFICACIÓN: releer del servidor como si fuéramos otro visitante — */
  let verificado = false;
  const noConfirmados = [];
  try {
    const d = await api('contenido');
    estado.textos   = d.textos   || {};
    estado.imagenes = d.imagenes || {};
    estado.version  = d.version;
    verificado = true;

    if (valoresServidor) {
      for (const clave of Object.keys(textosPendientes)) {
        if (estado.textos[clave] !== valoresServidor[clave]) {
          noConfirmados.push(nombreCampo(clave));
        }
      }
    }
    for (const slot of subidas) {
      if (!estado.imagenes[slot]) noConfirmados.push(slot);
    }
    for (const slot of Object.keys(admin.quitar)) {
      if (estado.imagenes[slot]) noConfirmados.push(slot);
    }
    aplicarTodo();
  } catch (e) {
    problemas.push(`No se pudo verificar el guardado: ${escapar(e.message)}`);
  }

  if (noConfirmados.length) {
    problemas.push(
      `El servidor aceptó estos cambios pero al releerlos no aparecen: ` +
      `<strong>${escapar(noConfirmados.join(', '))}</strong>. Revisa admin/diagnostico.php.`);
  }

  /* — 5. Informe — */
  if (problemas.length === 0 && verificado) {
    adminLimpiarCambios();
    $$('.admin-hueco.pendiente').forEach((h) => h.classList.remove('pendiente'));
    caja.innerHTML = `
      <div class="aviso ok visible">
        <strong>✅ ${guardados} cambio(s) guardados y verificados.</strong><br>
        Se volvió a leer el contenido desde el servidor y todo coincide.
        Cualquier persona, desde cualquier computadora o celular, verá estos cambios.
      </div>`;
    setTimeout(() => adminCargarCatalogo(), 800);
  } else {
    caja.innerHTML = `
      <div class="aviso ${guardados ? 'info' : 'error'} visible">
        <strong>${guardados} cambio(s) guardados · ${problemas.length} con problemas</strong>
        <ul>${problemas.map((p) => `<li>${p}</li>`).join('')}</ul>
      </div>`;
    adminActualizarContador();
  }

  btn.disabled = adminHayCambios() === 0;
  btn.innerHTML = original;
  caja.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function nombreCampo(clave) {
  for (const grupo of Object.values(estado.catalogo?.textos || {})) {
    if (grupo.campos[clave]) return grupo.campos[clave].nombre;
  }
  return clave;
}

async function adminRestaurar() {
  const confirmacion = prompt(
    '⚠️ Esto borrará TODOS los cambios que hiciste desde el panel:\n' +
    '· textos, números de WhatsApp y enlaces vuelven a sus valores originales\n' +
    '· las imágenes subidas desde el panel se eliminan\n\n' +
    'Escribe CONFIRMAR para continuar:');
  if (confirmacion !== 'CONFIRMAR') return;

  try {
    await apiJSON('restaurar', { confirmacion: 'CONFIRMAR' });
    await cargarContenido();
    await adminCargarCatalogo();
    $('#adminResultado').innerHTML =
      '<div class="aviso ok visible"><strong>Estado inicial restaurado</strong> para todos los visitantes.</div>';
  } catch (e) {
    $('#adminResultado').innerHTML =
      `<div class="aviso error visible">No se pudo restaurar: ${escapar(e.message)}</div>`;
  }
}

async function adminCambiarClave() {
  const actual  = $('#claveActual').value;
  const nueva   = $('#claveNueva').value;
  const repetir = $('#claveRepetir').value;

  if (!actual || !nueva)      return avisar('avisoClave', 'Completa la contraseña actual y la nueva.');
  if (nueva !== repetir)      return avisar('avisoClave', 'La nueva contraseña y su repetición no coinciden.');
  if (nueva.length < 10)      return avisar('avisoClave', 'La nueva contraseña debe tener al menos 10 caracteres.');

  const btn = $('#btnCambiarClave');
  btn.disabled = true;
  try {
    await apiJSON('clave', { actual, nueva });
    avisar('avisoClave', '✅ Contraseña cambiada. Úsala la próxima vez que entres al panel.', 'ok');
    $('#claveActual').value = $('#claveNueva').value = $('#claveRepetir').value = '';
  } catch (e) {
    avisar('avisoClave', escapar(e.message));
  } finally {
    btn.disabled = false;
  }
}

/* ── Apertura del panel: 4 clics seguidos sobre el logo ─────────── */

function iniciarPanel() {
  const logo = $('#navLogo');
  if (logo) {
    let clics = 0, reloj = null;
    logo.addEventListener('click', () => {
      /* La navegación normal del enlace no se bloquea: el contador corre
         en paralelo, así un clic suelto lleva al inicio al instante. */
      clics++;
      clearTimeout(reloj);
      if (clics >= 4) { clics = 0; abrirPanel(); return; }
      reloj = setTimeout(() => { clics = 0; }, 900);
    });
  }

  $('#adminEntrar')?.addEventListener('click', adminEntrar);
  $('#adminClave')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') adminEntrar(); });
  $('#adminCancelar')?.addEventListener('click', cerrarPanel);
  $('#adminGuardar')?.addEventListener('click', adminGuardar);
  $('#adminRestaurar')?.addEventListener('click', adminRestaurar);

  $('#adminOjo')?.addEventListener('click', () => {
    const campo = $('#adminClave');
    const icono = $('#adminOjo i');
    const visible = campo.type === 'text';
    campo.type = visible ? 'password' : 'text';
    icono.className = visible ? 'fas fa-eye' : 'fas fa-eye-slash';
  });

  $('#adminSalir')?.addEventListener('click', async () => {
    if (adminHayCambios() && !confirm('Tienes cambios sin guardar. ¿Salir de todos modos?')) return;
    try { await api('salir', { method: 'POST' }); } catch { /* da igual */ }
    estado.csrf = null;
    adminLimpiarCambios();
    cerrarPanel();
    cargarContenido({ silencioso: true });
  });

  /* Aviso al cerrar la pestaña con cambios pendientes */
  window.addEventListener('beforeunload', (e) => {
    if ($('#adminCapa')?.classList.contains('abierta') && adminHayCambios()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  $('#alertaServidorCerrar')?.addEventListener('click', ocultarAlertaServidor);
}

/* ══════════════════════════════════════════════════════════════════
   7 · ARRANQUE
══════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
  const anio = $('#anio');
  if (anio) anio.textContent = new Date().getFullYear();

  iniciarCursor();
  iniciarCabecera();
  iniciarMenuMovil();
  iniciarCarruselMarcas();
  iniciarModales();
  iniciarRedesFlotantes();
  iniciarVisor();
  iniciarFormulario();
  iniciarPanel();

  await cargarContenido({ silencioso: true });

  iniciarRevelado();
  iniciarRefresco();
});
