<?php
/* ═══════════════════════════════════════════════════════════════════
   A1 MOTORS PERÚ — Configuración
   admin/config.php

   ⚠️  ESTE ES EL ÚNICO ARCHIVO QUE DEBES EDITAR.
   Copia los datos desde:  hPanel → Bases de datos → MySQL → Ver detalles
═══════════════════════════════════════════════════════════════════ */

/* ── 1. BASE DE DATOS (obligatorio) ───────────────────────────── */
define('DB_HOST', 'localhost');                 // Hostinger: casi siempre 'localhost'
define('DB_NAME', 'TU_BASE_DE_DATOS');          // ← ej: u123456789_a1motors
define('DB_USER', 'TU_USUARIO');                // ← ej: u123456789_admin
define('DB_PASS', 'TU_CONTRASENA');             // ← la contraseña de esa base de datos

/* ── 2. CLAVE INICIAL DEL PANEL ───────────────────────────────── */
/* Solo se usa la primera vez (al ejecutar instalar.php).
   Después se cambia desde el propio panel y esta línea deja de tener efecto. */
define('CLAVE_INICIAL', '123A1PeruA1motors-Ronal890');

/* ── 3. AJUSTES OPCIONALES ────────────────────────────────────── */
define('MAX_MB_IMAGEN', 8);                     // Tamaño máximo por imagen subida
define('ANCHO_MAX_IMAGEN', 2000);               // Se reduce automáticamente si excede (requiere GD)

/* ═══════════════════════════════════════════════════════════════
   No edites nada debajo de esta línea.
═══════════════════════════════════════════════════════════════ */
define('DB_CHARSET', 'utf8mb4');
define('RAIZ_SITIO',  dirname(__DIR__));
define('DIR_IMAGENES', RAIZ_SITIO . DIRECTORY_SEPARATOR . 'imagenes');
define('URL_IMAGENES', 'imagenes/');
define('CONFIG_LISTA', DB_NAME !== 'TU_BASE_DE_DATOS' && DB_USER !== 'TU_USUARIO' && DB_PASS !== 'TU_CONTRASENA');
