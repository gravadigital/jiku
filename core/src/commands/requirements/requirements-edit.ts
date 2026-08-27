import joi from 'joi';
import { AttachmentEntityType, FieldActivityChange, Person, PersonRequirement, Requirement, RequirementActivity, RequirementActivityType, RequirementPriority, RequirementResolution, RequirementState, RequirementType, RequirementVisibilityLevel, VisibilityLevel } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { pickPresent, validateWith } from '../validate';
import { syncFileLinks } from '../link-files';
import { resolveActor } from '../resolve-actor';
import { isTransitionAllowed } from './state-transitions';

const COMPONENT = 'requirements.edit';

export interface RequirementsEditPayload {
  editor?: string;
  title?: string;
  description?: string;
  type?: RequirementType | null;
  priority?: RequirementPriority;
  visibilityLevel?: RequirementVisibilityLevel;
  responsiblePersonIds?: number[];
  estimatedFinishDate?: string | null;
  tags?: Array<{ key: string; value: string }>;
  state?: RequirementState;
  resolutionType?: string | null;
  resolutionConclusion?: string | null;
  resolutionComment?: string | null;
  fileIds?: number[];
  scope?: string | null;
  technicalSolution?: string | null;
  acceptanceCriteria?: string | null;
}

const schema = joi.object({
  // OPTIONAL: ver la nota de `tasks-edit.ts`. La obligatoriedad efectiva —alguna fuente tiene
  // que producir un actor— la impone `execute()` vía `resolveActor`, no Joi.
  editor: joi.string().optional(),
  title: joi.string().optional(),
  description: joi.string().optional(),
  type: joi.string().valid(...Object.values(RequirementType)).allow(null).optional(),
  priority: joi.string().valid(...Object.values(RequirementPriority)).optional(),
  visibilityLevel: joi.string().valid(...Object.values(RequirementVisibilityLevel)).optional(),
  responsiblePersonIds: joi.array().items(joi.number().integer()).optional(),
  estimatedFinishDate: joi.date().allow(null).optional(),
  tags: joi.array().items(joi.object({ key: joi.string(), value: joi.string() })).optional(),
  state: joi.string().valid(...Object.values(RequirementState)).optional(),
  // La resolución tiene su propio comando, pero el PATCH de la api aceptaba estos
  // campos y la web los sigue mandando. Se aceptan mientras esa ruta exista.
  resolutionType: joi.string().valid(...Object.values(RequirementResolution)).allow(null).optional(),
  resolutionConclusion: joi.string().allow('', null).optional(),
  resolutionComment: joi.string().allow('', null).optional(),
  // Sin `.allow(null)`: el contrato no declara `null` para este campo. Vaciar el conjunto es
  // mandar `[]`, que es distinto de no mandarlo (ausente = no se toca).
  fileIds: joi.array().max(10).items(joi.number().integer().positive()).optional(),
  scope: joi.string().allow('', null).optional(),
  technicalSolution: joi.string().allow('', null).optional(),
  acceptanceCriteria: joi.string().allow('', null).optional(),
});

const ACTIVITY_TYPE_BY_FIELD: Record<FieldActivityChange['type'], RequirementActivityType> = {
  title: RequirementActivityType.Title,
  description: RequirementActivityType.Description,
  state: RequirementActivityType.State,
};

