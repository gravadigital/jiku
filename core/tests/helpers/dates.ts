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

/**
 * EL LUNES DE UNA SEMANA RELATIVA A LA DE HOY, `YYYY-MM-DD` en UTC.
 *
 * Lo necesita S-032: C-36 dice que `dateFrom` no puede ser anterior al lunes de la semana actual,
 * y la regla del lunes dice que `dateFrom` tiene que ser un lunes. Un literal en el fixture pasa
 * hoy y falla la semana que viene — es el mismo bug que este archivo ya pagó una vez con la
 * ventana de carga.
 *
 * `getUTCDay()` Y NO `getDay()`: en una TZ negativa el lunes UTC se lee como domingo y el helper
 * devolvería el lunes de la semana ANTERIOR — o sea, un valor que el comando RECHAZA, en un test
 * que afirma que lo acepta, y solo algunas horas del día.
 */
export function lunesOffset(semanas: number): string {
  const hoy = new Date();
  const dia = hoy.getUTCDay();
  // EL DOMINGO RESTA 6, NO 1: `1 - 0` daría el lunes SIGUIENTE, y el helper devolvería una semana
  // futura durante 24 h por semana. Es el mismo ajuste que hace `validateWeekNotPast` en la api.
  const diff = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(Date.UTC(
    hoy.getUTCFullYear(),
    hoy.getUTCMonth(),
    hoy.getUTCDate() + diff + semanas * 7
  ));
  return lunes.toISOString().split('T')[0];
}

/** El lunes de ESTA semana. C-36 lo ACEPTA: es su borde inferior exacto. */
export const LUNES = lunesOffset(0);

/** El lunes de la semana PASADA. C-36 lo RECHAZA. */
export const LUNES_ANTERIOR = lunesOffset(-1);

/** El lunes de la semana QUE VIENE. C-36 lo ACEPTA. */
export const LUNES_SIGUIENTE = lunesOffset(1);

/**
 * Un día desplazado respecto de un lunes, `YYYY-MM-DD` en UTC.
 *
 * SE DERIVA DEL LUNES Y NO DE `HOY`, y esa es toda la gracia: `dayOffset(1)` cae en un día de la
 * semana distinto cada día, así que un test que quiera "un martes" tiene que partir del lunes o
 * estaría afirmando otra cosa cada 24 h.
 */
export function desdeLunes(lunes: string, days: number): string {
  const d = new Date(`${lunes}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}
