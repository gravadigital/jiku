/**
 * Fechas RELATIVAS A HOY para los tests de tiempos, y nunca literales.
 *
 * Con C-40 viviendo en `core` desde S-031, la ventana de carga es «el día actual y los 10 previos»
 * y hay que probar sus bordes EXACTOS: hoy − 10 acepta, hoy − 11 rechaza, hoy acepta, mañana
 * rechaza. Los tres archivos de tests de tiempos declaraban cada uno su propio `getDateStr`, y dos
 * de sus constantes MENTÍAN sobre el offset que devolvían (`eightDaysAgoStr = getDateStr(-11)`,
 * `tenDaysAgoStr = getDateStr(-11)`): tres definiciones de la misma referencia temporal son tres
 * oportunidades de que una divergencia pase inadvertida.
 *
 * ES EL ESPEJO DE `core/tests/helpers/dates.ts`, a propósito: la mitad de la api del test de
 * paridad (CA-14) se lee bien solo si los dos lados expresan el mismo borde con el mismo nombre.
 *
 * NO SE USA `mockdate` (D-4 del plan): el `FakeBus` ejecuta `core` EN EL MISMO PROCESO, así que
 * congelar el reloj afectaría también a `isWithinSubmissionWindow` de core. Funciona, pero acopla
 * el test a un detalle del doble.
 *
 * VIVE ACÁ Y NO ADENTRO DE UN `.test.ts` porque lo necesitan cuatro archivos, y porque al no
 * terminar en `.test.ts` mocha no lo carga como suite: importar un archivo de tests desde otro
 * reordenaría el registro de los `describe` sin que nadie lo pidiera.
 *
 * `TZ=UTC` está fijado en `tests/setup-env.ts`, pero el par `setUTCDate` / `toISOString` NO DEPENDE
 * de esa variable para ser correcto — que es la propiedad que se quiere si mañana alguien la saca.
 * Por lo mismo NO se usa aritmética de milisegundos (`Date.now() - n * 86400000`): es correcta hoy
 * y se rompe con cualquier cambio de horario en una TZ que no sea UTC.
 */
export function dayOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/** El día actual, `YYYY-MM-DD` en UTC. Dentro de la ventana. */
export const HOY = dayOffset(0);

/** El borde inferior EXACTO de la ventana: hoy − 10. Dentro. */
export const HOY_M10 = dayOffset(-10);

/** El primer día FUERA de la ventana hacia atrás: hoy − 11. */
export const HOY_M11 = dayOffset(-11);

/** El primer día FUERA de la ventana hacia adelante: hoy + 1. */
export const MANANA = dayOffset(1);
