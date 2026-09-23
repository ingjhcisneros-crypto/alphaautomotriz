/* Definición de los siete registros operativos: columnas exactas (tal como aparecen en los archivos
   de especificación, con tildes y mayúsculas), tipo de dato, lista de valores y campo interno. */

const F = (h, k, tipo, extra) => Object.assign({ h, k, tipo }, extra || {});

export const REGISTROS = {
  correctivo: {
    id: 'correctivo', tabla: 'mantenimiento_correctivo', nombre: 'Mantenimiento correctivo', archivo: '03_Registro_de_mantenimiento_correctivo',
    componente: 'Disponibilidad', inicio: 'fecha_hora_falla', fin: 'fecha_hora_reinicio', dur: 'tiempo_parada_h', equipo: 'equipo_id',
    columnas: [
      F('N°', 'n', 'texto', { opcional: true }),
      F('Fecha y hora de falla', 'fecha_hora_falla', 'fecha', { req: true }),
      F('Fecha y hora de reinicio', 'fecha_hora_reinicio', 'fecha', { req: true }),
      F('Tiempo de parada (h)', 'tiempo_parada_h', 'num', { fmt: '0.0' }),
      F('Turno', 'turno', 'lista', { lista: 'turno', req: true }),
      F('Máquina', 'equipo_id', 'equipo', { lista: 'maquina', req: true }),
      F('Sistema afectado', 'sistema_afectado', 'lista', { lista: 'sistema_afectado', req: true }),
      F('Componente fallado', 'componente_fallado', 'texto'),
      F('Modo de falla', 'modo_falla', 'lista', { lista: 'modo_falla', req: true }),
      F('Causa raíz', 'causa_raiz', 'lista', { lista: 'causa_raiz', req: true }),
      F('Solución aplicada', 'solucion_aplicada', 'texto'),
      F('Técnico responsable', 'tecnico_responsable', 'texto')
    ],
    ejemplos: [
      ['EJEMPLO', '03/06/2025 17:30', '03/06/2025 19:12', 1.7, '2', 'Autoclave', 'Mecánico', 'Empaquetadura de puerta', 'Fuga', 'Fatiga de material', 'Reemplazo de empaquetadura', 'Apellido, Nombre'],
      ['EJEMPLO', '04/06/2025 09:10', '04/06/2025 11:40', 2.5, '1', 'Extruder', 'Térmico', 'Resistencia de barril', 'Sobrecalentamiento', 'Fin de vida útil', 'Cambio de resistencia', 'Apellido, Nombre'],
      ['EJEMPLO', '05/06/2025 00:40', '05/06/2025 01:30', 0.8, '2', 'Molino', 'Mecánico', 'Chumacera', 'Desgaste', 'Falta de lubricación', 'Lubricación y ajuste', 'Apellido, Nombre']
    ]
  },
  paradas_cortas: {
    id: 'paradas_cortas', tabla: 'paradas_cortas', nombre: 'Paradas cortas y mantenimiento autónomo', archivo: '07_Registro_de_paradas_cortas_y_mantenimiento_autonomo',
    componente: 'Rendimiento', inicio: 'fecha_hora_parada', fin: 'fecha_hora_reinicio', dur: 'tiempo_parada_h', equipo: 'equipo_id',
    columnas: [
      F('N°', 'n', 'texto', { opcional: true }),
      F('Fecha y hora de parada', 'fecha_hora_parada', 'fecha', { req: true }),
      F('Fecha y hora de reinicio', 'fecha_hora_reinicio', 'fecha', { req: true }),
      F('Tiempo de parada (h)', 'tiempo_parada_h', 'num', { fmt: '0.0' }),
      F('Turno', 'turno', 'lista', { lista: 'turno', req: true }),
      F('Máquina', 'equipo_id', 'equipo', { lista: 'maquina', req: true }),
      F('Tipo de evento', 'tipo_evento', 'lista', { lista: 'tipo_evento', req: true }),
      F('Condición detectada', 'condicion_detectada', 'texto'),
      F('Actividad CIL asociada', 'actividad_cil', 'lista', { lista: 'actividad_cil', req: true }),
      F('Acción ejecutada', 'accion_ejecutada', 'texto'),
      F('Operador responsable', 'operador_responsable', 'lista', { lista: 'operador_responsable' })
    ],
    ejemplos: [
      ['EJEMPLO', '03/06/2025 15:00', '03/06/2025 15:24', 0.4, '1', 'Molino', 'Suciedad en componente', 'Polvo adherido en rodillos', 'Limpieza', 'Limpieza con brocha', 'Quispe Mamani, Luis Alberto'],
      ['EJEMPLO', '03/06/2025 23:30', '03/06/2025 23:48', 0.3, '2', 'Extruder', 'Acumulación de material', 'Residuos en la boquilla', 'Limpieza', 'Limpieza con espátula', 'Rojas Ccahuana, Miguel Ángel'],
      ['EJEMPLO', '04/06/2025 20:00', '04/06/2025 20:24', 0.4, '2', 'Molino', 'Falta de lubricación', 'Chumaceras secas', 'Lubricación', 'Aplicación de grasa', 'Salazar Huamán, Percy Iván']
    ]
  },
  cambio_formato: {
    id: 'cambio_formato', tabla: 'cambio_formato', nombre: 'Cambio de formato (SMED)', archivo: '06_Registro_de_cambio_de_formato_y_analisis_SMED',
    componente: 'Disponibilidad', inicio: 'fecha_hora_parada', fin: 'fecha_hora_reinicio', dur: 'tiempo_setup_h', equipo: 'equipo_id',
    columnas: [
      F('N° de cambio', 'n_cambio', 'texto', { req: true }),
      F('Fecha y hora de parada', 'fecha_hora_parada', 'fecha', { req: true }),
      F('Fecha y hora de reinicio', 'fecha_hora_reinicio', 'fecha', { req: true }),
      F('Tiempo de setup (h)', 'tiempo_setup_h', 'num', { fmt: '0.0' }),
      F('Turno', 'turno', 'lista', { lista: 'turno', req: true }),
      F('Máquina', 'equipo_id', 'equipo', { lista: 'maquina', req: true }),
      F('Formato saliente', 'formato_saliente', 'lista', { lista: 'formato', req: true }),
      F('Formato entrante', 'formato_entrante', 'lista', { lista: 'formato', req: true }),
      F('N° de operarios asignados', 'n_operarios_asignados', 'num', { fmt: '0' }),
      F('Actividad', 'actividad', 'texto', { req: true }),
      F('Duración de la actividad (h)', 'duracion_actividad_h', 'num', { req: true, positivo: true, fmt: '0.00' }),
      F('Clasificación actual', 'clasificacion_actual', 'lista', { lista: 'clasificacion', req: true }),
      F('Clasificación propuesta', 'clasificacion_propuesta', 'lista', { lista: 'clasificacion' }),
      F('Técnica de conversión', 'tecnica_conversion', 'lista', { lista: 'tecnica_conversion' }),
      F('Duración propuesta (h)', 'duracion_propuesta_h', 'num', { fmt: '0.00' }),
      F('N° de operarios', 'n_operarios', 'num', { fmt: '0' }),
      F('Ejecutable en paralelo', 'ejecutable_paralelo', 'lista', { lista: 'si_no' })
    ],
    ejemplos: [
      ['EJEMPLO', '03/06/2025 08:00', '03/06/2025 09:30', 1.5, '1', 'Autoclave', 'Lámina reforzada 5/16"', 'Lámina alto impacto 1/2"', 1, 'Ajuste de parámetros de curado', 0.43, 'Interna', 'Interna', 'Estandarización de ajustes', 0.21, 1, 'No'],
      ['EJEMPLO', '03/06/2025 08:00', '03/06/2025 09:30', 1.5, '1', 'Autoclave', 'Lámina reforzada 5/16"', 'Lámina alto impacto 1/2"', 1, 'Calibración de sensores de presión', 0.37, 'Interna', 'Externa', 'Operaciones en paralelo', 0, 1, 'Sí'],
      ['EJEMPLO', '03/06/2025 08:00', '03/06/2025 09:30', 1.5, '1', 'Autoclave', 'Lámina reforzada 5/16"', 'Lámina alto impacto 1/2"', 1, 'Preparación de racks', 0.2, 'Externa', 'Externa', 'Ninguna', 0.2, 1, 'Sí']
    ]
  },
  no_conformidades: {
    id: 'no_conformidades', tabla: 'no_conformidades', nombre: 'No conformidades de calidad', archivo: '04_Registro_de_no_conformidades_de_calidad',
    componente: 'Calidad', inicio: 'fecha_hora_deteccion', fin: null, dur: 'demora_h', equipo: 'equipo_id',
    columnas: [
      F('N°', 'n', 'texto', { opcional: true }),
      F('Fecha y hora de detección', 'fecha_hora_deteccion', 'fecha', { req: true }),
      F('Turno', 'turno', 'lista', { lista: 'turno', req: true }),
      F('Máquina', 'equipo_id', 'equipo', { lista: 'maquina_producto', req: true }),
      F('Código de causa', 'codigo_causa', 'codigo', { req: true }),
      F('Descripción de la causa', 'descripcion_causa', 'texto'),
      F('Tipo de no conformidad', 'tipo_no_conformidad', 'lista', { lista: 'tipo_nc', req: true }),
      F('Cantidad afectada', 'cantidad_afectada', 'num', { req: true, positivo: true, fmt: '0.00' }),
      F('Unidad', 'unidad', 'lista', { lista: 'unidad_nc', req: true }),
      F('Láminas equivalentes', 'laminas_equivalentes', 'num', { fmt: '0.00' }),
      F('Demora (h)', 'demora_h', 'num', { req: true, positivo: true, fmt: '0.000' }),
      F('Origen de la causa', 'origen_causa', 'lista', { lista: 'origen_causa', req: true })
    ],
    ejemplos: [
      ['EJEMPLO', '02/06/2025 10:50', '1', 'Prensa 1', 'R-P2', 'Inhomogeneidad de la mezcla agravada por calentamiento no uniforme', 'Reproceso', 2, 'lám', 2, 0.574, 'Variación térmica del vapor'],
      ['EJEMPLO', '02/06/2025 18:20', '2', 'Extruder', 'R-E1', 'Mezcla de caucho no homogénea por fluctuaciones de temperatura en el barril del extrusor', 'Reproceso', 90, 'kg', 1.26, 0.08, 'Variación térmica del vapor'],
      ['EJEMPLO', '03/06/2025 01:05', '2', 'Autoclave', 'DC-A4', 'Superficie rugosa por contaminantes o condiciones inadecuadas de proceso', 'Defecto de calidad', 3, 'lám', 3, 0.9, 'Propia del equipo']
    ]
  },
  equipos_auxiliares: {
    id: 'equipos_auxiliares', tabla: 'equipos_auxiliares', nombre: 'Fallas en equipos auxiliares', archivo: '08_Registro_de_fallas_en_equipos_auxiliares',
    componente: 'Disponibilidad', inicio: 'fecha_hora_falla', fin: 'fecha_hora_reinicio', dur: 'tiempo_parada_h', equipo: 'equipo_auxiliar',
    columnas: [
      F('N°', 'n', 'texto', { opcional: true }),
      F('Fecha y hora de falla', 'fecha_hora_falla', 'fecha', { req: true }),
      F('Fecha y hora de reinicio', 'fecha_hora_reinicio', 'fecha', { req: true }),
      F('Tiempo de parada (h)', 'tiempo_parada_h', 'num', { fmt: '0.0' }),
      F('Turno', 'turno', 'lista', { lista: 'turno', req: true }),
      F('Equipo auxiliar', 'equipo_auxiliar', 'lista', { lista: 'equipo_auxiliar', req: true }),
      F('Etapa afectada', 'etapa_afectada', 'lista', { lista: 'etapa_afectada', req: true }),
      F('Sistema afectado', 'sistema_afectado', 'lista', { lista: 'sistema_afectado', req: true }),
      F('Componente fallado', 'componente_fallado', 'texto'),
      F('Modo de falla', 'modo_falla', 'lista', { lista: 'modo_falla', req: true }),
      F('Causa raíz', 'causa_raiz', 'lista', { lista: 'causa_raiz', req: true }),
      F('Solución aplicada', 'solucion_aplicada', 'texto'),
      F('Técnico responsable', 'tecnico_responsable', 'texto')
    ],
    ejemplos: [
      ['EJEMPLO', '05/06/2025 14:10', '05/06/2025 15:46', 1.6, '1', 'Compresor de aire', 'Prensado y curado', 'Neumático', 'Válvula de admisión', 'Rotura', 'Fatiga de material', 'Reemplazo de válvula', 'Apellido, Nombre'],
      ['EJEMPLO', '14/06/2025 00:20', '14/06/2025 02:56', 2.6, '2', 'Tablero eléctrico general', 'Toda la línea', 'Eléctrico', 'Interruptor termomagnético', 'Sobrecalentamiento', 'Sobrecarga operativa', 'Reemplazo del interruptor', 'Apellido, Nombre'],
      ['EJEMPLO', '20/06/2025 15:35', '20/06/2025 16:53', 1.3, '1', 'Torre de enfriamiento', 'Laminado', 'Mecánico', 'Bomba de recirculación', 'Desgaste', 'Falta de lubricación', 'Cambio de rodamientos', 'Apellido, Nombre']
    ]
  },
  operacion_en_vacio: {
    id: 'operacion_en_vacio', tabla: 'operacion_en_vacio', nombre: 'Operación en vacío', archivo: '05_Analisis_de_operacion_en_vacio',
    componente: 'Rendimiento', inicio: null, fin: null, dur: null, equipo: 'equipo_id', sinFecha: true,
    columnas: [
      F('N°', 'n', 'texto', { opcional: true }),
      F('Máquina', 'equipo_id', 'equipo', { lista: 'maquina', req: true }),
      F('Arranque de jornada (min)', 'minutos_arranque', 'num', { req: true, noNegativo: true, fmt: '0' }),
      F('Después de setup (min)', 'minutos_post_setup', 'num', { req: true, noNegativo: true, fmt: '0' }),
      F('Sustento del arranque de jornada', 'sustento_arranque', 'texto'),
      F('Sustento del tiempo posterior al setup', 'sustento_post_setup', 'texto')
    ],
    ejemplos: [
      ['1', 'Molino', 12, 6, 'EJEMPLO · Rodaje de rodillos y calentamiento por fricción', 'Ajuste de abertura entre rodillos'],
      ['2', 'Extruder', 25, 15, 'EJEMPLO · Calentamiento del barril hasta 85 °C', 'Reestabilización del perfil térmico'],
      ['3', 'Caldero 1', 45, 10, 'EJEMPLO · Purga, barrido y subida de presión a 10 bar', 'Ajuste de presión']
    ]
  },
  reuniones_emergencia: {
    /* Paradas de emergencia (antes «reuniones de emergencia»; la tabla conserva su nombre interno para no
       migrar datos). La categoría es una lista abierta: un valor nuevo se acepta con advertencia. */
    id: 'reuniones_emergencia', tabla: 'reuniones_emergencia', nombre: 'Paradas de emergencia', archivo: 'Registro_de_paradas_de_emergencia',
    componente: 'Disponibilidad', inicio: 'fecha', fin: null, dur: 'duracion_h', equipo: 'equipos_afectados',
    columnas: [
      F('N°', 'n', 'texto', { opcional: true }),
      F('Fecha y hora', 'fecha', 'fecha', { req: true }),
      F('Turno', 'turno', 'lista', { lista: 'turno', req: true }),
      F('Duración (h)', 'duracion_h', 'num', { req: true, positivo: true, fmt: '0.00' }),
      F('Motivo', 'motivo', 'texto', { req: true }),
      F('Categoría', 'categoria', 'lista', { lista: 'categoria_parada_emergencia', abierta: true }),
      F('Equipos afectados', 'equipos_afectados', 'lista', { lista: 'alcance_reunion', req: true })
    ],
    ejemplos: [
      ['1', '09/06/2025 10:00', '1', 2, 'EJEMPLO · Reclamo de cliente por lote observado', 'Calidad', 'Toda la línea'],
      ['2', '16/06/2025 19:00', '2', 2, 'EJEMPLO · Accidente en zona de prensas', 'Seguridad', 'Toda la línea'],
      ['3', '23/06/2025 11:00', '1', 2, 'EJEMPLO · Corte de energía de la red', 'Energía y servicios', 'Toda la línea']
    ]
  }
};

