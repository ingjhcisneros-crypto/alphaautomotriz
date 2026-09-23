/* Semillas de instalación: catálogos (extraídos de las hojas «Listas» de los archivos de especificación)
   y parámetros del periodo. Estos valores se copian a la base de datos una sola vez; a partir de ahí
   se leen y editan desde la base, nunca desde aquí. No contiene registros operativos. */
import { feriadosPeru } from './calendario.js';

export const EQUIPOS_SEMILLA = [
  { id: 'MOL', codigo: 'MOL', nombre: 'Molino', descripcion: 'Molino de 2 rodillos 26″ × 84″', etapa: 'Molienda', topologia: 'serie', capacidad_ficha: 730, capacidad_demostrada: 660, unidad: 'kg/h', activo: true, orden: 1 },
  { id: 'EXT', codigo: 'EXT', nombre: 'Extruder', descripcion: 'Extrusora 150 mm cabezal plano', etapa: 'Laminado', topologia: 'serie', capacidad_ficha: 700, capacidad_demostrada: 630, unidad: 'kg/h', activo: true, orden: 2 },
  { id: 'PR1', codigo: 'PR1', nombre: 'Prensa 1', descripcion: 'Prensa de platos 5.00 × 1.50 m', etapa: 'Prensado', topologia: 'paralelo', capacidad_ficha: 2.2, capacidad_demostrada: 2.0, unidad: 'lám/h', activo: true, orden: 3 },
  { id: 'PR2', codigo: 'PR2', nombre: 'Prensa 2', descripcion: 'Prensa de platos 5.00 × 1.50 m', etapa: 'Prensado', topologia: 'paralelo', capacidad_ficha: 2.2, capacidad_demostrada: 2.0, unidad: 'lám/h', activo: true, orden: 4 },
  { id: 'PR3', codigo: 'PR3', nombre: 'Prensa 3', descripcion: 'Prensa de platos 5.00 × 1.50 m', etapa: 'Prensado', topologia: 'paralelo', capacidad_ficha: 2.2, capacidad_demostrada: 2.0, unidad: 'lám/h', activo: true, orden: 5 },
  { id: 'PR4', codigo: 'PR4', nombre: 'Prensa 4', descripcion: 'Prensa de platos 5.00 × 1.50 m', etapa: 'Prensado', topologia: 'paralelo', capacidad_ficha: 2.2, capacidad_demostrada: 2.0, unidad: 'lám/h', activo: true, orden: 6 },
  { id: 'PR5', codigo: 'PR5', nombre: 'Prensa 5', descripcion: 'Prensa de platos 5.00 × 1.50 m', etapa: 'Prensado', topologia: 'paralelo', capacidad_ficha: 2.2, capacidad_demostrada: 2.0, unidad: 'lám/h', activo: true, orden: 7 },
  { id: 'AUT', codigo: 'AUT', nombre: 'Autoclave', descripcion: 'Autoclave Ø 2.0 × 8.0 m', etapa: 'Curado', topologia: 'serie', capacidad_ficha: 8.0, capacidad_demostrada: 7.7, unidad: 'lám/h', activo: true, orden: 8 },
  { id: 'CAL1', codigo: 'CAL1', nombre: 'Caldero 1', descripcion: 'Caldero pirotubular 60 BHP · 10 bar · 184 °C', etapa: 'Soporte térmico', topologia: 'soporte', capacidad_ficha: null, capacidad_demostrada: null, unidad: '—', activo: true, orden: 9 },
  { id: 'CAL2', codigo: 'CAL2', nombre: 'Caldero 2', descripcion: 'Caldero pirotubular 60 BHP · 10 bar · 184 °C', etapa: 'Soporte térmico', topologia: 'soporte', capacidad_ficha: null, capacidad_demostrada: null, unidad: '—', activo: true, orden: 10 }
];

