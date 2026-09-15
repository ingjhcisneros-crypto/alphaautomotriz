<?php
/* ═══════════════════════════════════════════════════════════════════
   A1 MOTORS PERÚ — API
   admin/api.php?a=<accion>

   Único punto de entrada del panel. Siempre responde JSON, nunca HTML,
   ni siquiera ante un error de PHP: así el panel puede explicar
   exactamente qué pasó en vez de fallar en silencio.

   Públicas          : contenido
   Requieren sesión  : catalogo · guardar · subir · quitar · restaurar · clave
═══════════════════════════════════════════════════════════════════ */

declare(strict_types=1);

/* Cualquier error de PHP se convierte en JSON legible. */
ini_set('display_errors', '0');
set_error_handler(function (int $n, string $m, string $f, int $l): bool {
    throw new ErrorException($m, 0, $n, $f, $l);
});

require_once __DIR__ . '/nucleo.php';

set_exception_handler(function (Throwable $e): void {
    json_salida(['ok' => false, 'error' => $e->getMessage(), 'donde' => basename($e->getFile()) . ':' . $e->getLine()], 500);
});

const MAX_INTENTOS  = 3;
const BLOQUEO_CORTO = 3600;    // 1 hora
const BLOQUEO_LARGO = 86400;   // 1 día

$accion = (string)($_GET['a'] ?? '');
$esPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';

/** Cuerpo JSON de la petición. */
function cuerpo(): array {
    static $c = null;
    if ($c !== null) return $c;
    $bruto = file_get_contents('php://input') ?: '';
    $d = json_decode($bruto, true);
    $c = is_array($d) ? $d : [];
    return $c;
}

/** Exige sesión de administrador + token CSRF en las acciones que escriben. */
function exigir_admin(bool $comprobarCsrf = true): void {
    if (!admin_conectado()) {
        json_error('Tu sesión de administrador caducó. Vuelve a entrar al panel.', 401);
    }
    if ($comprobarCsrf) {
        $token = $_POST['csrf'] ?? (cuerpo()['csrf'] ?? null);
        if (!csrf_valido(is_string($token) ? $token : null)) {
            json_error('Ficha de seguridad no válida. Recarga la página y entra de nuevo.', 403);
        }
    }
}

