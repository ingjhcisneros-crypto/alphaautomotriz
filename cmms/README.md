# CMMS 4.0 · Línea de láminas antiabrasivas — v6 (OEE + simulación)

Entregable: **`dist/cmms_lexacaucho_v6.html`**. Es un solo archivo de 1.2 MB y funciona sin internet: fuentes, íconos, SheetJS, Chart.js y el worker de simulación van incluidos. Se abre con doble clic en Chrome o Edge. Usuario principal: `gutierres&cisneros@upc.pe`, clave `grupo29`.

```
npm install            # solo para desarrollar
npm run build          # regenera dist/cmms_lexacaucho_v6.html
npm test               # auditorías del núcleo (178 verificaciones)
node tests/e2e.mjs     # auditorías en Chromium sobre el HTML (89 verificaciones)
```

Las pruebas necesitan los diez Excel de especificación en `DIR_REF` (variable de entorno). Esos archivos se usan solo para armar datos de prueba y obtener los valores de referencia. **El sistema no siembra ningún registro operativo.**

---

## Auditoría 1 · Diagnóstico del avance v5

| Aspecto | Hallazgo |
|---|---|
| Módulos que funcionaban | Portal y usuarios por rol, animación de la línea sobre el calendario de turnos, especificaciones, plan maestro TPM, agenda y órdenes con cierre y evidencia, anomalías, administración de calendario, marca |
| Persistencia | **Ninguna.** Todo vivía en variables de memoria y se perdía al cerrar el navegador |
| Estructura | Un solo HTML de 2,819 líneas. El cálculo, la vista y los datos estaban mezclados en funciones globales |
| Dependencias | Google Fonts y Font Awesome se cargaban desde CDN, así que sin internet la app quedaba sin íconos ni tipografía |
| Deuda técnica | (1) Un IIFE sembraba **datos inventados** de fallas, setups, calidad y vacío. (2) El **OEE de línea era el promedio** de los OEE por máquina. (3) El vacío se estimaba con 10 mediciones y no se consideraba el camino crítico. (4) No existía el día de producción del turno 2. (5) Los valores estaban codificados (capacidad del autoclave 28 lám/h, lote de 3,000 kg). (6) Sin carga por Excel ni validación. (7) Claves de usuario en texto plano |
| Qué se conservó | La identidad visual (tokens de color, Orbitron/Poppins, rail y barra), la navegación, el portal, el plan, la agenda, las órdenes, las anomalías, la administración y la animación. Los parámetros de la animación ahora salen de la especificación |
| Qué se rehízo | El cálculo del OEE (vista «Cálculo del OEE» nueva, con el mismo recorrido de 6 etapas), la captura de paradas (reemplazada por los 7 registros), los datos sembrados (eliminados) y la persistencia |

**Decisión de persistencia: IndexedDB.** La planta opera sin internet estable y con un puesto de ingeniería, así que un backend agregaría un servidor que mantener sin resolver el problema real. IndexedDB guarda los datos en el equipo, sobrevive al cierre del navegador, soporta transacciones (el reemplazo en la carga completa es atómico) y el HTML sigue siendo portátil. Hay respaldo JSON completo y restauración en *Auditoría*. Si más adelante se necesita acceso multiusuario, basta reemplazar `src/app/db.js` por un cliente HTTP; el motor de cálculo no cambia.

## Estructura

```
src/core/      lógica pura, sin DOM (se prueba en Node)
  oee.js         motor ÚNICO del OEE por máquina y por línea
  calendario.js  días laborables, feriados, día de producción del turno 2
  registros.js   7 registros con columnas exactas de los adjuntos
  validacion.js  reglas de la sección 8.4 · lector.js (SheetJS, encabezado en fila 1 o 4)
  xlsx.js        escritor .xlsx propio con dataValidation · plantillas.js
  estadistica.js ajuste MLE, K-S, IC, t pareada/Welch · modelo.js · simulacion.js (DES)
  catalogos.js   semillas de catálogos y parámetros (se copian a la base una sola vez)
src/app/       db.js (IndexedDB), servicio.js (recálculo automático), ejecutor/worker, ui/*
src/legacy/    código v5 conservado (marcado, estilos, script sin los datos inventados)
tests/         auditorias.mjs, e2e.mjs, informe/ (JSON y capturas)
```

## Resultados de las auditorías