export const LISTAS_SEMILLA = {
  turno: ['1', '2'],
  maquina: ['Molino', 'Extruder', 'Prensa 1', 'Prensa 2', 'Prensa 3', 'Prensa 4', 'Prensa 5', 'Autoclave', 'Caldero 1', 'Caldero 2'],
  maquina_producto: ['Molino', 'Extruder', 'Prensa 1', 'Prensa 2', 'Prensa 3', 'Prensa 4', 'Prensa 5', 'Autoclave'],
  sistema_afectado: ['Mecánico', 'Eléctrico', 'Hidráulico', 'Neumático', 'Térmico', 'Control e instrumentación'],
  modo_falla: ['Desgaste', 'Rotura', 'Fuga', 'Obstrucción', 'Cortocircuito', 'Sobrecalentamiento', 'Desajuste', 'Corrosión'],
  causa_raiz: ['Falta de lubricación', 'Fatiga de material', 'Sobrecarga operativa', 'Ausencia de inspección', 'Incrustación', 'Contaminación', 'Vibración excesiva', 'Fin de vida útil'],
  tipo_evento: ['Acumulación de material', 'Suciedad en componente', 'Suciedad en instrumento', 'Desajuste mecánico', 'Falta de lubricación', 'Acumulación de condensado'],
  actividad_cil: ['Limpieza', 'Inspección', 'Lubricación', 'Ajuste'],
  operador_responsable: ['Quispe Mamani, Luis Alberto', 'Rojas Ccahuana, Miguel Ángel', 'Salazar Huamán, Percy Iván', 'Vargas Espinoza, Carlos Eduardo'],
  formato: ['Lámina estándar 1/4"', 'Lámina reforzada 5/16"', 'Lámina alto impacto 1/2"'],
  clasificacion: ['Interna', 'Externa'],
  tecnica_conversion: ['Preparación anticipada', 'Estandarización de ajustes', 'Sujeción rápida', 'Operaciones en paralelo', 'Eliminación de ajustes', 'Ninguna'],
  si_no: ['Sí', 'No'],
  tipo_nc: ['Reproceso', 'Defecto de calidad'],
  unidad_nc: ['kg', 'lám'],
  origen_causa: ['Variación térmica del vapor', 'Propia del equipo'],
  equipo_auxiliar: ['Compresor de aire', 'Torre de enfriamiento', 'Tecle de carga del autoclave', 'Tablero eléctrico general'],
  etapa_afectada: ['Laminado', 'Prensado y curado', 'Curado', 'Toda la línea'],
  categoria_parada_emergencia: ['Seguridad', 'Calidad', 'Producción', 'Mantenimiento', 'Energía y servicios', 'Logística y abastecimiento', 'Cliente', 'Recursos humanos', 'Otros'],
  alcance_reunion: ['Toda la línea', 'Molino', 'Extruder', 'Prensa 1', 'Prensa 2', 'Prensa 3', 'Prensa 4', 'Prensa 5', 'Autoclave', 'Caldero 1', 'Caldero 2']
};

