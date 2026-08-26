/**
 * Fechas RELATIVAS A HOY, y nunca literales.
 *
 * Con C-40 en core (S-031) la ventana de carga es «el día actual y los 10 previos», así que una
 * fecha fija en un fixture de tiempos es una bomba de tiempo: pasa hoy y falla en once días. Los
 * dos archivos que tenían literales —`tests/commands/times.test.ts` con `'2026-05-04'` en 14
 * despachos y `tests/bus/actor.test.ts` con `'2026-08-25'` en TS-26— empezaban a responder
 * `invalid_date_range` donde afirman otra cosa.
 *
 * VIVE ACÁ Y NO ADENTRO DE UN `.test.ts` porque LO NECESITAN DOS ARCHIVOS y copiarlo sería tener
 * dos definiciones de la misma referencia temporal. `tests/helpers/` es donde ya vive `dispatch`,
 * y al no terminar en `.test.ts` mocha no lo carga como suite: importar un archivo de tests desde
 * otro reordenaría el registro de los `describe` sin que nadie lo pidiera.
 *
 * `TZ=UTC` está fijado en `tests/setup-env.ts`, pero el par `setUTCDate` / `toISOString` NO
 * DEPENDE de esa variable para ser correcto — que es la propiedad que se quiere si mañana alguien
 * la saca. Por lo mismo NO se usa aritmética de milisegundos (`Date.now() - n * 86400000`): es
 * correcta hoy y se rompe con cualquier cambio de horario en una TZ que no sea UTC.
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
