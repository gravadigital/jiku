import joi from 'joi';
import { Requirement, RequirementActivity, RequirementActivityType, RequirementResolution, RequirementState, RequirementType, VisibilityLevel } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';
import { resolveActor } from '../resolve-actor';

const COMPONENT = 'requirements.resolve';

export interface RequirementsResolvePayload {
  editor?: string;
  type: RequirementResolution;
  conclusion?: string | null;
  comment?: string | null;
}

/**
 * Resolver un requisito: lo pasa a `resuelto` y guarda el motivo.
 *
 * En la api esto era parte de `PATCH /requirements/:reqid`, que aceptaba `state`,
 * `resolutionType` y `resolutionConclusion` juntos. El protocolo lo separa en su propio
 * comando, así que la transición a `resuelto` queda acá y no en el edit.
 */
const schema = joi.object({
  // OPTIONAL: ver la nota de `tasks-edit.ts`.
  editor: joi.string().optional(),
  type: joi.string().valid(...Object.values(RequirementResolution)).required(),
  conclusion: joi.string().allow('', null).optional(),
  comment: joi.string().allow('', null).optional(),
});

export const requirementsResolve: Command<RequirementsResolvePayload, void> = {
  pattern: 'requirements.{id}.resolve',

  validate(payload: unknown) {
    return validateWith<RequirementsResolvePayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<void>> {
    const actor = resolveActor(ctx, payload.editor, COMPONENT);
    if (!actor) {
      return failure(ErrorCode.INVALID_FIELDS, 'Falta el editor del requisito');
    }

    const requirement = await Requirement.findByPk(ctx.params.id, {
      transaction: ctx.transaction,
    });
    if (!requirement) {
      return failure(ErrorCode.REQUIREMENT_NOT_FOUND, 'Requirement not found');
    }

    // C-17, acotado a `incidencia` (REQ-012). `type` del payload es el tipo de RESOLUCIÓN
    // (`RequirementResolution`), que no tiene nada que ver con el tipo del REQUISITO
    // (`requirement.type`, `RequirementType`) — son dos enums distintos con el mismo nombre de
    // campo, y confundirlos acá haría que la regla se evalúe contra el valor equivocado.
    if (requirement.type === RequirementType.Incidencia) {
      const conclusion = payload.conclusion ?? requirement.resolutionConclusion;
      if (!conclusion) {
        return failure(
          ErrorCode.RESOLUTION_REQUIRED,
          'Se requiere tipo y conclusión para resolver un requisito'
        );
      }
    }

    const previousState = requirement.state;

    await requirement.update(
      {
        state: RequirementState.Resuelto,
        resolutionType: payload.type,
        resolutionConclusion: payload.conclusion ?? requirement.resolutionConclusion,
        resolutionComment: payload.comment ?? requirement.resolutionComment,
      },
      { transaction: ctx.transaction }
    );

    // El hook del modelo registra el cambio de estado en `activityLog`; se persiste
    // igual que en el edit.
    if (previousState !== RequirementState.Resuelto) {
      await RequirementActivity.create(
        {
          typeOfActivity: RequirementActivityType.State,
          previousValue: previousState,
          newValue: RequirementState.Resuelto,
          visibilityLevel: VisibilityLevel.Public,
          requirementId: requirement.id,
          changedBy: actor,
        },
        { transaction: ctx.transaction }
      );
    }

    return success();
  },
};

export default requirementsResolve;
