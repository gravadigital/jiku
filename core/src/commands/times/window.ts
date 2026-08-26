/**
 * LA VENTANA DE CARGA (C-40): el día actual y los 10 previos, LOS DOS BORDES.
 *
 * VIVE ACÁ Y NO ADENTRO DE `worked-times.ts` porque LA APLICAN DOS COMANDOS —el alta y el
 * borrado— sobre DOS REPRESENTACIONES DISTINTAS de la fecha: el alta compara el string del
 * payload, el borrado compara el `Date` que vuelve de la base (`worked_times.date` es TIMESTAMP,
 * `unworked_times.date` es DATE — rareza #4 de `docs/db-schemas/jiku.md`). Dos copias de una regla
 * de calendario divergen, y el síntoma sería que se puede borrar lo que no se podría haber
 * cargado.
 *
 * EL BORDE SUPERIOR ES PARTE DE LA REGLA, y es el error que la story marca como riesgo alto: una
 * implementación que solo mire hacia atrás ACEPTA FECHAS FUTURAS, que la api rechaza hoy.
 *
 * SE NORMALIZA EN UTC y no en hora local. `TZ=UTC` está fijado en el contenedor
 * (`core/Dockerfile`) y en los tests (`tests/setup-env.ts`), pero la comparación no depende de esa
 * variable: un bug de zona horaria acá aparece SOLO EN EL BORDE y SOLO ALGUNAS HORAS DEL DÍA, que
 * es la peor forma que puede tener un bug.
 *
 * ES PURO: no lee `process.env`, no toca la base y no loguea. La convención `_base` lo pide
 * explícitamente — «un comando nunca lee `process.env`; las constantes de negocio son constantes
 * de módulo».
 */

/** Los días PREVIOS al actual que la ventana admite. El día actual va aparte y siempre entra. */
export const SUBMISSION_WINDOW_DAYS = 10;

/**
 * Día en UTC, `YYYY-MM-DD`, desde un string del payload o un `Date` de la base.
 *
 * EL STRING SE RECORTA Y NO SE PARSEA, y no es pereza: `new Date('2026-08-25')` es medianoche UTC
 * pero `new Date('2026-08-25T00:00:00')` es medianoche LOCAL, y la diferencia entre las dos es
 * justo el bug del borde. Un valor que ya viene como día no necesita convertirse en instante para
 * volver a ser día. El `slice` también cubre el `DATEONLY` de Sequelize, que vuelve `'YYYY-MM-DD'`.
 */
export function toDayUTC(value: string | Date): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

/**
 * `true` si la fecha cae entre hoy − 10 y hoy, AMBOS INCLUIDOS.
 *
 * LA COMPARACIÓN ES DE STRINGS `YYYY-MM-DD`, que ordenan lexicográficamente igual que
 * cronológicamente: es más simple y más difícil de romper que comparar `Date`s, donde cualquier
 * componente de hora vuelve a meter la zona horaria en la decisión.
 *
 * `today` TIENE DEFAULT PARA QUE UN TEST PUEDA FIJAR EL "HOY" sin tocar el reloj del proceso —el
 * bug de zona horaria solo se manifiesta algunas horas del día, así que sin esto no se puede
 * provocar—. EL COMANDO NUNCA LO PASA.
 */
export function isWithinSubmissionWindow(value: string | Date, today: Date = new Date()): boolean {
  const day = toDayUTC(value);
  const upperDay = toDayUTC(today);

  // `Date.UTC` NORMALIZA EL DESBORDE: un día 3 menos 10 cae en el mes anterior sin que haya que
  // pensarlo, y NO MUTA `today`, que es del llamador.
  const lower = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() - SUBMISSION_WINDOW_DAYS
  ));

  return day >= toDayUTC(lower) && day <= upperDay;
}