/* Diccionario de causas de no conformidad (hoja «Causas» del registro de calidad). */
export const CODIGOS_CAUSA_SEMILLA = [
  ['DC-A1', 'Vulcanización incompleta que resulta en plancha blanda o flexible', 'Variación térmica del vapor'],
  ['DC-A2', 'Burbujas de aire que generan imperfecciones visibles en la superficie', 'Variación térmica del vapor'],
  ['DC-A3', 'Deformación por deficiente control de temperatura y presión', 'Variación térmica del vapor'],
  ['DC-A4', 'Superficie rugosa por contaminantes o condiciones inadecuadas de proceso', 'Propia del equipo'],
  ['DC-A5', 'Variación de grosor que afecta la funcionalidad del producto final', 'Variación térmica del vapor'],
  ['R-E1', 'Mezcla de caucho no homogénea por fluctuaciones de temperatura en el barril del extrusor', 'Variación térmica del vapor'],
  ['R-E2', 'Burbujas de aire atrapadas por deficiente control de temperatura en el sistema de extrusión', 'Variación térmica del vapor'],
  ['R-E3', 'Dispersión inadecuada de aditivos por perfiles de temperatura incorrectos', 'Variación térmica del vapor'],
  ['R-E4', 'Variación incontrolada de la viscosidad por inconsistencia en la temperatura de proceso', 'Variación térmica del vapor'],
  ['R-E5', 'Obstrucción en el dado de extrusión por enfriamiento desigual', 'Variación térmica del vapor'],
  ['R-M1', 'Mezcla no homogénea por desgaste desigual de los rodillos', 'Propia del equipo'],
  ['R-M2', 'Dispersión incompleta de aditivos por abertura de rodillos fuera de ajuste', 'Propia del equipo'],
  ['R-M3', 'Contaminación del compuesto por residuos adheridos en los rodillos', 'Propia del equipo'],
  ['R-M4', 'Variación de viscosidad por exceso de tiempo de masticación', 'Propia del equipo'],
  ['R-M5', 'Inclusión de material extraño por falta de limpieza entre lotes', 'Propia del equipo'],
  ['R-P1', 'Curado incompleto por distribución desigual de temperatura en la prensa', 'Variación térmica del vapor'],
  ['R-P2', 'Inhomogeneidad de la mezcla agravada por calentamiento no uniforme', 'Variación térmica del vapor'],
  ['R-P3', 'Adherencia prematura del material antes del conformado completo', 'Propia del equipo'],
  ['R-P4', 'Defectos superficiales por gradientes térmicos bruscos', 'Variación térmica del vapor'],
  ['R-P5', 'Vulcanización ineficiente por temperatura fuera del rango óptimo', 'Variación térmica del vapor']
].map(([codigo, descripcion, origen]) => ({ codigo, descripcion, origen }));

/* Formatos del producto patrón (ficha técnica). */
export const PRODUCTOS_SEMILLA = [
  { id: 'LA-250', formato: 'Lámina estándar 1/4"', largo_m: 5.0, ancho_m: 1.5, espesor_mm: 6.35, masa_kg: 71.44, participacion: 0.78, costo: 370, precio: 550 },
  { id: 'LA-312', formato: 'Lámina reforzada 5/16"', largo_m: 4.0, ancho_m: 1.5, espesor_mm: 7.9375, masa_kg: 71.44, participacion: 0.14, costo: 370, precio: 550 },
  { id: 'LA-500', formato: 'Lámina alto impacto 1/2"', largo_m: 2.5, ancho_m: 1.5, espesor_mm: 12.7, masa_kg: 71.44, participacion: 0.08, costo: 370, precio: 550 }
];

export function periodoSemilla() {
  const ini = '2025-06-01', fin = '2026-05-31';
  return {
    id: 'P2025', nombre: 'Junio 2025 – mayo 2026', fecha_inicio: ini, fecha_fin: fin, activo: true,
    feriados: feriadosPeru(ini, fin),
    hora_inicio: '08:00', hora_corte: '02:00', turnos_dia: 2, horas_turno: 9,
    horas_almuerzo: 1, horas_capacitacion: 2, semanas_capacitacion: 52.16, horas_mtto_planificado: 0,
    capacidad_cuello_botella: 8.0, equipo_cuello_botella: 'AUT', masa_unitaria_kg: 71.44,
    costo_unitario: 370, precio_venta: 550, margen_unitario: 180,
    benchmark_oee: 0.8337, benchmark_fuente: 'Senthil y Sudhakara Pandian (2022)', objetivo_oee: 0.75,
    retraso_encendido_min: 10, dia_capacitacion: 1
  };
}

/* Conversión de horas-máquina a horas de línea según la topología. Valores de la hoja
   «6. Máquina vs línea» del consolidado; editables desde Parámetros. */
