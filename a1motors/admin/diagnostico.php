<?php
/* ═══════════════════════════════════════════════════════════════════
   A1 MOTORS PERÚ — Diagnóstico
   admin/diagnostico.php

   Comprueba de punta a punta que el sitio guarda de verdad:
   PHP, base de datos, tablas, carpeta de imágenes, subida y lectura.
   Bórralo del servidor cuando termines de verificar.
═══════════════════════════════════════════════════════════════════ */
require_once __DIR__ . '/nucleo.php';
header('Content-Type: text/html; charset=utf-8');

$pruebas = [];
$errores = 0; $avisos = 0;

function comprobar(string $nombre, callable $fn): void {
    global $pruebas, $errores, $avisos;
    try {
        [$estado, $detalle] = $fn();
    } catch (Throwable $e) {
        $estado = 'error'; $detalle = $e->getMessage();
    }
    if ($estado === 'error') $errores++;
    if ($estado === 'aviso') $avisos++;
    $pruebas[] = [$estado, $nombre, $detalle];
}

/* ── Entorno ─────────────────────────────────────────────────── */
comprobar('Versión de PHP', function () {
    $v = PHP_VERSION;
    if (version_compare($v, '8.0', '<')) {
        return ['error', "PHP $v es demasiado antiguo: hace falta 8.0 o superior. "
                       . "Cámbialo en hPanel → Avanzado → Configuración PHP."];
    }
    return version_compare($v, '8.1', '>=')
        ? ['ok', "PHP $v"]
        : ['aviso', "PHP $v funciona, pero conviene subir a 8.1 o superior en hPanel → Avanzado → Configuración PHP."];
});

comprobar('Extensión PDO MySQL', fn() => extension_loaded('pdo_mysql')
    ? ['ok', 'Disponible']
    : ['error', 'Falta pdo_mysql. Actívala en hPanel → Avanzado → Configuración PHP → Extensiones.']);

comprobar('Extensión GD (redimensionado)', fn() => extension_loaded('gd')
    ? ['ok', 'Disponible: las imágenes muy grandes se reducen solas.']
    : ['aviso', 'No está. Todo funciona igual, pero las imágenes se guardarán con su tamaño original.']);

comprobar('Sesiones de PHP', function () {
    iniciar_sesion();
    return session_status() === PHP_SESSION_ACTIVE
        ? ['ok', 'Activas — el panel puede mantener la sesión de administrador.']
        : ['error', 'No se pudieron iniciar. El panel no podrá autenticarte.'];
});

comprobar('Límites de subida', function () {
    $sube = ini_get('upload_max_filesize');
    $post = ini_get('post_max_size');
    $mb   = (int)$sube;
    return $mb >= MAX_MB_IMAGEN
        ? ['ok', "upload_max_filesize = $sube · post_max_size = $post"]
        : ['aviso', "El servidor admite hasta $sube por archivo, menos que los " . MAX_MB_IMAGEN . " MB configurados. Baja MAX_MB_IMAGEN en config.php o sube el límite en hPanel."];
});

/* ── Configuración ───────────────────────────────────────────── */
comprobar('Credenciales en config.php', fn() => CONFIG_LISTA
    ? ['ok', 'Base de datos «' . DB_NAME . '» · usuario «' . DB_USER . '»']
    : ['error', 'Todavía tienen los valores de ejemplo. Edita las 4 líneas de admin/config.php.']);

/* ── Base de datos ───────────────────────────────────────────── */
$db = null;
comprobar('Conexión con MySQL', function () use (&$db) {
    $db = bd();
    $v = $db->query('SELECT VERSION() AS v')->fetch()['v'];
    return ['ok', "Conectado. Servidor: $v"];
});