export const ORDEN_REGISTROS = ['correctivo', 'cambio_formato', 'reuniones_emergencia', 'equipos_auxiliares', 'paradas_cortas', 'operacion_en_vacio', 'no_conformidades'];

/* Criterio de duplicado: misma fecha y hora, mismo equipo y misma duración. El registro SMED guarda una
   fila por actividad del mismo cambio, por eso añade la actividad; el de vacío es un parámetro por equipo. */
export function claveDuplicado(defId, r) {
  const d = REGISTROS[defId];
  if (defId === 'operacion_en_vacio') return r.equipo_id;
  const dur = defId === 'cambio_formato' ? r.duracion_actividad_h : r.horas;
  let k = [r[d.inicio], r[d.equipo], (+dur || 0).toFixed(3)].join('|');
  if (defId === 'cambio_formato') k += '|' + r.n_cambio + '|' + r.actividad;
  if (defId === 'no_conformidades') k += '|' + r.codigo_causa + '|' + r.cantidad_afectada;
  return k;
}

/* Fila de ejemplo de la plantilla: se reconoce por la marca EJEMPLO. */
export function esFilaEjemplo(defId, valores) {
  return Object.values(valores).some(v => typeof v === 'string' && /^EJEMPLO\b/.test(v.trim()));
}