export const CONFIG_SEMILLA = {
  id: 'general',
  factores: {
    serie: { disponibilidad: 1, rendimiento: 1, calidad: 1, reparto_calidad: false },
    paralelo: { disponibilidad: 0, rendimiento: 0, calidad: 1, reparto_calidad: true },
    soporte: { disponibilidad: 0, rendimiento: 0, calidad: 0, reparto_calidad: false }
  },
  probabilidad_coincidencia_paralelo: 0.08,
  factor_auxiliares_linea: 1,
  reparto_auxiliares: 'dividir',
  etapas_afectadas: {
    'Laminado': ['EXT'],
    'Prensado y curado': ['PR1', 'PR2', 'PR3', 'PR4', 'PR5', 'AUT'],
    'Curado': ['AUT'],
    'Toda la línea': ['MOL', 'EXT', 'PR1', 'PR2', 'PR3', 'PR4', 'PR5', 'AUT', 'CAL1', 'CAL2']
  },
  umbral_validez: { suficiente: 30, limitada: 5 },
  tolerancia_duracion_h: 0.05,
  /* Calendario de operación: rangos que no cuentan para nada y arranque del programa de mantenimiento. */
  omisiones: [{ desde: '2026-06-01', hasta: '2026-09-30', motivo: 'Fase de planeación (sin operación ni programa)' }],
  programa: { inicio: '2026-10-01', meses: 12 }
};

/* Parámetros del modelo de simulación (sección 11.1 y 11.5). */
export const SIM_SEMILLA = {
  id: 'simulacion',
  molino_lote_kg: 110, molino_ciclo_min: 10,
  extrusora_kg_h: 700, tolva_extrusora_kg: 220,
  prensa_ciclo_min: 27,
  buffer_curado: 16, autoclave_lote: 16, autoclave_ciclo_min: 120, ciclo_cuello_segun: 'demostrada',
  acabado_lam_h: 8.5, acabado_operarios: 3,
  calderos_minimos: 1, acople_serie: 'rigido', sincronizar_al_cuello: false,
  calentamiento_dias: 30, replicas: 30, replicas_max: 100, semilla: 12345, semilla_fija: true,
  confianza: 0.95, precision_relativa: 0.05,
  tolerancias: { oee_pp: 2, disponibilidad_pp: 2, rendimiento_pp: 2, calidad_pp: 2, produccion_rel: 0.03, correctivo_rel: 0.05, balance_rel: 0.001 }
};

/* Escenarios precargados. Cada porcentaje es editable; los marcados «datos» se calculan de los registros. */
export const ESCENARIOS_SEMILLA = [
  { id: 'E0', nombre: 'E0 — Línea base', intervencion: 'Ninguna', params: {} },
  { id: 'E1', nombre: 'E1 — Mantenimiento planificado', intervencion: 'Preventivo sobre extrusora y autoclave',
    params: { mtbf_mejora: { EXT: 0.5, AUT: 0.5 }, preventivo_h_mes: { EXT: 2, AUT: 2 } } },
  { id: 'E2', nombre: 'E2 — SMED', intervencion: 'Conversión de actividades internas a externas',
    params: { setup_reduccion: 'datos' } },
  { id: 'E3', nombre: 'E3 — Mantenimiento de calidad', intervencion: 'Control térmico de los calderos con sensórica',
    params: { nc_termica_eficacia: 1 } },
  { id: 'E4', nombre: 'E4 — Mantenimiento autónomo', intervencion: 'Rutinas CIL en el molino',
    params: { micro_reduccion: { MOL: 0.5 } } },
  { id: 'E5', nombre: 'E5 — Encendido anticipado de calderos', intervencion: 'Arranque 45 min antes del turno',
    params: { encendido_adelanto_min: 45, elimina_retraso: true } },
  { id: 'E6', nombre: 'E6 — Modelo TPM 4.0 integrado', intervencion: 'E1 + E2 + E3 + E4 + E5', params: { combinar: ['E1', 'E2', 'E3', 'E4', 'E5'] } }
];