switch ($accion) {

/* ═════════════════════════════════════════════════════════════════
   CONTENIDO PÚBLICO — lo que pinta la web para todos los visitantes
═════════════════════════════════════════════════════════════════ */
case 'contenido': {
    $db = bd();
    json_salida([
        'ok'       => true,
        'version'  => version_contenido($db),
        'textos'   => leer_textos($db),
        'imagenes' => leer_imagenes($db),
        'sesion'   => admin_conectado(),
    ]);
}

/* ═════════════════════════════════════════════════════════════════
   ESTADO DE LA SESIÓN
═════════════════════════════════════════════════════════════════ */
case 'sesion': {
    $activa = admin_conectado();
    json_salida(['ok' => true, 'activa' => $activa, 'csrf' => $activa ? token_csrf() : null]);
}

/* ═════════════════════════════════════════════════════════════════
   ENTRAR — con bloqueo por IP guardado en la base de datos
═════════════════════════════════════════════════════════════════ */
case 'entrar': {
    if (!$esPost) json_error('Método no permitido.', 405);
    $db    = bd();
    $ip    = ip_visitante();
    $clave = (string)(cuerpo()['clave'] ?? '');

    $st = $db->prepare('SELECT intentos, ciclos, bloqueado_hasta FROM a1_intentos WHERE ip = ?');
    $st->execute([$ip]);
    $reg = $st->fetch() ?: ['intentos' => 0, 'ciclos' => 0, 'bloqueado_hasta' => null];

    if (!empty($reg['bloqueado_hasta'])) {
        $faltan = strtotime((string)$reg['bloqueado_hasta']) - time();
        if ($faltan > 0) {
            json_salida(['ok' => false, 'bloqueado' => true, 'segundos' => $faltan,
                         'error' => 'Acceso bloqueado temporalmente.'], 429);
        }
        $db->prepare('UPDATE a1_intentos SET bloqueado_hasta = NULL, intentos = 0 WHERE ip = ?')->execute([$ip]);
        $reg['intentos'] = 0;
    }

    $fila = $db->query('SELECT clave_hash FROM a1_acceso WHERE id = 1')->fetch();
    if (!$fila) json_error('Todavía no se ha instalado el panel. Abre admin/instalar.php una vez.', 500);

    if (password_verify($clave, $fila['clave_hash'])) {
        $db->prepare('DELETE FROM a1_intentos WHERE ip = ?')->execute([$ip]);
        abrir_sesion_admin();
        json_salida(['ok' => true, 'csrf' => token_csrf()]);
    }

    /* Fallo */
    $intentos = (int)$reg['intentos'] + 1;
    $ciclos   = (int)$reg['ciclos'];
    $hasta    = null; $segundos = 0;
    if ($intentos >= MAX_INTENTOS) {
        $ciclos++;
        $segundos = ($ciclos % 2 === 1) ? BLOQUEO_CORTO : BLOQUEO_LARGO;
        $hasta    = date('Y-m-d H:i:s', time() + $segundos);
        $intentos = 0;
    }
    $db->prepare('INSERT INTO a1_intentos (ip, intentos, ciclos, bloqueado_hasta) VALUES (?,?,?,?)
                  ON DUPLICATE KEY UPDATE intentos=VALUES(intentos), ciclos=VALUES(ciclos),
                                          bloqueado_hasta=VALUES(bloqueado_hasta)')
       ->execute([$ip, $intentos, $ciclos, $hasta]);

    usleep(400000);   // frena los intentos automáticos
    if ($hasta) {
        json_salida(['ok' => false, 'bloqueado' => true, 'segundos' => $segundos,
                     'error' => 'Demasiados intentos fallidos.'], 429);
    }
    json_salida(['ok' => false, 'restantes' => MAX_INTENTOS - $intentos,
                 'error' => 'Contraseña incorrecta.'], 401);
}

/* ═════════════════════════════════════════════════════════════════
   SALIR
═════════════════════════════════════════════════════════════════ */
case 'salir': {
    cerrar_sesion_admin();
    json_salida(['ok' => true]);
}

/* ═════════════════════════════════════════════════════════════════
   CATÁLOGO — estructura con la que el panel se dibuja solo
═════════════════════════════════════════════════════════════════ */
case 'catalogo': {
    exigir_admin(false);
    $db = bd();
    json_salida([
        'ok'        => true,
        'imagenes'  => catalogo_imagenes(),
        'textos'    => catalogo_textos(),
        'actuales'  => leer_imagenes($db),
        'valores'   => leer_textos($db),
        'csrf'      => token_csrf(),
        'limite_mb' => MAX_MB_IMAGEN,
    ]);
}

/* ═════════════════════════════════════════════════════════════════
   GUARDAR TEXTOS
   Informa campo por campo. Nada se descarta en silencio.
═════════════════════════════════════════════════════════════════ */
case 'guardar': {
    if (!$esPost) json_error('Método no permitido.', 405);
    exigir_admin();

    $cambios = cuerpo()['cambios'] ?? null;
    if (!is_array($cambios) || $cambios === []) {
        json_salida(['ok' => true, 'guardados' => 0, 'rechazados' => []]);
    }

    $db = bd();
    $st = $db->prepare('INSERT INTO a1_config (clave, valor) VALUES (?,?)
                        ON DUPLICATE KEY UPDATE valor=VALUES(valor), actualizado=CURRENT_TIMESTAMP');

    $guardados = 0; $rechazados = [];
    $db->beginTransaction();
    foreach ($cambios as $clave => $valor) {
        [$limpio, $motivo] = validar_texto((string)$clave, $valor);
        if ($motivo !== null) {
            $rechazados[] = ['campo' => (string)$clave, 'motivo' => $motivo];
            continue;
        }
        $st->execute([$clave, $limpio]);
        $guardados++;
    }
    $db->commit();

    json_salida([
        'ok'         => $rechazados === [],
        'guardados'  => $guardados,
        'rechazados' => $rechazados,
        'version'    => version_contenido($db),
        'valores'    => leer_textos($db),   // el panel confirma contra esto
    ]);
}

/* ═════════════════════════════════════════════════════════════════
   SUBIR IMAGEN — se guarda como archivo dentro de imagenes/
═════════════════════════════════════════════════════════════════ */
case 'subir': {
    if (!$esPost) json_error('Método no permitido.', 405);
    exigir_admin();

    $slot = (string)($_POST['slot'] ?? '');
    if (!slot_valido($slot)) json_error('Hueco de imagen desconocido: ' . $slot, 400);

    if (!isset($_FILES['archivo'])) {
        json_error('No llegó ningún archivo. Suele ocurrir si la imagen supera el límite del servidor ('
                   . ini_get('upload_max_filesize') . ').', 400);
    }
    $f = $_FILES['archivo'];
    if ($f['error'] !== UPLOAD_ERR_OK) {
        json_error(match ($f['error']) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE =>
                'La imagen supera el límite de subida del servidor (' . ini_get('upload_max_filesize') . ').',
            UPLOAD_ERR_PARTIAL   => 'La subida se interrumpió. Inténtalo de nuevo.',
            UPLOAD_ERR_NO_FILE   => 'No se seleccionó ningún archivo.',
            UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE =>
                'El servidor no pudo escribir el archivo temporal. Contacta con el soporte de tu hosting.',
            default              => 'Error de subida (código ' . $f['error'] . ').',
        }, 400);
    }

    $maxBytes = MAX_MB_IMAGEN * 1024 * 1024;
    if ($f['size'] > $maxBytes) {
        json_error('La imagen pesa ' . round($f['size'] / 1048576, 1) . ' MB y el máximo es ' . MAX_MB_IMAGEN . ' MB.', 400);
    }

    $info = @getimagesize($f['tmp_name']);
    if ($info === false) json_error('El archivo no es una imagen válida.', 400);
    $ext = extension_por_tipo($info[2]);
    if ($ext === null) json_error('Formato no admitido. Usa PNG, JPG, WEBP o GIF.', 400);

    if (!is_dir(DIR_IMAGENES) && !@mkdir(DIR_IMAGENES, 0755, true)) {
        json_error('No existe la carpeta imagenes/ y no se pudo crear.', 500);
    }
    if (!is_writable(DIR_IMAGENES)) {
        json_error('La carpeta imagenes/ no tiene permiso de escritura. Ponla en 755 desde el Administrador de archivos.', 500);
    }

    $archivo = $slot . '--' . time() . '.' . $ext;
    $destino = DIR_IMAGENES . '/' . $archivo;
    if (!@move_uploaded_file($f['tmp_name'], $destino)) {
        json_error('No se pudo guardar la imagen en la carpeta imagenes/.', 500);
    }
    @chmod($destino, 0644);

    /* Reducir si es enorme (opcional: requiere GD) */
    [$ancho, $alto] = [(int)$info[0], (int)$info[1]];
    if ($ancho > ANCHO_MAX_IMAGEN && function_exists('imagecreatetruecolor')) {
        [$ancho, $alto] = redimensionar($destino, $info[2], $ancho, $alto, ANCHO_MAX_IMAGEN);
    }

    $db = bd();
    $db->prepare('INSERT INTO a1_media (slot, archivo, mime, bytes, ancho, alto) VALUES (?,?,?,?,?,?)
                  ON DUPLICATE KEY UPDATE archivo=VALUES(archivo), mime=VALUES(mime), bytes=VALUES(bytes),
                                          ancho=VALUES(ancho), alto=VALUES(alto), actualizado=CURRENT_TIMESTAMP')
       ->execute([$slot, $archivo, mime_por_tipo($info[2]), (int)filesize($destino), $ancho, $alto]);

    limpiar_versiones($slot, $archivo);

    $actuales = leer_imagenes($db);
    if (!isset($actuales[$slot])) {
        json_error('La imagen se subió pero la base de datos no la registró. Revisa admin/diagnostico.php.', 500);
    }

    json_salida([
        'ok'      => true,
        'slot'    => $slot,
        'url'     => $actuales[$slot]['url'],
        'ancho'   => $ancho,
        'alto'    => $alto,
        'kb'      => (int)round(filesize($destino) / 1024),
        'version' => version_contenido($db),
    ]);
}

/* ═════════════════════════════════════════════════════════════════
   QUITAR IMAGEN
═════════════════════════════════════════════════════════════════ */
case 'quitar': {
    if (!$esPost) json_error('Método no permitido.', 405);
    exigir_admin();
    $slot = (string)(cuerpo()['slot'] ?? '');
    if (!slot_valido($slot)) json_error('Hueco de imagen desconocido.', 400);

    $db = bd();
    $st = $db->prepare('SELECT archivo FROM a1_media WHERE slot = ?');
    $st->execute([$slot]);
    if ($fila = $st->fetch()) {
        $ruta = DIR_IMAGENES . '/' . $fila['archivo'];
        if (is_file($ruta) && str_starts_with($fila['archivo'], $slot . '--')) @unlink($ruta);
    }
    $db->prepare('DELETE FROM a1_media WHERE slot = ?')->execute([$slot]);
    json_salida(['ok' => true, 'slot' => $slot, 'version' => version_contenido($db)]);
}

/* ═════════════════════════════════════════════════════════════════
   RESTAURAR TODO
═════════════════════════════════════════════════════════════════ */
case 'restaurar': {
    if (!$esPost) json_error('Método no permitido.', 405);
    exigir_admin();
    if ((string)(cuerpo()['confirmacion'] ?? '') !== 'CONFIRMAR') {
        json_error('Falta la confirmación.', 400);
    }
    $db = bd();

    foreach ($db->query('SELECT slot, archivo FROM a1_media')->fetchAll() as $fila) {
        if (str_starts_with($fila['archivo'], $fila['slot'] . '--')) {
            @unlink(DIR_IMAGENES . '/' . $fila['archivo']);       // solo lo subido desde el panel
        }
    }
    $db->exec('DELETE FROM a1_media');
    $db->exec('DELETE FROM a1_config');

    $st = $db->prepare('INSERT INTO a1_config (clave, valor) VALUES (?,?)');
    foreach (textos_por_defecto() as $clave => $valor) $st->execute([$clave, $valor]);

    /* Volver a detectar las imágenes originales de la carpeta */
    $st = $db->prepare('INSERT INTO a1_media (slot, archivo, mime, bytes, ancho, alto) VALUES (?,?,?,?,?,?)');
    foreach (slots_imagen() as $slot) {
        $ruta = buscar_archivo_slot($slot);
        if ($ruta === null) continue;
        $info = @getimagesize($ruta);
        if ($info === false) continue;
        $st->execute([$slot, basename($ruta), $info['mime'], (int)filesize($ruta), (int)$info[0], (int)$info[1]]);
    }
    json_salida(['ok' => true, 'version' => version_contenido($db)]);
}

/* ═════════════════════════════════════════════════════════════════
   CAMBIAR CONTRASEÑA
═════════════════════════════════════════════════════════════════ */
case 'clave': {
    if (!$esPost) json_error('Método no permitido.', 405);
    exigir_admin();
    $actual = (string)(cuerpo()['actual'] ?? '');
    $nueva  = (string)(cuerpo()['nueva']  ?? '');

    $db   = bd();
    $fila = $db->query('SELECT clave_hash FROM a1_acceso WHERE id = 1')->fetch();
    if (!$fila || !password_verify($actual, $fila['clave_hash'])) {
        json_error('La contraseña actual no es correcta.', 403);
    }
    if (mb_strlen($nueva) < 10) json_error('La nueva contraseña debe tener al menos 10 caracteres.', 400);
    if ($nueva === $actual)     json_error('La nueva contraseña debe ser distinta de la actual.', 400);

    $db->prepare('UPDATE a1_acceso SET clave_hash = ? WHERE id = 1')
       ->execute([password_hash($nueva, PASSWORD_DEFAULT)]);
    json_salida(['ok' => true]);
}

default:
    json_error('Acción no reconocida: «' . $accion . '».', 404);
}

/* ═════════════════════════════════════════════════════════════════
   Reduce una imagen demasiado grande. Devuelve [ancho, alto] finales.
═════════════════════════════════════════════════════════════════ */
function redimensionar(string $ruta, int $tipo, int $ancho, int $alto, int $anchoMax): array {
    try {
        $origen = match ($tipo) {
            IMAGETYPE_PNG  => @imagecreatefrompng($ruta),
            IMAGETYPE_JPEG => @imagecreatefromjpeg($ruta),
            IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($ruta) : false,
            default        => false,
        };
        if (!$origen) return [$ancho, $alto];

        $nuevoAncho = $anchoMax;
        $nuevoAlto  = (int)round($alto * ($anchoMax / $ancho));
        $destino    = imagecreatetruecolor($nuevoAncho, $nuevoAlto);

        if ($tipo === IMAGETYPE_PNG || $tipo === IMAGETYPE_WEBP) {
            imagealphablending($destino, false);
            imagesavealpha($destino, true);
            imagefill($destino, 0, 0, imagecolorallocatealpha($destino, 0, 0, 0, 127));
        }
        imagecopyresampled($destino, $origen, 0, 0, 0, 0, $nuevoAncho, $nuevoAlto, $ancho, $alto);

        $guardado = match ($tipo) {
            IMAGETYPE_PNG  => imagepng($destino, $ruta, 7),
            IMAGETYPE_JPEG => imagejpeg($destino, $ruta, 86),
            IMAGETYPE_WEBP => imagewebp($destino, $ruta, 86),
            default        => false,
        };
        imagedestroy($origen);
        imagedestroy($destino);
        return $guardado ? [$nuevoAncho, $nuevoAlto] : [$ancho, $alto];
    } catch (Throwable) {
        return [$ancho, $alto];   // si GD falla, se conserva el original
    }
}
