import { IdentityType } from '@jiku/models';
import { AuthEvent } from '@jiku/nats-protocol';
import logger from '../../logger';
import { mirrorUser } from '../../user-mirror';
import { EventContext, EventOutcome } from '../types';

/**
 * Espeja la identidad que el auth-callout acaba de autenticar.
 *
 * ES UN ADAPTADOR DELGADO Y NADA MÁS. La escritura de la fila vive en `src/user-mirror.ts`, que
 * este handler comparte con el despachador de comandos (S-029, CA-12): dos implementaciones del
 * mismo espejo divergen, y el síntoma aparece meses después sobre una fila de identidad.
 *
 * LO QUE SÍ QUEDA ACÁ SON LAS DOS COSAS QUE SON DEL EVENTO Y DE NADIE MÁS:
 *
 *  1. LA TRADUCCIÓN DE NOMBRES. `identity_type` viene `snake_case` porque así lo manda el callout,
 *     y el modelo es `camelCase` por `underscored: true`. El cast es seguro porque el esquema Joi
 *     del despachador ya validó contra `Object.values(IdentityType)`: el valor ESTÁ en el enum. No
 *     lo saques ni dupliques la validación acá. Y los campos se ENUMERAN, nunca un `...event`: con
 *     el `.unknown(true)` del esquema, un spread metería `client_ip`, `session` y cualquier campo
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
 * CUIDADO SI ALGÚN DÍA `identity_type` DEJA DE VENIR: el default del esquema es `person`, así que
 * un emisor que dejara de mandarlo degradaría TODAS las filas de servicio a `person` en silencio.
 * Hoy no puede pasar —sale del `type` de la regla de `rules.yaml` que matcheó y el callout siempre
 * lo manda—, pero es el caso peligroso del reemplazo total.
 */
export async function syncUser(event: AuthEvent, ctx: EventContext): Promise<EventOutcome> {
  const outcome = await mirrorUser(
    {
      id: event.id,
      name: event.name,
      username: event.username,
      // PUEDE SER `null`, y solo para una identidad de servicio: el esquema del despachador ya
      // normalizó ahí las tres formas de "no hay email", y para una persona ya descartó el evento.
      // Acá no hay nada que decidir — si hubiera un `?? algo`, sería el lugar equivocado.
      email: event.email,
      roles: event.roles,
      identityType: event.identity_type as IdentityType,
    },
    'strict',
    ctx.transaction,
    'events'
  );

  logger.info(`[events] ${event.id}: ${outcome}`);
  return 'applied';
}

export default syncUser;
