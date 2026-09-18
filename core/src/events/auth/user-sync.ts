import { AuthEvent } from '@jiku/nats-protocol';
import logger from '../../logger';
import { mirrorUser } from '../../user-mirror';
import { EventContext, EventOutcome } from '../types';
import { identityTypeFromMatchedRole } from './identity-type';

/**
 * Espeja la identidad que el auth-callout acaba de autenticar.
 *
 * ES UN ADAPTADOR DELGADO Y NADA MÁS. La escritura de la fila vive en `src/user-mirror.ts`, que
 * este handler comparte con el despachador de comandos (S-029, CA-12): dos implementaciones del
 * mismo espejo divergen, y el síntoma aparece meses después sobre una fila de identidad.
 *
 * LO QUE SÍ QUEDA ACÁ SON LAS DOS COSAS QUE SON DEL EVENTO Y DE NADIE MÁS:
 *
 *  1. LA TRADUCCIÓN DE NOMBRES, y desde S-069 también LA DERIVACIÓN DE `identityType`. La v2 del
 *     evento ELIMINÓ `identity_type` del payload, así que ya no hay nada que castear: el valor se
 *     deriva de `matched_role` con `identityTypeFromMatchedRole`, y su tipo de retorno es
 *     `IdentityType`, de modo que un valor fuera del enum es imposible de construir (antes eso lo
 *     garantizaba una validación Joi). Y los campos se ENUMERAN, nunca un `...event`: con el
 *     `.unknown(true)` del esquema, un spread metería `client_ip`, `session` y cualquier campo
 *     nuevo del emisor en la fila.
 *
 *  2. EL LOG. El módulo compartido devuelve `'created' | 'updated'` y NO loguea: el prefijo y el
 *     texto son de cada camino, y `tests/events/auth.test.ts` afirma `info.callCount === 1` con el
 *     texto exacto. Solo el id y el resultado, NUNCA el payload: trae `email`, `client_ip` y el id
 *     de sesión, y la convención `logging` prohíbe datos de negocio fuera de `LOG_COMMANDS`.
 *
 * EL MODO ES `'strict'`: reemplazo total de los cinco campos. El evento trae la identidad COMPLETA
 * y Zitadel es la verdad. Un evento de persona sin `email` ya fue DESCARTADO por el esquema Joi del
 * despachador antes de llegar acá, así que el best-effort no tiene nada que hacer en este camino —
 * y esa es exactamente la diferencia que el parámetro existe para expresar (D-7).
 *
 * EL CUIDADO QUE ESTE DOCBLOCK ANUNCIABA **YA OCURRIÓ**, y vale dejar registrado que la predicción
 * era correcta: decía *"si algún día `identity_type` deja de venir... degradaría TODAS las filas de
 * servicio a `person` en silencio"*. La v2 lo eliminó del payload (S-069). Lo que evita la
 * degradación es que el valor se DERIVA de `matched_role` en vez de caer a un default: los dos
 * roles de servicio de `rules.yaml` siguen produciendo `service`.
 *
 * SIGUE SIENDO EL CASO PELIGROSO DEL REEMPLAZO TOTAL, ahora desplazado un paso: si alguien agrega
 * un rol de servicio a `rules.yaml` y no lo agrega a `SERVICE_ROLES`, esa identidad se espeja como
 * `person` sin que nada falle. Hay un test que cuenta la lista para que el olvido se vea.
 */
export async function syncUser(event: AuthEvent, ctx: EventContext): Promise<EventOutcome> {
  // Solo el `outcome`: el `name` que `mirrorUser` devuelve desde S-068 es para el enriquecimiento
  // del sobre en el plano de COMANDOS, y este camino no lo necesita.
  const { outcome } = await mirrorUser(
    {
      id: event.id,
      name: event.name,
      username: event.username,
      // PUEDE SER `null`, y solo para una identidad de servicio: el esquema del despachador ya
      // normalizó ahí las tres formas de "no hay email", y para una persona ya descartó el evento.
      // Acá no hay nada que decidir — si hubiera un `?? algo`, sería el lugar equivocado.
      email: event.email,
      roles: event.roles,
      // DERIVADO, ya no leído: la v2 no manda `identity_type`. Ver `identity-type.ts`.
      identityType: identityTypeFromMatchedRole(event.matched_role),
    },
    'strict',
    ctx.transaction,
    'events'
  );

  logger.info(`[events] ${event.id}: ${outcome}`);
  return 'applied';
}

export default syncUser;
