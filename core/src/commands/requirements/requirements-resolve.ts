import joi from 'joi';
import { Requirement, RequirementActivity, RequirementActivityType, RequirementResolution, RequirementState, RequirementType, VisibilityLevel } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';
import { resolveActor } from '../resolve-actor';
import { requirementResolved, requirementStateChanged } from '../../events/domain/requirement';
import { readResponsiblePersonIds, requirementToSnapshot, resolveRecipients } from '../../events/domain/requirement-snapshot';

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
    //
    // UN SOLO `if`, no dos (S-064, D-8): el bloque de eventos de abajo entra en la MISMA
    // condición que decide si hubo transición real — duplicar el predicado es cómo los dos
    // caminos (la fila de actividad y el evento) se desincronizarían.
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

      // `responsiblePersonIds` sale SIEMPRE de la lectura: este comando nunca los trae en el
      // payload (a diferencia de `edit`, D-4). `recipients` se resuelve una sola vez y se
      // comparte entre los dos eventos (R-8, CA-9).
      const responsiblePersonIds = await readResponsiblePersonIds(
        requirement.id,
        ctx.transaction
      );
      const snapshot = requirementToSnapshot(requirement, responsiblePersonIds);
      const recipients = await resolveRecipients(
        requirement.id,
        responsiblePersonIds,
        ctx.transaction
      );
      const entity = { id: requirement.id, projectId: requirement.projectId };

      const reply = success<void>();
      reply.events = [
        requirementStateChanged({
          requirement: entity,
          actorId: actor,
          actorEnvelope: ctx.actor,
          snapshot,
          recipients,
          from: previousState,
          to: RequirementState.Resuelto,
        }),
        requirementResolved({
          requirement: entity,
          actorId: actor,
          actorEnvelope: ctx.actor,
          snapshot,
          recipients,
          from: previousState,
          // LEÍDOS DE LA FILA YA ACTUALIZADA (no del payload de este comando, que no siempre
          // los trae): el hook acaba de escribir `finishedAt`, y el `update` de arriba ya dejó
          // los tres campos de resolución en su valor efectivo.
          resolutionType: requirement.resolutionType,
          resolutionConclusion: requirement.resolutionConclusion,
          resolutionComment: requirement.resolutionComment,
          finishedAt: requirement.finishedAt!.toISOString(),
        }),
      ];
      return reply;
    }

    return success();
  },
};

export default requirementsResolve;
