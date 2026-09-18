import joi from 'joi';
import { Requirement, RequirementSubscriptor, User } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';
import { resolveActor } from '../resolve-actor';
import { requirementSubscriptorAdded, requirementSubscriptorRemoved } from '../../events/domain/requirement';
import { readResponsiblePersonIds, requirementToSnapshot, resolveRecipients } from '../../events/domain/requirement-snapshot';

const COMPONENT_NEW = 'requirements.subscriptors.new';
const COMPONENT_DELETE = 'requirements.subscriptors.delete';

export interface SubscriptorNewPayload {
  userId: string;
}

const newSchema = joi.object({
  userId: joi.string().required(),
});

/**
 * Suscribir un usuario a un requisito.
 *
 * El permiso sobre el proyecto lo valida la api, porque depende del rol (ver
 * documentation/api-reference.md). Core verifica que el usuario exista y que no esté ya suscripto.
 */
export const requirementsSubscriptorsNew: Command<SubscriptorNewPayload, { id: number }> = {
  pattern: 'requirements.{id}.subscriptors.new',

  validate(payload: unknown) {
    return validateWith<SubscriptorNewPayload>(newSchema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<{ id: number }>> {
    const requirement = await Requirement.findByPk(ctx.params.id, {
      transaction: ctx.transaction,
    });
    if (!requirement) {
      return failure(ErrorCode.REQUIREMENT_NOT_FOUND, 'Requirement not found');
    }

    const user = await User.findByPk(payload.userId, { transaction: ctx.transaction });
    if (!user) {
      return failure(ErrorCode.USER_NOT_FOUND, 'User not found');
    }

    const existing = await RequirementSubscriptor.findOne({
      where: { requirementId: requirement.id, userId: payload.userId },
      transaction: ctx.transaction,
    });
    if (existing) {
      return failure(ErrorCode.ALREADY_SUBSCRIBED, 'User is already subscribed');
    }

    const subscription = await RequirementSubscriptor.create(
      { requirementId: requirement.id, userId: payload.userId },
      { transaction: ctx.transaction }
    );

    // EL EVENTO SE ARMA ACÁ, DESPUÉS DEL `create` (S-064, Task 7): `resolveRecipients` lee
    // DENTRO de esta misma transacción (ADR-003), así que la lista YA INCLUYE al suscriptor que
    // recién se insertó — leer antes no vería la fila (CA-9, TS-55).
    //
    // `?? ctx.caller` Y NO UN `failure` (D-3): este comando no tiene ningún campo de autoría en
    // el payload (`{ userId }` nada más), así que `resolveActor(ctx, undefined, COMPONENT)`
    // devuelve `undefined` en el canal exento — y una suscripción no puede dejar de funcionar
    // porque falte un actor para un evento. `ctx.caller` es el mismo valor que la tercera rama
    // de `resolveActor` devolvería: es honesto, dice "lo publicó la api sin declarar persona".
    // Por eso mismo este evento NO LLEVA `actor.name` (D-2): el valor puede no ser una persona.
    const actorId = resolveActor(ctx, undefined, COMPONENT_NEW) ?? ctx.caller;
    const responsiblePersonIds = await readResponsiblePersonIds(requirement.id, ctx.transaction);
    const reply = success({ id: subscription.id });
    reply.events = [
      requirementSubscriptorAdded({
        requirement: { id: requirement.id, projectId: requirement.projectId },
        actorId,
        userId: payload.userId,
        snapshot: requirementToSnapshot(requirement, responsiblePersonIds),
        recipients: await resolveRecipients(requirement.id, responsiblePersonIds, ctx.transaction),
      }),
    ];
    return reply;
  },
};

/**
 * Desuscribir. El protocolo no declara cuerpo: el usuario viene en el subject.
 *
 * Core no verifica de quién es la suscripción — "core borra lo que se le indique"
 * (ver el protocolo). Que alguien solo pueda desuscribirse a sí mismo lo valida la api.
 */
export const requirementsSubscriptorsDelete: Command<Record<string, never>, void> = {
  pattern: 'requirements.{id}.subscriptors.{userId}.delete',

  validate(payload: unknown) {
    return validateWith<Record<string, never>>(
      joi.object({}).unknown(false).default({}),
      payload ?? {}
    );
  },

  async execute(_payload, ctx: CommandContext): Promise<Reply<void>> {
    const deleted = await RequirementSubscriptor.destroy({
      where: { requirementId: ctx.params.id, userId: ctx.params.userId },
      transaction: ctx.transaction,
    });

    if (deleted === 0) {
      return failure(ErrorCode.SUBSCRIPTION_NOT_FOUND, 'Subscription not found');
    }

    // EL `findByPk` NUEVO VA DESPUÉS DEL `destroy` (S-064, Task 7): este comando no leía el
    // requisito hasta ahora, y hace falta para `entity.projectId` y el `snapshot`. Si devolviera
    // `null` —no debería, hay FK desde `requirement_subscriptors`—, el comando no falla: la baja
    // ya está hecha, y un evento que no se puede armar no invalida una escritura que ya está
    // bien (mismo criterio que el comando de edición de comentario).
    const requirement = await Requirement.findByPk(ctx.params.id, {
      transaction: ctx.transaction,
    });
    if (requirement) {
      // Mismo `?? ctx.caller` de D-3: este comando `Record<string, never>` no tiene NINGÚN
      // campo de autoría — ni siquiera un payload —, así que la escalera de `resolveActor` cae
      // directo a la rama exenta con más razón todavía que el alta.
      const actorId = resolveActor(ctx, undefined, COMPONENT_DELETE) ?? ctx.caller;
      // `resolveRecipients` lee DESPUÉS del `destroy`, dentro de la misma transacción: la lista
      // YA NO INCLUYE al suscriptor que se acaba de ir (CA-9, TS-56).
      const responsiblePersonIds = await readResponsiblePersonIds(
        requirement.id,
        ctx.transaction
      );
      const reply = success<void>();
      reply.events = [
        requirementSubscriptorRemoved({
          requirement: { id: requirement.id, projectId: requirement.projectId },
          actorId,
          userId: ctx.params.userId,
          snapshot: requirementToSnapshot(requirement, responsiblePersonIds),
          recipients: await resolveRecipients(
            requirement.id,
            responsiblePersonIds,
            ctx.transaction
          ),
        }),
      ];
      return reply;
    }

    return success();
  },
};
