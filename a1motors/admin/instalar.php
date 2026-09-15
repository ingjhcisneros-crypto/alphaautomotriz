<?php
/* ═══════════════════════════════════════════════════════════════════
   A1 MOTORS PERÚ — Instalador
   admin/instalar.php

   Ejecútalo UNA vez tras subir los archivos:
     https://tudominio.com/admin/instalar.php
   Es seguro repetirlo: no borra nada de lo que ya hayas guardado.
═══════════════════════════════════════════════════════════════════ */
require_once __DIR__ . '/nucleo.php';
header('Content-Type: text/html; charset=utf-8');

$pasos = [];
$fallo = null;
function paso(string $tipo, string $texto, string $detalle = ''): void {
    global $pasos; $pasos[] = [$tipo, $texto, $detalle];
}

try {
    /* ── 1. Conexión ────────────────────────────────────────────── */
    $db = bd();
    paso('ok', 'Conexión con MySQL establecida', 'Base de datos: ' . DB_NAME);

    /* ── 2. Tablas ──────────────────────────────────────────────── */
    $db->exec("
        CREATE TABLE IF NOT EXISTS a1_config (
            clave        VARCHAR(100) NOT NULL PRIMARY KEY,
            valor        LONGTEXT     NOT NULL,
            actualizado  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    paso('ok', 'Tabla a1_config lista', 'Guarda los textos, números y enlaces.');

    $db->exec("
        CREATE TABLE IF NOT EXISTS a1_media (
            slot         VARCHAR(80)  NOT NULL PRIMARY KEY,
            archivo      VARCHAR(255) NOT NULL,
            mime         VARCHAR(60)  NOT NULL DEFAULT 'image/png',
            bytes        INT UNSIGNED NOT NULL DEFAULT 0,
            ancho        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            alto         SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            actualizado  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    paso('ok', 'Tabla a1_media lista', 'Registra qué archivo de imagenes/ corresponde a cada hueco del sitio.');

    $db->exec("
        CREATE TABLE IF NOT EXISTS a1_acceso (
            id           TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            clave_hash   VARCHAR(255) NOT NULL,
            actualizado  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    paso('ok', 'Tabla a1_acceso lista', 'Guarda la contraseña del panel cifrada (nunca en texto plano).');

    $db->exec("
        CREATE TABLE IF NOT EXISTS a1_intentos (
            ip               VARCHAR(45) NOT NULL PRIMARY KEY,
            intentos         SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            ciclos           SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            bloqueado_hasta  DATETIME NULL,
            visto            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    paso('ok', 'Tabla a1_intentos lista', 'Bloqueo por intentos fallidos, del lado del servidor.');

    /* ── 3. Contraseña del panel ────────────────────────────────── */
    $hay = (int)$db->query('SELECT COUNT(*) AS n FROM a1_acceso WHERE id = 1')->fetch()['n'];
    if ($hay === 0) {
        $st = $db->prepare('INSERT INTO a1_acceso (id, clave_hash) VALUES (1, ?)');
        $st->execute([password_hash(CLAVE_INICIAL, PASSWORD_DEFAULT)]);
        paso('ok', 'Contraseña del panel registrada', 'Se usó CLAVE_INICIAL de config.php. Cámbiala desde el panel cuando quieras.');
    } else {
        paso('info', 'La contraseña del panel ya estaba registrada', 'No se tocó. Si la olvidaste, usa el botón del final de esta página.');
    }

    /* ── 4. Textos por defecto ──────────────────────────────────── */
    $st = $db->prepare('INSERT IGNORE INTO a1_config (clave, valor) VALUES (?, ?)');
    $nuevos = 0;
    foreach (textos_por_defecto() as $clave => $valor) {
        $st->execute([$clave, $valor]);
        $nuevos += $st->rowCount();
    }
    $total = (int)$db->query('SELECT COUNT(*) AS n FROM a1_config')->fetch()['n'];
    paso('ok', "Textos por defecto: $nuevos nuevos", "La tabla tiene ahora $total campos editables.");

    /* ── 5. Carpeta de imágenes ─────────────────────────────────── */
    if (!is_dir(DIR_IMAGENES)) @mkdir(DIR_IMAGENES, 0755, true);
    if (!is_dir(DIR_IMAGENES)) {
        paso('error', 'No existe la carpeta imagenes/', 'Créala manualmente dentro de public_html con permisos 755.');
        $fallo = true;
    } elseif (!is_writable(DIR_IMAGENES)) {
        paso('error', 'La carpeta imagenes/ no tiene permiso de escritura',
             'En el Administrador de archivos de Hostinger: clic derecho sobre imagenes → Permisos → 755.');
        $fallo = true;
    } else {
        $prueba = DIR_IMAGENES . '/.escritura-' . bin2hex(random_bytes(4));
        $puede  = @file_put_contents($prueba, 'ok') !== false;
        @unlink($prueba);
        if ($puede) paso('ok', 'La carpeta imagenes/ acepta escritura', 'Las imágenes que subas desde el panel se guardarán aquí.');
        else { paso('error', 'No se pudo escribir en imagenes/', 'Ajusta los permisos a 755.'); $fallo = true; }
    }

    /* ── 6. Registrar las imágenes ya presentes en la carpeta ───── */
    if (is_dir(DIR_IMAGENES)) {
        $st = $db->prepare(
            'INSERT INTO a1_media (slot, archivo, mime, bytes, ancho, alto) VALUES (?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE archivo=VALUES(archivo), mime=VALUES(mime), bytes=VALUES(bytes),
                                     ancho=VALUES(ancho), alto=VALUES(alto)');
        $ya = $db->query('SELECT slot FROM a1_media')->fetchAll(PDO::FETCH_COLUMN);
        $ya = array_flip($ya);
        $detectadas = 0; $faltantes = [];
        foreach (slots_imagen() as $slot) {
            if (isset($ya[$slot])) continue;                       // ya administrada: no tocar
            $encontrado = buscar_archivo_slot($slot);   // acepta también los nombres antiguos
            if ($encontrado === null) { $faltantes[] = $slot; continue; }
            $info = @getimagesize($encontrado);
            if ($info === false) { $faltantes[] = $slot; continue; }
            $st->execute([$slot, basename($encontrado), $info['mime'],
                          (int)filesize($encontrado), (int)$info[0], (int)$info[1]]);
            $detectadas++;
        }
        $n = count(slots_imagen());
        paso($detectadas ? 'ok' : 'info', "Imágenes detectadas en la carpeta: $detectadas de $n",
             $faltantes
                ? 'Sin archivo todavía: ' . implode(', ', array_slice($faltantes, 0, 40))
                  . (count($faltantes) > 40 ? ' …' : '')
                  . '. No es un problema: súbelas desde el panel cuando quieras.'
                : 'Todos los huecos tienen imagen.');
    }

    /* ── 7. Prueba real de escritura y lectura ──────────────────── */
    $db->prepare('INSERT INTO a1_config (clave, valor) VALUES (?,?)
                  ON DUPLICATE KEY UPDATE valor=VALUES(valor)')
       ->execute(['__prueba', 'v' . time()]);
    $leido = $db->query("SELECT valor FROM a1_config WHERE clave='__prueba'")->fetch();
    $db->exec("DELETE FROM a1_config WHERE clave='__prueba'");
    if ($leido) paso('ok', 'Prueba de escritura y lectura superada', 'La base de datos guarda y devuelve los datos correctamente.');
    else { paso('error', 'La prueba de escritura y lectura falló', 'El usuario de MySQL podría no tener permisos de INSERT.'); $fallo = true; }

} catch (Throwable $e) {
    $fallo = true;
    paso('error', 'La instalación se detuvo', $e->getMessage());
}

/* ── Restablecer contraseña (solo desde esta página) ──────────── */
$avisoClave = '';
if (($_POST['accion'] ?? '') === 'restablecer-clave' && !$fallo) {
    try {
        $db = bd();
        $db->prepare('INSERT INTO a1_acceso (id, clave_hash) VALUES (1, ?)
                      ON DUPLICATE KEY UPDATE clave_hash=VALUES(clave_hash)')
           ->execute([password_hash(CLAVE_INICIAL, PASSWORD_DEFAULT)]);
        $db->exec('DELETE FROM a1_intentos');
        $avisoClave = 'Contraseña restablecida al valor de CLAVE_INICIAL y bloqueos eliminados.';
    } catch (Throwable $e) {
        $avisoClave = 'No se pudo restablecer: ' . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>A1 Motors — Instalación</title>
<link href="https://fonts.googleapis.com/css2?family=Goldman:wght@400;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root { --c:#33ceff; --ok:#33ceff; --err:#ff6b6b; --warn:#ffcc00; --muted:#7aaccb; }
  *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Space Grotesk',system-ui,sans-serif; background:#000; color:#dff2ff;
         padding:48px 20px; line-height:1.6; }
  .caja { max-width:840px; margin:0 auto; }
  h1 { font-family:'Goldman',cursive; font-size:1.5rem; color:#fff; letter-spacing:1px; margin-bottom:6px; }
  h1 span { color:var(--c); }
  .sub { color:var(--muted); font-size:.86rem; margin-bottom:34px; }
  .fila { display:flex; gap:14px; padding:14px 18px; border-radius:14px; margin-bottom:10px;
          background:rgba(51,206,255,.04); border:1px solid rgba(51,206,255,.14); }
  .fila.error { background:rgba(255,80,80,.07); border-color:rgba(255,80,80,.3); }
  .fila.info  { background:rgba(255,204,0,.06); border-color:rgba(255,204,0,.22); }
  .ico { font-size:1.05rem; line-height:1.5; flex-shrink:0; }
  .txt { font-weight:600; color:#fff; font-size:.92rem; }
  .det { color:var(--muted); font-size:.8rem; margin-top:3px; }
  .panel { margin-top:30px; padding:26px 28px; border-radius:18px;
           background:rgba(51,206,255,.06); border:1px solid rgba(51,206,255,.3); }
  .panel.mal { background:rgba(255,80,80,.07); border-color:rgba(255,80,80,.35); }
  .panel h2 { font-family:'Goldman',cursive; font-size:1.05rem; color:#fff; margin-bottom:10px; }
  .panel p { font-size:.88rem; color:var(--muted); margin-bottom:8px; }
  code { background:#0b0b0b; border:1px solid rgba(51,206,255,.2); padding:2px 8px;
         border-radius:6px; color:var(--c); font-size:.84rem; }
  ol { margin:12px 0 0 20px; } ol li { margin-bottom:8px; font-size:.88rem; color:var(--muted); }
  .btn { display:inline-block; margin-top:14px; padding:11px 24px; border-radius:50px;
         background:var(--c); color:#000; font-weight:700; font-size:.85rem;
         text-decoration:none; border:none; cursor:pointer; font-family:'Space Grotesk',sans-serif; }
  .btn.ghost { background:transparent; color:var(--muted); border:1px solid rgba(122,172,203,.3); }
  .aviso { margin-top:14px; padding:10px 16px; border-radius:10px; font-size:.84rem;
           background:rgba(255,204,0,.08); border:1px solid rgba(255,204,0,.25); color:#ffcc00; }
</style>
</head>
<body>
<div class="caja">
  <h1>A1 <span>MOTORS</span> — Instalación</h1>
  <div class="sub">Preparando la base de datos y la carpeta de imágenes.</div>

<?php foreach ($pasos as [$tipo, $texto, $detalle]): ?>
  <div class="fila <?= $tipo === 'ok' ? '' : htmlspecialchars($tipo) ?>">
    <div class="ico"><?= $tipo === 'ok' ? '✅' : ($tipo === 'error' ? '❌' : 'ℹ️') ?></div>
    <div>
      <div class="txt"><?= htmlspecialchars($texto) ?></div>
      <?php if ($detalle): ?><div class="det"><?= htmlspecialchars($detalle) ?></div><?php endif; ?>
    </div>
  </div>
<?php endforeach; ?>

<?php if ($avisoClave): ?>
  <div class="aviso"><?= htmlspecialchars($avisoClave) ?></div>
<?php endif; ?>

<?php if (!$fallo): ?>
  <div class="panel">
    <h2>✅ Instalación completada</h2>
    <p>Tu sitio ya guarda los cambios en la base de datos, así que <strong>todos los visitantes ven lo mismo</strong>, desde cualquier computadora o celular.</p>
    <ol>
      <li>Abre <code>admin/diagnostico.php</code> y confirma que todo salga en verde.</li>
      <li>Entra a tu web y haz <strong>4 clics seguidos sobre el logo</strong> para abrir el panel.</li>
      <li>Cambia la contraseña desde la pestaña <strong>Seguridad</strong> del panel.</li>
      <li>Cuando termines, <strong>borra del servidor</strong> <code>admin/instalar.php</code> y <code>admin/diagnostico.php</code>.</li>
    </ol>
    <a class="btn" href="diagnostico.php">Ir al diagnóstico →</a>
    <a class="btn ghost" href="../index.html">Ver la web</a>
    <form method="post" style="margin-top:18px;" onsubmit="return confirm('¿Restablecer la contraseña del panel al valor de CLAVE_INICIAL en config.php?');">
      <input type="hidden" name="accion" value="restablecer-clave">
      <button class="btn ghost" type="submit">Olvidé la contraseña del panel — restablecer</button>
    </form>
  </div>
<?php else: ?>
  <div class="panel mal">
    <h2>❌ Falta resolver algo</h2>
    <p>Revisa los puntos en rojo de arriba. Lo más habitual:</p>
    <ol>
      <li>Las 4 líneas de <code>admin/config.php</code> no coinciden con tu base de datos de Hostinger.</li>
      <li>La carpeta <code>imagenes/</code> no tiene permisos <code>755</code>.</li>
      <li>El usuario de MySQL no está asignado a la base de datos.</li>
    </ol>
    <a class="btn" href="instalar.php">Reintentar</a>
  </div>
<?php endif; ?>
</div>
</body>
</html>