export const requirementsEdit: Command<RequirementsEditPayload, void> = {
  pattern: 'requirements.{id}.edit',

  validate(payload: unknown) {
    return validateWith<RequirementsEditPayload>(schema, payload);
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

    if (payload.responsiblePersonIds && payload.responsiblePersonIds.length > 0) {
      const count = await Person.count({
        where: { id: payload.responsiblePersonIds },
        transaction: ctx.transaction,
      });
      if (count !== payload.responsiblePersonIds.length) {
        return failure(
          ErrorCode.INVALID_RESPONSIBLE_PERSON,
          'Responsible person does not exist'
        );
      }
    }

    // LA TABLA DE TRANSICIONES (C-15, S-033): `edit` es el canal por el que REALMENTE llega la
    // resolución (H-2 del Story Plan — `resolve` no tiene ruta HTTP que lo publique), así que
    // el validador va acá y no solo en `resolve`. `type` se lee de LA FILA
    // (`requirement.type`), nunca de `payload.type`, aunque el mismo payload también lo traiga
    // para cambiar la clasificación: se evalúa contra el valor PRE-cambio (H-4) — un caller no
    // puede declararse `incidencia` en el mismo request para saltear `en_cola`.
    if (payload.state !== undefined && payload.state !== requirement.state) {
      if (!isTransitionAllowed(requirement.state, payload.state, requirement.type)) {
        return failure(ErrorCode.INVALID_STATE_TRANSITION, 'Transición de estado no permitida');
      }
      if (payload.state === RequirementState.Resuelto) {
        // C-17: tipo y conclusión son obligatorios al resolver, venga del camino que venga
        // (CA-10) — sin acotarlo a `incidencia`, a diferencia de la regla que reemplaza.
        const resolutionType = payload.resolutionType ?? requirement.resolutionType;
        const resolutionConclusion = payload.resolutionConclusion ?? requirement.resolutionConclusion;
        if (!resolutionType || !resolutionConclusion) {
          return failure(
            ErrorCode.RESOLUTION_REQUIRED,
            'Se requiere tipo y conclusión para resolver un requisito'
          );
        }
      }
    }

    const changes = pickPresent(payload, [
      'title', 'description', 'type', 'priority', 'visibilityLevel',
      'estimatedFinishDate', 'tags', 'state', 'scope', 'technicalSolution',
      'acceptanceCriteria', 'resolutionType', 'resolutionConclusion', 'resolutionComment',
    ]);

    if (Object.keys(changes).length > 0) {
      // El hook @BeforeUpdate del modelo calcula `activityLog` y, cuando cambia el
      // estado, completa las marcas de tiempo (scheduledAt, inProgressAt, ...).
      await requirement.update(changes, { transaction: ctx.transaction });

      const logged: FieldActivityChange[] = requirement.activityLog || [];
      await Promise.all(
        logged.map((change) =>
          RequirementActivity.create(
            {
              typeOfActivity: ACTIVITY_TYPE_BY_FIELD[change.type],
              previousValue: change.previous,
              newValue: change.next,
              visibilityLevel: VisibilityLevel.Public,
              requirementId: requirement.id,
              changedBy: actor,
            },
            { transaction: ctx.transaction }
          )
        )
      );
    }

    // `fileIds` es el conjunto COMPLETO que debe quedar vinculado: los que no estaban ganan un
    // vínculo, los que ya no vienen lo pierden. OPERA SOBRE EL VÍNCULO, NUNCA SOBRE EL ARCHIVO
    // (D-04): desvincular jamás borra el `File`, porque un archivo puede tener 0..N vínculos y
    // llevárselo rompería los otros.
    //
    // El chequeo es `!== undefined` y no un truthy: `[]` es un valor legítimo —significa
    // "desvinculá todo"— y ausente significa "no toques nada" (edición parcial).
    if (payload.fileIds !== undefined) {
      const linkError = await syncFileLinks({
        fileIds: payload.fileIds,
        actor,
        entityType: AttachmentEntityType.Requirement,
        entityId: requirement.id,
        ctx,
      });
      if (linkError) {
        return linkError;
      }
    }

    // Reemplazo total de responsables.
    if (payload.responsiblePersonIds) {
      await PersonRequirement.destroy({
        where: { requirementId: requirement.id },
        transaction: ctx.transaction,
      });
      await Promise.all(
        payload.responsiblePersonIds.map((personId, index) =>
          PersonRequirement.create(
            {
              personId,
              requirementId: requirement.id,
              isLeader: index === 0 ? true : null,
            },
            { transaction: ctx.transaction }
          )
        )
      );
    }

    return success();
  },
};

export default requirementsEdit;
