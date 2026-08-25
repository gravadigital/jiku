import { IdentityType, User } from '@jiku/models';
import { AuthEvent } from '@jiku/nats-protocol';
import logger from '../../logger';
import { EventContext, EventOutcome } from '../types';

/**
 * Espeja la identidad que el auth-callout acaba de autenticar.
 *
 * REEMPLAZO TOTAL, SIN `pickPresent`. Los 20 comandos usan `pickPresent` para no pisar lo que el
 * caller no mandó: eso es edición parcial, y un evento no es una edición. El evento trae la
 * identidad COMPLETA y Zitadel es la verdad, así que los cinco campos se sobreescriben SIEMPRE.
 * Usar `pickPresent` acá sería el bug.
 *
 * `sequelize.upsert()` NO SE USA a propósito: `findByPk` + `create`/`update` es lo que deja el log
 * distinguiendo un alta de una actualización, que es el dato que se va a querer al diagnosticar
 * por qué una identidad no tiene los roles que debería.
 *
 * OJO CON EL JSONB: un `update` de `roles` REEMPLAZA EL VALOR ENTERO, no lo mergea. Es exactamente
 * la semántica que este handler quiere, pero es la trampa clásica de JSONB con un ORM y por eso
 * está escrito.
 *
 * LOS CAMPOS SE ENUMERAN, NUNCA UN SPREAD. Cinco de los seis nombres coinciden entre el payload y
 * el modelo, lo que hace tentador un `...event`: eso metería `client_ip`, `session` y los otros
 * cuatro ignorados en el `create`, y con el `.unknown(true)` del esquema también cualquier campo
 * nuevo del emisor.
 */
export async function syncUser(event: AuthEvent, ctx: EventContext): Promise<EventOutcome> {
  const fields = {
    name: event.name,
    username: event.username,
    // PUEDE SER `null`, y solo para una identidad de servicio: el esquema del despachador ya
    // normalizó ahí las tres formas de "no hay email", y para una persona ya descartó el evento.
    // Acá no hay nada que decidir — si hubiera un `?? algo`, sería el lugar equivocado.
    //
    // El reemplazo total aplica igual: un service user que deja de declarar su dirección en
    // Zitadel deja de tenerla en la fila. Es la misma semántica que ya tiene `roles`.
    email: event.email,
    roles: event.roles,
    // EL ÚNICO MAPEO DE NOMBRE del handler: el payload es `snake_case` (así llega del callout) y
    // el modelo `camelCase` (por `underscored: true`). El cast es seguro porque el esquema Joi
    // del despachador ya validó contra `Object.values(IdentityType)`: el valor ESTÁ en el enum.
    // No lo saques ni dupliques la validación acá.
    identityType: event.identity_type as IdentityType,
    // CUIDADO SI ALGÚN DÍA `identity_type` DEJA DE VENIR: el default del esquema es `person`, así
    // que un emisor que dejara de mandarlo degradaría TODAS las filas de servicio a `person` en
    // silencio. Hoy no puede pasar —sale del `type` de la regla de `rules.yaml` que matcheó y el
    // callout siempre lo manda—, pero es el caso peligroso del reemplazo total.
  };

  // Con la transacción AUNQUE SEA UNA LECTURA: la convención `orm` no hace excepciones, y sin
  // ella la lectura vería un snapshot distinto del que la escritura va a modificar.
  const existing = await User.findByPk(event.id, { transaction: ctx.transaction });

  if (!existing) {
    await User.create({ id: event.id, ...fields }, { transaction: ctx.transaction });
    // Solo el id y el resultado. NUNCA el payload: trae `email`, `client_ip` y el id de sesión, y
    // la convención `logging` prohíbe datos de negocio fuera de `LOG_COMMANDS`.
    logger.info(`[events] ${event.id}: created`);
    return 'applied';
  }

  // El `id` no entra en el `update`: es la PK, y la fila se encontró POR ella.
  await existing.update(fields, { transaction: ctx.transaction });
  logger.info(`[events] ${event.id}: updated`);
  return 'applied';
}

export default syncUser;
