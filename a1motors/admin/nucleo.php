<?php
/* ═══════════════════════════════════════════════════════════════════
   A1 MOTORS PERÚ — Núcleo del sistema
   admin/nucleo.php

   Conexión, sesión, catálogo de contenido y utilidades compartidas.
   Todo lo administrable del sitio se define UNA sola vez aquí:
   el panel se genera desde este catálogo y el servidor valida contra
   este mismo catálogo. Así es imposible que el panel y la página
   queden desalineados.
═══════════════════════════════════════════════════════════════════ */

declare(strict_types=1);
require_once __DIR__ . '/config.php';

/* ═════════════════════════════════════════════════════════════════
   CONEXIÓN
═════════════════════════════════════════════════════════════════ */

/** Devuelve la conexión PDO, o lanza una excepción con un mensaje claro. */
function bd(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    if (!CONFIG_LISTA) {
        throw new RuntimeException(
            'Las credenciales de la base de datos todavía tienen los valores de ejemplo. '
            . 'Edita admin/config.php con los datos reales de tu base de datos en Hostinger.'
        );
    }

    // Algunos hospedajes entregan el servidor como "host:puerto"
    $host = DB_HOST; $puerto = null;
    if (str_contains($host, ':')) { [$host, $puerto] = explode(':', $host, 2); }
    $dsn = 'mysql:host=' . $host
         . ($puerto !== null ? ';port=' . (int)$puerto : '')
         . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $pdo;
}

/* ═════════════════════════════════════════════════════════════════
   SESIÓN
═════════════════════════════════════════════════════════════════ */

function iniciar_sesion(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $seguro = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
           || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'secure'   => $seguro,
        'samesite' => 'Lax',
    ]);
    session_name('A1SESION');
    session_start();
}

function admin_conectado(): bool {
    iniciar_sesion();
    if (empty($_SESSION['a1_admin'])) return false;
    // Caducidad por inactividad: 2 horas
    if (isset($_SESSION['a1_visto']) && (time() - (int)$_SESSION['a1_visto']) > 7200) {
        cerrar_sesion_admin();
        return false;
    }
    $_SESSION['a1_visto'] = time();
    return true;
}

function abrir_sesion_admin(): void {
    iniciar_sesion();
    session_regenerate_id(true);
    $_SESSION['a1_admin'] = true;
    $_SESSION['a1_visto'] = time();
    $_SESSION['a1_csrf']  = bin2hex(random_bytes(16));
}

