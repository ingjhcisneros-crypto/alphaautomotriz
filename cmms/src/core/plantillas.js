/* Plantillas de carga (.xlsx) generadas desde la definición de cada registro y los catálogos vigentes. */
import { REGISTROS } from './registros.js';
import { escribirLibro, EST, colLetra } from './xlsx.js';
import { parsearFecha } from './calendario.js';

const FILAS_VALIDADAS = 3000;

export function listasDeRegistro(defId, listas, codigos) {
  const def = REGISTROS[defId], out = [];
  def.columnas.forEach(c => {
    if (c.lista) out.push({ col: c, titulo: c.h, valores: listas[c.lista] || [] });
    if (c.tipo === 'codigo') out.push({ col: c, titulo: c.h, valores: (codigos || []).map(x => x.codigo) });
  });
  return out;
}

export function instrucciones(defId, periodo) {
  const def = REGISTROS[defId];
  const base = [
    'Registro: ' + def.nombre + '. Componente del OEE que alimenta: ' + def.componente + '.',
    'No modifique ni reordene los encabezados de la fila 1: el sistema rechaza el archivo si no coinciden exactamente.',
    'Las tres filas grises marcadas «EJEMPLO» son ilustrativas: elimínelas antes de subir (si se olvidan, el sistema las omite).',
    'Use las listas desplegables en las columnas categóricas; los valores válidos están en la hoja «Listas».'
  ];
  if (!def.sinFecha) base.push(
    'Fechas en formato dd/mm/aaaa hh:mm. Periodo declarado: ' + periodo.fecha_inicio + ' a ' + periodo.fecha_fin + '.',
    'Turno 1: ' + periodo.hora_inicio + ' – 17:00. Turno 2: 17:00 – ' + periodo.hora_corte + ' del día siguiente. Un evento entre 00:00 y ' + periodo.hora_corte + ' pertenece al día de producción anterior.',
    'No se trabaja domingos ni feriados: un registro en esos días o fuera de la ventana operativa se advierte y solo se inserta si usted lo fuerza.');
  if (def.fin) base.push('La duración se recalcula como reinicio − inicio; si la columna de duración difiere en más de 0.05 h, prevalece el cálculo.');
  if (defId === 'cambio_formato') base.push('Una fila por actividad del cambio. Solo las actividades con «Clasificación actual» = Interna se descuentan del OEE; el tiempo externo se ejecuta con la máquina en marcha.');
  if (defId === 'no_conformidades') base.push('Reproceso: material recuperado. Defecto de calidad: material descartado. Si la unidad es kg, las láminas equivalentes se calculan dividiendo entre la masa unitaria (' + periodo.masa_unitaria_kg + ' kg).');
  if (defId === 'operacion_en_vacio') base.push('Una fila por máquina con los minutos de vacío al arrancar la jornada y después de cada cambio de formato.');
  if (defId === 'reuniones_emergencia') base.push('Una reunión de emergencia detiene la planta completa: se cuenta una sola vez en horas de línea.');
  base.push('Duplicados en carga incremental: misma fecha y hora, mismo equipo y misma duración' + (defId === 'cambio_formato' ? ' (y misma actividad del mismo cambio)' : '') + '.');
  return base;
}

export function generarPlantilla(defId, ctx) {
  const def = REGISTROS[defId];
  const L = listasDeRegistro(defId, ctx.listas, ctx.codigos);
  const cab = def.columnas.map(c => ({ v: c.h, s: EST.cabecera }));
  const filas = [cab];
  def.ejemplos.forEach(ej => filas.push(def.columnas.map((c, j) => {
    const v = ej[j];
    if (c.tipo === 'fecha') { const f = parsearFecha(v); return f ? { v: f, t: 'd', s: EST.ejemploFecha } : { v, s: EST.ejemplo }; }
    if (c.tipo === 'num') return { v, s: EST.ejemploNum };
    return { v, s: EST.ejemplo };
  })));
  const validaciones = [];
  L.forEach((l, k) => {
    const j = def.columnas.indexOf(l.col), letra = colLetra(k);
    validaciones.push({ rango: colLetra(j) + '2:' + colLetra(j) + FILAS_VALIDADAS, formula: 'Listas!$' + letra + '$2:$' + letra + '$' + (l.valores.length + 1),
      mensaje: 'El valor de «' + l.titulo + '» debe estar en la lista' });
  });
  /* Formato de fecha en las columnas temporales para las filas que el usuario llene. */
  const hojaListas = [L.map(l => ({ v: l.titulo, s: EST.cabecera }))];
  const maxN = Math.max(0, ...L.map(l => l.valores.length));
  for (let i = 0; i < maxN; i++) hojaListas.push(L.map(l => l.valores[i] != null ? l.valores[i] : ''));
  const instr = [[{ v: 'Instrucciones de llenado · ' + def.nombre, s: EST.titulo }], []]
    .concat(instrucciones(defId, ctx.periodo).map((t, i) => [{ v: (i + 1) + '. ' + t, s: EST.envolver }]));
  instr.push([], [{ v: 'Columnas', s: EST.negrita }]);
  def.columnas.forEach(c => instr.push([{ v: c.h }, { v: (c.req ? 'Obligatorio · ' : 'Opcional · ') + ({ fecha: 'fecha y hora', num: 'número', lista: 'lista', equipo: 'lista de equipos', codigo: 'código del diccionario', texto: 'texto' }[c.tipo]) }]));
  return escribirLibro({
    titulo: 'Plantilla · ' + def.nombre,
    hojas: [
      { nombre: 'Registro', filas, anchos: def.columnas.map(c => c.tipo === 'fecha' ? 18 : c.tipo === 'texto' ? 30 : Math.max(12, c.h.length + 2)), fijarFila: 1, validaciones, altoCabecera: true,
        estiloCol: def.columnas.map(c => c.tipo === 'fecha' ? EST.fecha : c.fmt === '0.00' || c.fmt === '0.000' ? EST.num2 : 0) },
      { nombre: 'Listas', filas: hojaListas, anchos: L.map(l => Math.max(18, l.titulo.length + 4)), fijarFila: 1 },
      { nombre: 'Instrucciones', filas: instr, anchos: [110, 40] }
    ]
  });
}