| # | Resultado |
|---|---|
| 2 | Las 7 tablas tienen todos los campos de la sección 7. Los 19 catálogos coinciden con la sección 8.2 y con las hojas «Listas» de los 5 registros adjuntos |
| 3 | Ejemplo 4.4 cargado con la plantilla del sistema: carga 4,543.4 h, bruto **4,019.7 h**, D **88.47 %**, R **96.30 %**, C **92.92 %**, OEE **79.17 %** |
| 4 | Los 3,816 registros de referencia pasan por la plantilla del sistema: D **76.42 %**, R **82.86 %**, C **87.93 %**, OEE **55.68 %**, **20,237** láminas, brecha **−27.69 pp** |
| 5 | Instalación nueva con 0 registros operativos, catálogos sembrados y parámetros editables en la interfaz |
| 6 | 7 plantillas con encabezados idénticos a los adjuntos, desplegables (verificados también con openpyxl), fechas `dd/mm/aaaa hh:mm`, 3 ejemplos en gris y hoja de instrucciones |
| 7 | Carga incremental: 309 registros la primera vez y 0 al repetir el archivo (309 duplicados). Carga completa: confirma, genera respaldo y reemplaza. El archivo con errores deliberados detecta las 8 filas con error y las 3 advertencias; el informe se descarga en Excel |
| 8 | Insertar un registro cambia el OEE; borrarlo lo devuelve al valor exacto. El recálculo es idempotente |
| 9 | Los 5 filtros cambian los 6 bloques. Tabla cruzada de 10 equipos × 12 meses más la línea. El clic abre el detalle correcto. 12 exportaciones (Excel y PNG). Tableta de 820 px sin desbordes |
| 10 | Suma de los registros = tablero, con diferencia de 0.000 h en las 6 categorías |
| 11 | Autoclave (167) y extrusora (126): suficiente, con K-S sobre 5 candidatos. Molino (5): limitada. Prensas y calderos individuales: insuficiente. Prensas agregadas (7 eventos, 9.3 h) y calderos agregados (4 eventos, 4.7 h) |
| 12 | El autoclave tiene la mayor utilización (≈ 60 %). El balance de tiempos cierra al 0.0000 %. Sin interbloqueos |
| 13 | 30 réplicas. OEE **55.64 %** [55.28–55.99], D 76.50 % [76.12–76.88], C 87.90 % [87.69–88.11], producción **20,222** [20,094–20,350] y correctivo 687.3 h: todos dentro de tolerancia y con un IC que contiene el valor real. **Rendimiento 82.73 % [82.63–82.83]: dentro de tolerancia (−0.12 pp); su IC queda a 0.03 pp de contener el 82.86 %** |
| 14 | E1 +3.76 pp · E2 +1.43 · E3 +5.13 · E4 +0.99 · E5 +5.13 (vacío 454.2 → 181.7 h) · E6 **+17.94 pp**, distinto de la suma de los individuales (16.44). Todas las mejoras son significativas (t pareada, 95 %). Margen de S/ 180 por lámina: E6 ≈ **S/ 1.12 millones** al año |
| Mejoras finales | El portal ya no muestra credenciales. El PDF de resultados se imprime desde un marco interno, sin ventana emergente. Los gráficos se repintan al cambiar de tema. Hay gestión de periodos y setup simulado por tipo de cambio |
| Seguridad | Las claves se guardan como SHA-256 (usuario:clave); ninguna queda en texto plano en la base. Crear o eliminar usuarios exige perfil de administrador; restablecer una clave exige la clave del usuario principal |

## Decisiones y discrepancias que conviene conocer

1. **Factor de las prensas en disponibilidad.** El prompt menciona un 8 %, pero el ejemplo verificado (hoja «6. Máquina vs línea», 685.9 h y 149.9 h) computa **0 h** para las prensas. Se dejó 0 para reproducir el ejemplo y el 8 % queda documentado y editable en *Parámetros*. Si se aplica, el OEE de línea baja a ≈ 55.4 %.
2. **Auxiliares del autoclave.** El consolidado dice 25.3 h y el prompt 25.4 h. Con el reparto de cada falla entre los equipos de la etapa afectada, los registros dan 25.58 h. Los cuatro porcentajes coinciden de todos modos; el ejemplo 4.4 exacto se verificó con datos de 25.4 h.
3. **Rendimiento 82.86 %.** El valor sin redondear es 82.8558 %: el prompt redondea los tiempos intermedios y se obtiene 82.85. La diferencia es menor que 0.01 pp.
4. **Reuniones de emergencia.** No hay archivo adjunto. Se creó la plantilla (sección 7.9) y la prueba usa 72 reuniones de 2 h, que suman las 144 h del consolidado.
5. **Calibración de la simulación**, con parámetros del catálogo y no con ajustes arbitrarios:
   - El ciclo del autoclave usa la capacidad **demostrada** (7.7 lám/h), que es una pérdida de velocidad no registrada.
   - Los equipos en serie usan **acople rígido**, según la regla «la línea se detiene por completo».
   - Las fallas y microparadas no pueden ocurrir sobre un equipo ya detenido.
   - Las tres opciones son configurables. En modo «flujo con buffers», el modelo sobreestima la producción en un +18 %.
6. **Duplicados en el registro SMED.** Allí una fila corresponde a una actividad, así que el criterio de duplicado también incluye el N° de cambio y la actividad.
7. **SheetJS 0.18.5** (npm). La versión 0.20 del CDN oficial estuvo bloqueada por la red del entorno. La 0.18.5 solo se usa para leer archivos que el propio usuario sube.
8. **Sesgo residual del rendimiento simulado (−0.12 pp).** Es sistemático: el modelo calibra la velocidad con la capacidad demostrada del autoclave y absorbe físicamente los setups simultáneos, que la contabilidad de referencia suma. No se forzó un ajuste adicional para no sobreajustar el modelo.
9. **Periodos.** En *Parámetros* se crea un periodo nuevo (copia los parámetros del activo y genera los feriados nacionales) y se cambia el periodo activo. Cada registro pertenece a su periodo; al volver a uno anterior, sus registros siguen intactos.
10. **Setup simulado por tipo de cambio.** Cada cambio de formato sortea su tipo (saliente → entrante) según la frecuencia del registro y usa una triangular por equipo y tipo cuando hay 3 o más cambios de ese tipo.
11. **Limitaciones conocidas:** solo probado en Chrome/Edge (en Firefox, un archivo abierto desde el disco puede no conservar los datos); un equipo por base local, sin acceso multiusuario simultáneo; el calendario de la simulación reparte el tiempo de carga por día sin modelar por separado almuerzos y capacitación (los totales coinciden); SheetJS 0.18.5 tiene vulnerabilidades conocidas y solo lee archivos del propio usuario.