function cerrar_sesion_admin(): void {
    iniciar_sesion();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

function token_csrf(): string {
    iniciar_sesion();
    if (empty($_SESSION['a1_csrf'])) $_SESSION['a1_csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['a1_csrf'];
}

function csrf_valido(?string $token): bool {
    iniciar_sesion();
    return !empty($_SESSION['a1_csrf']) && is_string($token)
        && hash_equals($_SESSION['a1_csrf'], $token);
}

/* ═════════════════════════════════════════════════════════════════
   RESPUESTAS JSON
═════════════════════════════════════════════════════════════════ */

function json_salida(array $datos, int $codigo = 200) {
    if (!headers_sent()) {
        http_response_code($codigo);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: no-store, no-cache, must-revalidate');
    }
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $mensaje, int $codigo = 400) {
    json_salida(['ok' => false, 'error' => $mensaje], $codigo);
}

/* ═════════════════════════════════════════════════════════════════
   CATÁLOGO DE IMÁGENES
   Fuente única de verdad. Cada entrada se convierte automáticamente
   en: un hueco editable en el panel + una validación en el servidor
   + un atributo data-img en la página.
═════════════════════════════════════════════════════════════════ */

function catalogo_imagenes(): array {
    return [
        'identidad' => [
            'titulo' => 'Identidad visual',
            'icono'  => 'fa-fingerprint',
            'nota'   => 'El logo aparece en la cabecera, el pie de página y el panel. El favicon es el ícono de la pestaña del navegador.',
            'slots'  => [
                'logo'    => ['nombre' => 'Logo del sitio', 'guia' => 'PNG con fondo transparente · mín. 400×110 px', 'forma' => 'ancho'],
                'favicon' => ['nombre' => 'Favicon',        'guia' => 'PNG cuadrado · 128×128 px',                    'forma' => 'cuadrado'],
            ],
        ],
        'portada' => [
            'titulo' => 'Portada y sistemas',
            'icono'  => 'fa-car-side',
            'nota'   => 'Vehículos ilustrativos. Se ven mucho mejor con fondo transparente (PNG).',
            'slots'  => [
                'hero-auto'     => ['nombre' => 'Vehículo de portada',       'guia' => 'PNG transparente · mín. 900×560 px', 'forma' => 'ancho'],
                'sistemas-auto' => ['nombre' => 'Vehículo de «Sistemas»',    'guia' => 'PNG transparente · mín. 500×350 px', 'forma' => 'ancho'],
            ],
        ],
        'servicios' => [
            'titulo' => 'Imágenes de servicios',
            'icono'  => 'fa-screwdriver-wrench',
            'nota'   => 'Proporción 5:3. Se recortan automáticamente al centro.',
            'slots'  => [
                'svc-gnv'         => ['nombre' => 'Conversión a GNV / GLP',  'guia' => 'JPG o PNG · 5:3 · mín. 600×360 px', 'forma' => '5-3'],
                'svc-mant-mayor'  => ['nombre' => 'Mantenimiento Mayor',     'guia' => 'JPG o PNG · 5:3 · mín. 600×360 px', 'forma' => '5-3'],
                'svc-gas'         => ['nombre' => 'Mantenimiento de Gas',    'guia' => 'JPG o PNG · 5:3 · mín. 600×360 px', 'forma' => '5-3'],
                'svc-afinamiento' => ['nombre' => 'Afinamiento Electrónico', 'guia' => 'JPG o PNG · 5:3 · mín. 600×360 px', 'forma' => '5-3'],
                'svc-mant-menor'  => ['nombre' => 'Mantenimiento Menor',     'guia' => 'JPG o PNG · 5:3 · mín. 600×360 px', 'forma' => '5-3'],
                'svc-planchado'   => ['nombre' => 'Planchado y Pintura',     'guia' => 'JPG o PNG · 5:3 · mín. 600×360 px', 'forma' => '5-3'],
            ],
        ],
        'promociones' => [
            'titulo' => 'Promociones del mes',
            'icono'  => 'fa-tags',
            'nota'   => 'Ideal para flyers de Canva exportados en 4:3 (ej. 1200×900 px). Cámbialas cada mes.',
            'slots'  => [
                'promo-mecanica-1' => ['nombre' => 'Mecánica · Promo 1', 'guia' => 'JPG o PNG · 4:3 · mín. 900×675 px', 'forma' => '4-3'],
                'promo-mecanica-2' => ['nombre' => 'Mecánica · Promo 2', 'guia' => 'JPG o PNG · 4:3 · mín. 900×675 px', 'forma' => '4-3'],
                'promo-mecanica-3' => ['nombre' => 'Mecánica · Promo 3', 'guia' => 'JPG o PNG · 4:3 · mín. 900×675 px', 'forma' => '4-3'],
                'promo-gnv-1'      => ['nombre' => 'GNV/GLP · Promo 1',  'guia' => 'JPG o PNG · 4:3 · mín. 900×675 px', 'forma' => '4-3'],
                'promo-gnv-2'      => ['nombre' => 'GNV/GLP · Promo 2',  'guia' => 'JPG o PNG · 4:3 · mín. 900×675 px', 'forma' => '4-3'],
                'promo-gnv-3'      => ['nombre' => 'GNV/GLP · Promo 3',  'guia' => 'JPG o PNG · 4:3 · mín. 900×675 px', 'forma' => '4-3'],
                'promo-pintura-1'  => ['nombre' => 'Pintura · Promo 1',  'guia' => 'JPG o PNG · 4:3 · mín. 900×675 px', 'forma' => '4-3'],
                'promo-pintura-2'  => ['nombre' => 'Pintura · Promo 2',  'guia' => 'JPG o PNG · 4:3 · mín. 900×675 px', 'forma' => '4-3'],
                'promo-pintura-3'  => ['nombre' => 'Pintura · Promo 3',  'guia' => 'JPG o PNG · 4:3 · mín. 900×675 px', 'forma' => '4-3'],
            ],
        ],
        'empresas' => [
            'titulo' => 'Empresas que confían',
            'icono'  => 'fa-building',
            'nota'   => 'Logos con fondo transparente. El nombre de cada empresa también se edita aquí.',
            'slots'  => [
                'empresa-1' => ['nombre' => 'Empresa 1', 'guia' => 'PNG transparente · alto mín. 80 px', 'forma' => 'ancho', 'texto' => 'empresa1_nombre'],
                'empresa-2' => ['nombre' => 'Empresa 2', 'guia' => 'PNG transparente · alto mín. 80 px', 'forma' => 'ancho', 'texto' => 'empresa2_nombre'],
                'empresa-3' => ['nombre' => 'Empresa 3', 'guia' => 'PNG transparente · alto mín. 80 px', 'forma' => 'ancho', 'texto' => 'empresa3_nombre'],
            ],
        ],
        'marcas' => [
            'titulo' => 'Marcas del carrusel',
            'icono'  => 'fa-certificate',
            'nota'   => 'Logos con fondo transparente. Puedes cambiar la imagen y el nombre de cada marca.',
            'slots'  => [
                'marca-1'  => ['nombre' => 'Marca 1',  'guia' => 'PNG transparente · alto mín. 80 px', 'forma' => 'ancho', 'texto' => 'marca1_nombre'],
                'marca-2'  => ['nombre' => 'Marca 2',  'guia' => 'PNG transparente · alto mín. 80 px', 'forma' => 'ancho', 'texto' => 'marca2_nombre'],
                'marca-3'  => ['nombre' => 'Marca 3',  'guia' => 'PNG transparente · alto mín. 80 px', 'forma' => 'ancho', 'texto' => 'marca3_nombre'],
                'marca-4'  => ['nombre' => 'Marca 4',  'guia' => 'PNG transparente · alto mín. 80 px', 'forma' => 'ancho', 'texto' => 'marca4_nombre'],
                'marca-5'  => ['nombre' => 'Marca 5',  'guia' => 'PNG transparente · alto mín. 80 px', 'forma' => 'ancho', 'texto' => 'marca5_nombre'],
                'marca-6'  => ['nombre' => 'Marca 6',  'guia' => 'PNG transparente · alto mín. 80 px', 'forma' => 'ancho', 'texto' => 'marca6_nombre'],
                'marca-7'  => ['nombre' => 'Marca 7',  'guia' => 'PNG transparente · alto mín. 80 px', 'forma' => 'ancho', 'texto' => 'marca7_nombre'],
                'marca-8'  => ['nombre' => 'Marca 8',  'guia' => 'PNG transparente · alto mín. 80 px', 'forma' => 'ancho', 'texto' => 'marca8_nombre'],
                'marca-9'  => ['nombre' => 'Marca 9',  'guia' => 'PNG transparente · alto mín. 80 px', 'forma' => 'ancho', 'texto' => 'marca9_nombre'],
                'marca-10' => ['nombre' => 'Marca 10', 'guia' => 'PNG transparente · alto mín. 80 px', 'forma' => 'ancho', 'texto' => 'marca10_nombre'],
            ],
        ],
        'testimonios' => [
            'titulo' => 'Fotos de testimonios',
            'icono'  => 'fa-comment-dots',
            'nota'   => 'Fotos cuadradas. El texto de cada testimonio se edita en la pestaña «Textos».',
            'slots'  => [
                'cliente-1' => ['nombre' => 'Cliente 1', 'guia' => 'JPG o PNG cuadrado · mín. 500×500 px', 'forma' => 'cuadrado'],
                'cliente-2' => ['nombre' => 'Cliente 2', 'guia' => 'JPG o PNG cuadrado · mín. 500×500 px', 'forma' => 'cuadrado'],
                'cliente-3' => ['nombre' => 'Cliente 3', 'guia' => 'JPG o PNG cuadrado · mín. 500×500 px', 'forma' => 'cuadrado'],
            ],
        ],
    ];
}

/** Lista plana de todos los slots de imagen válidos. */
function slots_imagen(): array {
    static $lista = null;
    if ($lista !== null) return $lista;
    $lista = [];
    foreach (catalogo_imagenes() as $grupo) {
        foreach ($grupo['slots'] as $slot => $_) $lista[] = $slot;
    }
    return $lista;
}

function slot_valido(string $slot): bool {
    return in_array($slot, slots_imagen(), true);
}

/* ═════════════════════════════════════════════════════════════════
   CATÁLOGO DE TEXTOS
   tipo: texto | area | url | telefono | opciones
═════════════════════════════════════════════════════════════════ */

function catalogo_textos(): array {
    return [
        'whatsapp' => [
            'titulo' => 'WhatsApp por área',
            'icono'  => 'fa-whatsapp',
            'marca'  => 'fab',
            'nota'   => 'El botón flotante pregunta al visitante a qué área quiere escribir y lo deriva al número correspondiente. Escribe 9 dígitos, sin el +51.',
            'campos' => [
                'wa_mecanica' => ['nombre' => 'Mecánica General',      'tipo' => 'telefono', 'def' => '997319758'],
                'wa_pintura'  => ['nombre' => 'Planchado y Pintura',   'tipo' => 'telefono', 'def' => '959172262'],
                'wa_gnv'      => ['nombre' => 'Conversiones GNV/GLP',  'tipo' => 'telefono', 'def' => '993210651'],
                'wa_saludo'   => ['nombre' => 'Encabezado del mensaje','tipo' => 'texto',    'def' => 'Hola, vengo de la web de A1 Motors',
                                  'ayuda' => 'Se antepone a todos los mensajes de WhatsApp para que sepas qué clientes llegan desde la web.'],
            ],
        ],
        'redes' => [
            'titulo' => 'Redes sociales y ubicación',
            'icono'  => 'fa-share-nodes',
            'nota'   => 'Pega la URL completa, incluyendo https://',
            'campos' => [
                'url_ig'  => ['nombre' => 'Instagram',     'tipo' => 'url', 'def' => 'https://www.instagram.com/a1motorsperu/'],
                'url_fb'  => ['nombre' => 'Facebook',      'tipo' => 'url', 'def' => 'https://www.facebook.com/A1MotorsPeru'],
                'url_tt'  => ['nombre' => 'TikTok',        'tipo' => 'url', 'def' => 'https://www.tiktok.com/@a1motorsperu'],
                'url_map' => ['nombre' => 'Google Maps',   'tipo' => 'url', 'def' => 'https://share.google/3iEyquITbFgwXLkZI'],
            ],
        ],
        'contacto' => [
            'titulo' => 'Datos de contacto',
            'icono'  => 'fa-location-dot',
            'campos' => [
                'dir_texto'     => ['nombre' => 'Dirección',       'tipo' => 'texto', 'def' => 'San Fernando 275, Los Olivos'],
                'horario_texto' => ['nombre' => 'Horario',         'tipo' => 'texto', 'def' => 'Lun–Sáb 8AM–7PM · Dom previa cita'],
                'pie_lema'      => ['nombre' => 'Lema del pie',    'tipo' => 'area',  'def' => 'Excelencia automotriz con más de 20 años de experiencia. Los Olivos, Lima — Perú.'],
            ],
        ],
        'cifras' => [
            'titulo' => 'Cifras destacadas',
            'icono'  => 'fa-chart-simple',
            'nota'   => 'La franja de 4 cifras que aparece bajo la portada.',
            'campos' => [
                'cifra1_num' => ['nombre' => 'Cifra 1',           'tipo' => 'texto', 'def' => '+5000'],
                'cifra1_txt' => ['nombre' => 'Descripción 1',     'tipo' => 'texto', 'def' => 'Clientes atendidos'],
                'cifra2_num' => ['nombre' => 'Cifra 2',           'tipo' => 'texto', 'def' => '98%'],
                'cifra2_txt' => ['nombre' => 'Descripción 2',     'tipo' => 'texto', 'def' => 'Satisfacción garantizada'],
                'cifra3_num' => ['nombre' => 'Cifra 3',           'tipo' => 'texto', 'def' => '+15'],
                'cifra3_txt' => ['nombre' => 'Descripción 3',     'tipo' => 'texto', 'def' => 'Técnicos especializados'],
                'cifra4_num' => ['nombre' => 'Cifra 4',           'tipo' => 'texto', 'def' => '+10'],
                'cifra4_txt' => ['nombre' => 'Descripción 4',     'tipo' => 'texto', 'def' => 'Certificaciones técnicas'],
            ],
        ],
        'testimonios_txt' => [
            'titulo' => 'Testimonios',
            'icono'  => 'fa-quote-left',
            'nota'   => 'Las fotos se cambian en la pestaña «Imágenes».',
            'campos' => [
                'testi1_nombre' => ['nombre' => 'Testimonio 1 · Nombre', 'tipo' => 'texto', 'def' => 'Carlos G.'],
                'testi1_rol'    => ['nombre' => 'Testimonio 1 · Rol',    'tipo' => 'texto', 'def' => 'Cliente Particular'],
                'testi1_texto'  => ['nombre' => 'Testimonio 1 · Texto',  'tipo' => 'area',  'def' => 'Mi auto quedó como nuevo, resolvieron una falla eléctrica que nadie podía. Excelentes técnicos y atención de primer nivel.'],
                'testi2_nombre' => ['nombre' => 'Testimonio 2 · Nombre', 'tipo' => 'texto', 'def' => 'Operadores Logísticos SAC'],
                'testi2_rol'    => ['nombre' => 'Testimonio 2 · Rol',    'tipo' => 'texto', 'def' => 'Cliente Empresarial'],
                'testi2_texto'  => ['nombre' => 'Testimonio 2 · Texto',  'tipo' => 'area',  'def' => 'Atienden flotas empresariales con mucha seriedad. Redujeron significativamente nuestros costos de mantenimiento mensual.'],
                'testi3_nombre' => ['nombre' => 'Testimonio 3 · Nombre', 'tipo' => 'texto', 'def' => 'Valeria M.'],
                'testi3_rol'    => ['nombre' => 'Testimonio 3 · Rol',    'tipo' => 'texto', 'def' => 'SUV Owner'],
                'testi3_texto'  => ['nombre' => 'Testimonio 3 · Texto',  'tipo' => 'area',  'def' => 'Planchado y pintura impecable, color exacto y entrega rápida. La atención y los resultados son de taller internacional.'],
            ],
        ],
        'nombres' => [
            'titulo' => 'Nombres de empresas y marcas',
            'icono'  => 'fa-tag',
            'nota'   => 'Se muestran bajo cada logo. Déjalo vacío si no quieres que aparezca texto.',
            'campos' => [
                'empresa1_nombre' => ['nombre' => 'Empresa 1', 'tipo' => 'texto', 'def' => 'Melconsi SAC'],
                'empresa2_nombre' => ['nombre' => 'Empresa 2', 'tipo' => 'texto', 'def' => 'Campo Fe SAC'],
                'empresa3_nombre' => ['nombre' => 'Empresa 3', 'tipo' => 'texto', 'def' => 'Operadores Logísticos SAC'],
                'marca1_nombre'   => ['nombre' => 'Marca 1',   'tipo' => 'texto', 'def' => 'Toyota'],
                'marca2_nombre'   => ['nombre' => 'Marca 2',   'tipo' => 'texto', 'def' => 'Hyundai'],
                'marca3_nombre'   => ['nombre' => 'Marca 3',   'tipo' => 'texto', 'def' => 'Kia'],
                'marca4_nombre'   => ['nombre' => 'Marca 4',   'tipo' => 'texto', 'def' => 'Nissan'],
                'marca5_nombre'   => ['nombre' => 'Marca 5',   'tipo' => 'texto', 'def' => 'Chevrolet'],
                'marca6_nombre'   => ['nombre' => 'Marca 6',   'tipo' => 'texto', 'def' => 'Mazda'],
                'marca7_nombre'   => ['nombre' => 'Marca 7',   'tipo' => 'texto', 'def' => 'Suzuki'],
                'marca8_nombre'   => ['nombre' => 'Marca 8',   'tipo' => 'texto', 'def' => 'Volkswagen'],
                'marca9_nombre'   => ['nombre' => 'Marca 9',   'tipo' => 'texto', 'def' => 'Mitsubishi'],
                'marca10_nombre'  => ['nombre' => 'Marca 10',  'tipo' => 'texto', 'def' => 'Ford'],
            ],
        ],
        'apariencia' => [
            'titulo' => 'Apariencia',
            'icono'  => 'fa-wand-magic-sparkles',
            'nota'   => 'El cursor personalizado se desactiva solo en celulares y tablets.',
            'campos' => [
                'cursor_estilo' => [
                    'nombre'  => 'Estilo del cursor',
                    'tipo'    => 'opciones',
                    'def'     => 'precision',
                    'opciones' => [
                        'clasico'   => 'Clásico — flecha normal del sistema',
                        'precision' => 'Precisión — retícula de diagnóstico',
                        'halo'      => 'Halo — punto con anillo que lo sigue',
                        'neon'      => 'Neón — flecha con estela luminosa',
                    ],
                ],
                'acento_color' => [
                    'nombre'  => 'Color de acento',
                    'tipo'    => 'opciones',
                    'def'     => 'cian',
                    'opciones' => [
                        'cian'    => 'Cian eléctrico (actual)',
                        'ambar'   => 'Ámbar taller',
                        'verde'   => 'Verde lima',
                        'violeta' => 'Violeta',
                    ],
                ],
            ],
        ],
    ];
}

/** Mapa plano clave => definición. */
function campos_texto(): array {
    static $mapa = null;
    if ($mapa !== null) return $mapa;
    $mapa = [];
    foreach (catalogo_textos() as $grupo) {
        foreach ($grupo['campos'] as $clave => $def) $mapa[$clave] = $def;
    }
    return $mapa;
}

/** Valores por defecto de todos los textos. */
function textos_por_defecto(): array {
    $def = [];
    foreach (campos_texto() as $clave => $c) $def[$clave] = (string)($c['def'] ?? '');
    return $def;
}

/* ═════════════════════════════════════════════════════════════════
   VALIDACIÓN DE TEXTOS
   Devuelve [valorLimpio, null] o [null, 'motivo del rechazo'].
   Nunca descarta en silencio: si algo no pasa, el panel lo muestra.
═════════════════════════════════════════════════════════════════ */

function validar_texto(string $clave, $valor): array {
    $campos = campos_texto();
    if (!isset($campos[$clave])) return [null, 'El campo «' . $clave . '» no existe.'];
    if (!is_scalar($valor) && $valor !== null) return [null, 'Valor no válido.'];

    $def   = $campos[$clave];
    $valor = trim((string)$valor);

    switch ($def['tipo']) {
        case 'telefono':
            $n = preg_replace('/\D/', '', $valor);
            if ($n === '') return [null, 'Escribe el número de WhatsApp.'];
            if (strlen($n) === 11 && str_starts_with($n, '51')) $n = substr($n, 2);
            if (strlen($n) !== 9) return [null, 'Debe tener exactamente 9 dígitos (sin el +51). Recibido: ' . strlen($n) . '.'];
            if ($n[0] !== '9')    return [null, 'Un celular peruano empieza con 9.'];
            return [$n, null];

        case 'url':
            if ($valor === '') return ['', null];           // vacío = ocultar el enlace
            if (!preg_match('~^https?://~i', $valor)) $valor = 'https://' . $valor;
            if (!filter_var($valor, FILTER_VALIDATE_URL))   return [null, 'La dirección no es válida.'];
            if (mb_strlen($valor) > 600)                    return [null, 'La dirección es demasiado larga.'];
            return [$valor, null];

        case 'opciones':
            if (!isset($def['opciones'][$valor])) return [null, 'Opción no reconocida.'];
            return [$valor, null];

        case 'area':
            if (mb_strlen($valor) > 1200) return [null, 'Máximo 1200 caracteres.'];
            return [$valor, null];

        case 'texto':
        default:
            if (mb_strlen($valor) > 300) return [null, 'Máximo 300 caracteres.'];
            return [$valor, null];
    }
}

/* ═════════════════════════════════════════════════════════════════
   LECTURA DE CONTENIDO
═════════════════════════════════════════════════════════════════ */

/** Textos guardados, completados con los valores por defecto. */
function leer_textos(PDO $db): array {
    $valores = textos_por_defecto();
    $filas = $db->query('SELECT clave, valor FROM a1_config')->fetchAll();
    foreach ($filas as $f) {
        if (array_key_exists($f['clave'], $valores)) $valores[$f['clave']] = $f['valor'];
    }
    return $valores;
}

/** Mapa slot => ['url' => 'imagenes/archivo.png?v=…', 'w' =>, 'h' =>]. */
function leer_imagenes(PDO $db): array {
    $salida = [];
    $filas  = $db->query('SELECT slot, archivo, ancho, alto, UNIX_TIMESTAMP(actualizado) AS v FROM a1_media')->fetchAll();
    foreach ($filas as $f) {
        if (!slot_valido($f['slot'])) continue;
        if (!is_file(DIR_IMAGENES . '/' . $f['archivo'])) continue;   // archivo borrado a mano
        $salida[$f['slot']] = [
            'url' => URL_IMAGENES . rawurlencode($f['archivo']) . '?v=' . $f['v'],
            'w'   => (int)$f['ancho'],
            'h'   => (int)$f['alto'],
        ];
    }
    return $salida;
}

/** Sello de versión del contenido: cambia en cuanto se guarda cualquier cosa. */
function version_contenido(PDO $db): string {
    $a = $db->query('SELECT COALESCE(MAX(UNIX_TIMESTAMP(actualizado)),0) AS t, COUNT(*) AS n FROM a1_config')->fetch();
    $b = $db->query('SELECT COALESCE(MAX(UNIX_TIMESTAMP(actualizado)),0) AS t, COUNT(*) AS n FROM a1_media')->fetch();
    return $a['t'] . '-' . $a['n'] . '-' . $b['t'] . '-' . $b['n'];
}

/* ═════════════════════════════════════════════════════════════════
   NOMBRES ANTIGUOS
   El sitio anterior repartía las imágenes entre imagenes_Fijo/ e
   imagenes_Variables/ con otros nombres. Copiando esos archivos tal
   cual a imagenes/, el instalador los reconoce y los coloca solo:
   no hay que renombrar nada a mano.
═════════════════════════════════════════════════════════════════ */

function nombres_antiguos(): array {
    return [
        'logo'            => ['logo'],
        'favicon'         => ['favicon'],
        'hero-auto'       => ['bmw', 'hero', 'auto-hero'],
        'sistemas-auto'   => ['auto-sistemas'],

        'svc-gnv'         => ['servicio-gnv'],
        'svc-mant-mayor'  => ['servicio-mantenimiento-mayor'],
        'svc-gas'         => ['servicio-gas'],
        'svc-afinamiento' => ['servicio-afinamiento'],
        'svc-mant-menor'  => ['servicio-mantenimiento-menor'],
        'svc-planchado'   => ['servicio-planchado'],

        'empresa-1'       => ['empresa-melconsi'],
        'empresa-2'       => ['empresa-campofesac', 'empresa-campofe'],
        'empresa-3'       => ['empresa-operadores'],

        'marca-1'         => ['marca-toyota'],
        'marca-2'         => ['marca-hyundai'],
        'marca-3'         => ['marca-kia'],
        'marca-4'         => ['marca-nissan'],
        'marca-5'         => ['marca-chevrolet'],
        'marca-6'         => ['marca-mazda'],
        'marca-7'         => ['marca-suzuki'],
        'marca-8'         => ['marca-volkswagen'],
        'marca-9'         => ['marca-mitsubishi'],
        'marca-10'        => ['marca-ford'],

        'cliente-1'       => ['cliente-carlos'],
        'cliente-2'       => ['cliente-operadores'],
        'cliente-3'       => ['cliente-valeria'],
        /* Las promociones ya se llamaban igual (promo-mecanica-1, etc.) */
    ];
}

/**
 * Busca en imagenes/ un archivo para este hueco, probando primero el
 * nombre nuevo y luego los nombres del sitio anterior.
 * Devuelve la ruta completa o null.
 */
function buscar_archivo_slot(string $slot): ?string {
    $candidatos = array_merge([$slot], nombres_antiguos()[$slot] ?? []);
    foreach ($candidatos as $base) {
        foreach (['png', 'jpg', 'jpeg', 'webp', 'gif'] as $ext) {
            $ruta = DIR_IMAGENES . '/' . $base . '.' . $ext;
            if (is_file($ruta)) return $ruta;
        }
    }
    return null;
}

/* ═════════════════════════════════════════════════════════════════
   UTILIDADES DE ARCHIVOS
═════════════════════════════════════════════════════════════════ */

function extension_por_tipo(int $tipoImagen): ?string {
    return match ($tipoImagen) {
        IMAGETYPE_PNG  => 'png',
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_WEBP => 'webp',
        IMAGETYPE_GIF  => 'gif',
        default        => null,
    };
}

function mime_por_tipo(int $tipoImagen): string {
    return image_type_to_mime_type($tipoImagen);
}

/** Borra versiones anteriores de un slot, conservando $conservar. */
function limpiar_versiones(string $slot, string $conservar): void {
    foreach (glob(DIR_IMAGENES . '/' . $slot . '--*') ?: [] as $ruta) {
        if (basename($ruta) !== $conservar) @unlink($ruta);
    }
}

function ip_visitante(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return substr($ip, 0, 45);
}
