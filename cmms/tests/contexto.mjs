/* Contexto de pruebas: catálogos y parámetros sembrados, tal como quedan tras la instalación. */
import { EQUIPOS_SEMILLA, LISTAS_SEMILLA, CODIGOS_CAUSA_SEMILLA, periodoSemilla, CONFIG_SEMILLA } from '../src/core/catalogos.js';
import { copia } from '../src/core/util.js';
export function contextoBase() {
  return { periodo: periodoSemilla(), equipos: copia(EQUIPOS_SEMILLA), listas: copia(LISTAS_SEMILLA), codigos: copia(CODIGOS_CAUSA_SEMILLA), config: copia(CONFIG_SEMILLA) };
}
export const DIR_REF = process.env.DIR_REF || '/tmp/claude-0/-home-user-alphaautomotriz/48738a8f-232b-5a17-a80e-2168978436e4/scratchpad/xl/Bases_de_datos_Capitulo_II';