if ($db) {
    foreach (['a1_config' => 'textos, números y enlaces',
              'a1_media'  => 'imágenes',
              'a1_acceso' => 'contraseña del panel',
              'a1_intentos' => 'bloqueo por intentos fallidos'] as $tabla => $para) {
        comprobar("Tabla $tabla", function () use ($db, $tabla, $para) {
            $st = $db->prepare('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?');
            $st->execute([$tabla]);
            if (!(int)$st->fetch()['n']) return ['error', "No existe. Ejecuta admin/instalar.php."];
            $n = (int)$db->query("SELECT COUNT(*) AS n FROM `$tabla`")->fetch()['n'];
            return ['ok', "$n registros — $para"];
        });
    }

    comprobar('Contraseña del panel', function () use ($db) {
        $f = $db->query('SELECT clave_hash FROM a1_acceso WHERE id = 1')->fetch();
        if (!$f) return ['error', 'Sin registrar. Ejecuta admin/instalar.php.'];
        if (password_verify(CLAVE_INICIAL, $f['clave_hash'])) {
            return ['aviso', 'Sigue siendo la contraseña inicial de config.php. Cámbiala desde la pestaña «Seguridad» del panel.'];
        }
        return ['ok', 'Guardada cifrada y ya fue cambiada respecto a la inicial.'];
    });

    comprobar('Escritura real en la base de datos', function () use ($db) {
        $marca = 'd' . bin2hex(random_bytes(4));
        $db->prepare('INSERT INTO a1_config (clave, valor) VALUES (?,?)
                      ON DUPLICATE KEY UPDATE valor=VALUES(valor)')->execute(['__diag', $marca]);
        $leido = $db->query("SELECT valor FROM a1_config WHERE clave='__diag'")->fetch()['valor'] ?? null;
        $db->exec("DELETE FROM a1_config WHERE clave='__diag'");
        return $leido === $marca
            ? ['ok', 'Se escribió un dato y se volvió a leer idéntico.']
            : ['error', 'Se escribió pero no se pudo releer. Revisa los permisos del usuario MySQL.'];
    });

    comprobar('Contenido publicado', function () use ($db) {
        $t = leer_textos($db);
        $i = leer_imagenes($db);
        $n = count(slots_imagen());
        return ['ok', count($t) . ' textos · ' . count($i) . " de $n imágenes con archivo · versión " . version_contenido($db)];
    });
}

/* ── Carpeta de imágenes ─────────────────────────────────────── */
comprobar('Carpeta imagenes/', function () {
    if (!is_dir(DIR_IMAGENES)) return ['error', 'No existe. Créala dentro de public_html.'];
    if (!is_writable(DIR_IMAGENES)) return ['error', 'Sin permiso de escritura. Ponla en 755.'];
    $n = count(array_filter(scandir(DIR_IMAGENES) ?: [], fn($f) => preg_match('/\.(png|jpe?g|webp|gif)$/i', $f)));
    return ['ok', "Escritura permitida · $n archivos de imagen dentro"];
});

comprobar('Prueba real de guardado de archivo', function () {
    if (!is_dir(DIR_IMAGENES) || !is_writable(DIR_IMAGENES)) return ['error', 'Omitida: la carpeta no admite escritura.'];
    $png  = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
    $ruta = DIR_IMAGENES . '/.diagnostico.png';
    if (@file_put_contents($ruta, $png) === false) return ['error', 'No se pudo crear un archivo de prueba.'];
    $info = @getimagesize($ruta);
    $leido = @file_get_contents($ruta);
    @unlink($ruta);
    if ($info === false)     return ['error', 'El archivo se creó pero no se pudo leer como imagen.'];
    if ($leido !== $png)     return ['error', 'El archivo leído no coincide con el escrito.'];
    return ['ok', 'Se creó, se leyó y se borró una imagen de prueba correctamente.'];
});

comprobar('config.php protegido', function () {
    $htaccess = __DIR__ . '/.htaccess';
    if (!is_file($htaccess)) return ['aviso', 'Falta admin/.htaccess. Súbelo para bloquear el acceso directo a config.php.'];
    return str_contains((string)file_get_contents($htaccess), 'config.php')
        ? ['ok', 'admin/.htaccess bloquea el acceso directo a config.php.']
        : ['aviso', 'admin/.htaccess existe pero no menciona config.php.'];
});

$estadoGeneral = $errores ? 'error' : ($avisos ? 'aviso' : 'ok');
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>A1 Motors — Diagnóstico</title>
<link href="https://fonts.googleapis.com/css2?family=Goldman:wght@400;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root { --c:#33ceff; --muted:#7aaccb; }
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Space Grotesk',system-ui,sans-serif; background:#000; color:#dff2ff; padding:48px 20px; line-height:1.6; }
  .caja { max-width:880px; margin:0 auto; }
  h1 { font-family:'Goldman',cursive; font-size:1.5rem; color:#fff; letter-spacing:1px; }
  h1 span { color:var(--c); }
  .sub { color:var(--muted); font-size:.86rem; margin:6px 0 30px; }
  .resumen { padding:22px 26px; border-radius:18px; margin-bottom:26px;
             background:rgba(51,206,255,.07); border:1px solid rgba(51,206,255,.32); }
  .resumen.aviso { background:rgba(255,204,0,.07); border-color:rgba(255,204,0,.3); }
  .resumen.error { background:rgba(255,80,80,.08); border-color:rgba(255,80,80,.35); }
  .resumen h2 { font-family:'Goldman',cursive; font-size:1.1rem; color:#fff; margin-bottom:6px; }
  .resumen p  { font-size:.88rem; color:var(--muted); }
  table { width:100%; border-collapse:collapse; }
  tr { border-bottom:1px solid rgba(51,206,255,.1); }
  td { padding:13px 10px; vertical-align:top; font-size:.88rem; }
  td.e { width:40px; text-align:center; font-size:1rem; }
  td.n { width:34%; color:#fff; font-weight:600; }
  td.d { color:var(--muted); font-size:.82rem; }
  tr.error td.n { color:#ff9c9c; }
  tr.aviso td.n { color:#ffdd66; }
  .acciones { margin-top:30px; display:flex; gap:12px; flex-wrap:wrap; }
  .btn { display:inline-block; padding:11px 24px; border-radius:50px; background:var(--c); color:#000;
         font-weight:700; font-size:.85rem; text-decoration:none; }
  .btn.ghost { background:transparent; color:var(--muted); border:1px solid rgba(122,172,203,.3); }
  .nota { margin-top:26px; padding:16px 20px; border-radius:14px; font-size:.82rem; color:var(--muted);
          background:rgba(255,204,0,.05); border:1px solid rgba(255,204,0,.2); }
  code { background:#0b0b0b; border:1px solid rgba(51,206,255,.2); padding:2px 7px; border-radius:6px; color:var(--c); font-size:.8rem; }
</style>
</head>
<body>
<div class="caja">
  <h1>A1 <span>MOTORS</span> — Diagnóstico</h1>
  <div class="sub">Comprobación completa del sistema · <?= date('d/m/Y H:i') ?></div>

  <div class="resumen <?= $estadoGeneral === 'ok' ? '' : $estadoGeneral ?>">
    <h2><?= $estadoGeneral === 'ok' ? '✅ Todo funciona correctamente'
          : ($estadoGeneral === 'aviso' ? '⚠️ Funciona, con ' . $avisos . ' recomendación(es)'
          : '❌ Hay ' . $errores . ' problema(s) que resolver') ?></h2>
    <p><?= $estadoGeneral === 'error'
        ? 'Mientras haya errores, los cambios del panel no se guardarán para todos los visitantes.'
        : 'Los cambios que hagas en el panel quedan en la base de datos y los ve todo el mundo, desde cualquier dispositivo.' ?></p>
  </div>

  <table>
  <?php foreach ($pruebas as [$estado, $nombre, $detalle]): ?>
    <tr class="<?= $estado === 'ok' ? '' : htmlspecialchars($estado) ?>">
      <td class="e"><?= $estado === 'ok' ? '✅' : ($estado === 'error' ? '❌' : '⚠️') ?></td>
      <td class="n"><?= htmlspecialchars($nombre) ?></td>
      <td class="d"><?= htmlspecialchars($detalle) ?></td>
    </tr>
  <?php endforeach; ?>
  </table>

  <div class="acciones">
    <a class="btn" href="diagnostico.php">Volver a comprobar</a>
    <a class="btn ghost" href="../index.html">Ver la web</a>
    <a class="btn ghost" href="instalar.php">Instalador</a>
  </div>

  <div class="nota">
    🔒 Cuando todo esté en verde, <strong>borra del servidor</strong> <code>admin/instalar.php</code> y <code>admin/diagnostico.php</code>.
    No hacen falta para el funcionamiento diario y dan información útil a un atacante.
  </div>
</div>
</body>
</html>
