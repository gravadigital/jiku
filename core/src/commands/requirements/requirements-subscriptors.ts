import joi from 'joi';
import { Requirement, RequirementSubscriptor, User } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';

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
 * docs/api-reference.md). Core verifica que el usuario exista y que no esté ya suscripto.
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

    return success({ id: subscription.id });
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

    return success();
  },
};
