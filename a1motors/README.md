# 🚗 A1 Motors Perú — Guía completa

**Versión 4.0** · Backend PHP + MySQL · Hostinger
Desarrollado por **Ing. Cisneros Jhober**

> Esta es la **única** guía del proyecto. Sustituye a los tres README anteriores
> (el general y los de las dos carpetas de imágenes).

---

## 📑 Índice

1. [Qué fallaba y qué se arregló](#1)
2. [Instalación en Hostinger, paso a paso](#2)
3. [Tus imágenes actuales: no hay que renombrar nada](#3)
4. [Cómo usar el panel](#4)
5. [Los botones de WhatsApp](#5)
6. [Seguridad](#6)
7. [Si algo no funciona](#7)
8. [Ficha técnica](#8)

---

<a id="1"></a>
## 1 · Qué fallaba y qué se arregló

### El problema que reportaste

> *«Cuando yo cambio en mi PC se ve el cambio, pero en otra máquina sigue tal cual.»*

Ese síntoma —los cambios se ven **sólo en la computadora donde los hiciste**— sale
siempre de la misma causa: **el contenido se estaba guardando en el navegador, no en
el servidor**. Cada navegador tiene su propia despensa (`localStorage`); lo que metes
ahí no sale de esa máquina, ni siquiera a otro navegador del mismo equipo.

En la versión anterior quedaban restos de ese sistema y, sobre todo, **cuando el
guardado en el servidor fallaba nadie se enteraba**: el error se escribía en la
consola del navegador y la página seguía como si nada. Tú veías el cambio aplicado
en pantalla (porque el JavaScript lo pintaba al momento) y dabas por hecho que se
había guardado.

### Cómo está resuelto ahora

| | Antes | Ahora |
|---|---|---|
| **Dónde vive el contenido** | Mezcla de navegador y base de datos | **Sólo en el servidor** (MySQL + carpeta `imagenes/`) |
| **Al guardar** | «Guardado» aunque fallara | Se **vuelve a leer del servidor** y sólo entonces se confirma |
| **Si algo falla** | Silencio | Se dice qué campo falló y por qué |
| **Imágenes** | Dentro de MySQL (`LONGBLOB`) | **Archivos en `imagenes/`**, servidos directos por Apache |
| **Contraseña del panel** | Escrita en `js/main.js`, a la vista de cualquiera | Cifrada en la base de datos, cambiable desde el panel |
| **Clave de la API** | `load.php` se la entregaba a **cualquier visitante** | No existe: sesión de servidor + ficha CSRF |
| **Bloqueo por intentos** | En el navegador (se saltaba borrando datos) | En el servidor, por IP |
| **Imágenes administrables** | 17 | **35 — todas las del sitio** |

> **Lo importante:** el panel ya no puede decirte «guardado» si no se guardó.
> Después de escribir, vuelve a preguntarle al servidor como si fuera otro visitante
> y compara. Si no coincide, te lo dice.

### Además, en esta versión

- **Una sola carpeta `imagenes/`** — se acabaron `imagenes_Fijo/` e `imagenes_Variables/`.
- **Las 35 imágenes son administrables**, incluidos logos de marcas, fotos de
  clientes, logos de empresas y los vehículos de portada.
- **Textos editables**: cifras, testimonios, dirección, horario, nombres de marcas y empresas.
- **Menú móvil** — antes en celular sencillamente no había navegación.
- **Visor de promociones**: al tocar una promo se amplía, en vez del salto brusco
  que se salía de la caja y tapaba las vecinas.
- **Cursor personalizado** con 4 estilos y **4 colores de acento**, elegibles desde el panel.
- **Ritmo visual unificado**: un único sistema de espaciado, tamaños y acentos.
- **`admin/diagnostico.php`**: comprueba todo de punta a punta y te dice qué falta.

---

<a id="2"></a>
## 2 · Instalación en Hostinger, paso a paso

### Paso 1 — Crear la base de datos

En **hPanel → Bases de datos → MySQL**, crea una base de datos y anota los tres datos:

| Dato | Ejemplo |
|---|---|
| Nombre de la base de datos | `u123456789_a1motors` |
| Usuario | `u123456789_admin` |
| Contraseña | la que elijas |

### Paso 2 — Poner esos datos en `config.php`

Abre `admin/config.php` y cambia **sólo estas 4 líneas**:

```php
define('DB_HOST', 'localhost');                  // en Hostinger casi siempre es 'localhost'
define('DB_NAME', 'u123456789_a1motors');        // ← tu base de datos
define('DB_USER', 'u123456789_admin');           // ← tu usuario
define('DB_PASS', 'tu_contraseña_real');         // ← tu contraseña
```

> No hace falta tocar nada más en todo el proyecto.

### Paso 3 — Subir los archivos

En **Administrador de archivos → `public_html/`**, sube el ZIP y extráelo.
`index.html` tiene que quedar **directamente dentro de `public_html/`**:

```
public_html/
├── index.html
├── README.md
├── css/estilos.css
├── js/app.js
├── imagenes/            ← TODAS las imágenes del sitio
│   └── .htaccess
└── admin/
    ├── config.php       ← el único archivo que editas
    ├── nucleo.php       ← conexión, sesión y catálogo de contenido
    ├── api.php          ← lo que usa el panel para leer y guardar
    ├── instalar.php     ← ejecutar una vez, luego borrar
    ├── diagnostico.php  ← comprobación, luego borrar
    └── .htaccess
```

### Paso 4 — Permisos de la carpeta de imágenes

Clic derecho sobre `imagenes/` → **Permisos** → `755`.
Sin esto no se pueden subir imágenes desde el panel.

### Paso 5 — Instalar

Visita en el navegador:

```
https://tudominio.com/admin/instalar.php
```

Debe salir todo en verde. Crea las tablas y detecta las imágenes que ya tengas.

### Paso 6 — Comprobar

```
https://tudominio.com/admin/diagnostico.php
```

Revisa PHP, la base de datos, las tablas, los permisos y hace una **prueba real**
de escritura y lectura. Si algo está mal, te dice exactamente qué y cómo arreglarlo.

### Paso 7 — Limpiar

Cuando todo esté en verde, **borra del servidor**:

- `admin/instalar.php`
- `admin/diagnostico.php`

(Guárdalos en tu computadora: si algún día necesitas revisar, los vuelves a subir.)

---

<a id="3"></a>
## 3 · Tus imágenes actuales: no hay que renombrar nada

Copia **todo** lo que tenías en `imagenes_Fijo/` y en `imagenes_Variables/`
dentro de la carpeta `imagenes/`. Ya está: el instalador **reconoce los nombres
antiguos** y los coloca en su sitio automáticamente.

| Nombre que tenías | Dónde aparece ahora |
|---|---|
| `logo.png`, `favicon.png` | Igual |
| `bmw.png` | Vehículo de portada |
| `auto-sistemas.png` | Vehículo de «Sistemas» |
| `servicio-gnv.png` … `servicio-planchado.png` | Las 6 imágenes de servicios |
| `promo-mecanica-1.png` … `promo-pintura-3.png` | Las 9 promociones |
| `empresa-melconsi.png`, `empresa-campofesac.png`, `empresa-operadores.png` | Empresas 1, 2 y 3 |
| `marca-toyota.png` … `marca-ford.png` | Marcas 1 a 10 |
| `cliente-carlos.png`, `cliente-operadores.png`, `cliente-valeria.png` | Clientes 1, 2 y 3 |

En `instalar.php` verás cuántas detectó: *«Imágenes detectadas en la carpeta: 35 de 35»*.

> **A partir de ahí, olvídate de los nombres.** Todo se cambia desde el panel,
> que guarda cada archivo con su propio nombre y versión.

### Medidas recomendadas

| Grupo | Proporción | Mínimo | Formato |
|---|---|---|---|
| Logo | libre | 400×110 px | PNG transparente |
| Favicon | 1:1 | 128×128 px | PNG |
| Vehículos (portada y sistemas) | libre | 900×560 px | PNG transparente |
| Servicios | 5:3 | 600×360 px | JPG o PNG |
| Promociones | 4:3 | 900×675 px | JPG o PNG |
| Logos de empresas y marcas | libre | alto 80 px | PNG transparente |
| Fotos de clientes | 1:1 | 500×500 px | JPG o PNG |

Máximo **8 MB** por imagen. Si subes una más ancha de 2000 px se reduce sola.

---

<a id="4"></a>
## 4 · Cómo usar el panel

### Entrar

1. Abre tu web.
2. Haz **4 clics seguidos sobre el logo** de la cabecera.
3. Escribe la contraseña.

Contraseña inicial: la que pusiste en `CLAVE_INICIAL` dentro de `admin/config.php`.
**Cámbiala desde el panel** la primera vez que entres.

### Las cuatro pestañas

| Pestaña | Qué contiene |
|---|---|
| 🖼️ **Imágenes** | Las 35 imágenes del sitio, agrupadas por sección |
| ⌨️ **Textos y contactos** | WhatsApp, redes, dirección, horario, cifras, testimonios, nombres de marcas |
| ✨ **Apariencia** | Estilo del cursor y color de acento |
| 🛡️ **Seguridad** | Cambiar la contraseña del panel |

### Cómo se guarda

1. Cambia lo que quieras: las imágenes muestran una **vista previa** y el contador
   de abajo lleva la cuenta de los cambios pendientes.
2. Pulsa **GUARDAR CAMBIOS**.
3. El sistema guarda, **vuelve a leer del servidor** y compara.
4. Sólo si todo coincide aparece:
   *«✅ N cambios guardados y verificados»*.

Si algo no pasa la validación, te dice **qué campo y por qué**
(por ejemplo: *«Mecánica General: debe tener exactamente 9 dígitos»*)
y el campo se marca en rojo. Lo demás sí se guarda.

### Restaurar todo

El botón **Restaurar todo** (escribiendo `CONFIRMAR`) devuelve textos y enlaces a
sus valores originales y borra las imágenes subidas desde el panel. Las que
subiste por FTP a `imagenes/` se conservan.

---

<a id="5"></a>
## 5 · Los botones de WhatsApp

El taller tiene **tres números**, uno por área. Como el sitio no puede adivinar qué
necesita cada visitante, **le pregunta**:

```
Visitante pulsa el botón verde flotante
        ↓
«¿En qué podemos ayudarte?»
        ↓
┌─ Mecánica General ──────→ wa_mecanica
├─ Planchado y Pintura ───→ wa_pintura
└─ Conversiones GNV/GLP ──→ wa_gnv
```

Lo mismo pasa con **«Solicitar»** en cada promoción (ya sabe el área, va directo) y
con el **formulario de cita** (pregunta el área al final y envía todos los datos ya
formateados).

Todos los mensajes empiezan con el encabezado que configures en el panel:

```
🌐 *Hola, vengo de la web de A1 Motors*

📋 *Solicitud de servicio:*
👤 *Nombre:* Juan Pérez
🚘 *Vehículo:* Toyota Corolla 2019
🔖 *Placa:* ABC-123
🔧 *Servicio:* Afinamiento electrónico
```

Así distingues de un vistazo qué clientes llegan desde la web.

**Los tres números se cambian en el panel** → *Textos y contactos → WhatsApp por área*.
Se escriben con **9 dígitos, sin el +51** (el sistema lo añade solo).

---

<a id="6"></a>
## 6 · Seguridad

| Medida | Cómo funciona |
|---|---|
| **Contraseña** | Cifrada con `password_hash` en la base de datos. Nadie puede leerla, ni desde el código del navegador ni desde la base de datos. |
| **Sesión** | Sesión de PHP con cookie `HttpOnly` + `SameSite`. Caduca a las 2 horas sin actividad. |
| **Ficha CSRF** | Cada operación de guardado lleva una ficha única que sólo conoce tu sesión. |
| **Bloqueo por intentos** | 3 fallos → 1 hora bloqueado. 3 más → 1 día. Y así sucesivamente. Se controla **por IP en el servidor**, así que no se salta cambiando de navegador ni borrando datos. |
| **Subidas** | Se verifica que el archivo sea una imagen de verdad (`getimagesize`), no basta con ponerle `.png`. Un PHP disfrazado de imagen se rechaza. |
| **Carpeta `imagenes/`** | Su `.htaccess` desactiva la ejecución de código: aunque alguien lograra colar un script, ahí no se ejecutaría. |
| **`config.php`** | Bloqueado por `.htaccess`: no es accesible desde el navegador. |

> Las contraseñas que pongas en `config.php` nunca llegan al navegador.
> Compruébalo: abre tu web, pulsa `Ctrl+U` y busca — no están.

---

<a id="7"></a>
## 7 · Si algo no funciona

**Lo primero, siempre:** abre `admin/diagnostico.php`. Casi siempre te dice la causa exacta.

| Síntoma | Causa habitual | Solución |
|---|---|---|
| «El servidor respondió algo que no es JSON» | El hosting no está ejecutando PHP, o hay un error en `config.php` | Revisa las 4 líneas de `config.php` y que PHP esté en 8.0 o superior |
| «Las credenciales todavía tienen los valores de ejemplo» | No editaste `config.php` | Paso 2 de la instalación |
| «La carpeta imagenes/ no tiene permiso de escritura» | Permisos | Ponla en `755` |
| «No se encuentra admin/api.php» | No se subió la carpeta `admin/` | Vuelve a subirla completa |
| «Todavía no se ha instalado el panel» | Falta ejecutar el instalador | Abre `admin/instalar.php` |
| «Acceso bloqueado temporalmente» | Demasiados intentos fallidos | Espera, o sube `instalar.php` y usa *«Olvidé la contraseña»* |
| La imagen sale como un cuadro gris | Ese hueco aún no tiene archivo | Súbela desde el panel |
| «La imagen supera el límite de subida del servidor» | `upload_max_filesize` de PHP | Reduce la imagen, o súbelo en hPanel → Configuración PHP |

### Olvidaste la contraseña del panel

1. Sube otra vez `admin/instalar.php`.
2. Ábrelo en el navegador.
3. Pulsa **«Olvidé la contraseña del panel — restablecer»**.
4. Vuelve a la contraseña de `CLAVE_INICIAL` y elimina los bloqueos.
5. **Borra `instalar.php` del servidor** y cambia la contraseña desde el panel.

---

<a id="8"></a>
## 8 · Ficha técnica

| Elemento | Detalle |
|---|---|
| PHP | **8.0 o superior** (recomendado 8.1+) |
| Base de datos | MySQL / MariaDB vía PDO |
| Tablas | `a1_config` · `a1_media` · `a1_acceso` · `a1_intentos` |
| Imágenes | Archivos en `imagenes/`, metadatos en `a1_media` |
| Huecos de imagen | 35 |
| Campos de texto | 43 |
| Tamaño máximo por imagen | 8 MB (`MAX_MB_IMAGEN` en `config.php`) |
| Reducción automática | Por encima de 2000 px de ancho, si hay GD |
| Tipografías | Goldman + Space Grotesk (Google Fonts) |
| Iconos | Font Awesome 6 (CDN) |
| Dependencias JS | Ninguna — JavaScript puro |
| Refresco automático | Cada 45 s se comprueba si hubo cambios |

### Cómo añadir un hueco de imagen o un campo nuevo

Todo el contenido administrable está definido **en un solo sitio**:
`admin/nucleo.php`, funciones `catalogo_imagenes()` y `catalogo_textos()`.

1. Añade la entrada en el catálogo.
2. En `index.html`, pon `data-img="tu-slot"` o `data-txt="tu_clave"` donde deba salir.

El panel se dibuja solo a partir del catálogo y el servidor valida contra ese mismo
catálogo, así que **no pueden quedar desajustados**. No hay listas que mantener en
dos archivos a la vez — que era justo de donde salían los fallos de la versión anterior.

---

## 📞 Soporte

**Ing. Cisneros Jhober**
[+51 997 042 903](https://wa.me/51997042903?text=Hola%2C%20necesito%20soporte%20con%20la%20web%20de%20A1%20Motors)
