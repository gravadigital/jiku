import joi from 'joi';
import { AttachmentEntityType, FieldActivityChange, Person, PersonRequirement, Requirement, RequirementActivity, RequirementActivityType, RequirementPriority, RequirementResolution, RequirementState, RequirementType, RequirementVisibilityLevel, VisibilityLevel } from '@jiku/models';
import { DomainEvent, ErrorCode, Reply, RequirementSnapshot, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { pickPresent, validateWith } from '../validate';
import { syncFileLinks } from '../link-files';
import { resolveActor } from '../resolve-actor';
import { requirementAssigned, requirementReopened, requirementResolved, requirementStateChanged, requirementUpdated } from '../../events/domain/requirement';
import { readResponsiblePersonIds, requirementToSnapshot, resolveRecipients } from '../../events/domain/requirement-snapshot';
import { diffResponsibles } from '../../events/domain/responsibles-diff';

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

    // REQ-012: las transiciones de estado son libres — cualquier valor del enum es alcanzable
    // desde cualquier otro. `edit` es el canal por el que REALMENTE llega la resolución.
    if (payload.state !== undefined && payload.state !== requirement.state) {
      // C-17, acotado de nuevo a `incidencia` (REQ-012): para `funcionalidad`, `mejora` y `otro`
      // el tipo y la conclusión son siempre opcionales. `type` se lee de LA FILA
      // (`requirement.type`), nunca de `payload.type`, aunque el mismo payload lo traiga para
      // reclasificar: se evalúa contra el valor PRE-cambio, así que un caller no puede
      // declararse otro tipo en el mismo request para esquivar la regla.
      if (
        payload.state === RequirementState.Resuelto
        && requirement.type === RequirementType.Incidencia
      ) {
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

    // REAPERTURA (REQ-012): al salir de `resuelto` hacia un estado NO TERMINAL, los datos de la
    // resolución dejan de describir la fila y se limpian. Los tres juntos, porque son una sola
    // cosa —el motivo por el que se cerró— y dejar uno solo produciría una fila que dice haberse
    // resuelto "por error interno" sin conclusión ni comentario.
    //
    // EN EL MISMO `update`: la limpieza y el cambio de estado son atómicos POR CONSTRUCCIÓN, no
    // dos escrituras que hay que acordarse de coordinar.
    //
    // Se aplica DESPUÉS de `pickPresent` y con `?? null` para que un valor EXPLÍCITO del payload
    // gane: el caller que reabre y en el mismo request escribe un `resolutionComment` está siendo
    // más específico que esta regla.
    const leavesResolved = requirement.state === RequirementState.Resuelto
      && payload.state !== undefined
      && payload.state !== RequirementState.Resuelto
      && payload.state !== RequirementState.Cancelado;

    if (leavesResolved) {
      changes.resolutionType = payload.resolutionType ?? null;
      changes.resolutionConclusion = payload.resolutionConclusion ?? null;
      changes.resolutionComment = payload.resolutionComment ?? null;
    }

    // Declarada ACÁ, antes del `if`, y no adentro: el bloque de eventos de más abajo (Task 4 de
    // S-064) la necesita SIEMPRE, incluso cuando `changes` está vacío y el `if` de abajo no
    // corre — en ese caso queda `[]`, que es exactamente "no hubo diff que traducir".
    let logged: FieldActivityChange[] = [];

    if (Object.keys(changes).length > 0) {
      // El hook @BeforeUpdate del modelo calcula `activityLog` y, cuando cambia el
      // estado, completa las marcas de tiempo (scheduledAt, inProgressAt, ...).
      await requirement.update(changes, { transaction: ctx.transaction });

      logged = requirement.activityLog || [];
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

    // LECTURA PREVIA (D-2, S-066): el ÚNICO momento en que la tabla todavía tiene el conjunto
    // VIEJO de responsables — el `destroy` de abajo lo borra, y `people_requirements` no tiene
    // historial. Va DENTRO de `ctx.transaction` (ADR-003) y SOLO cuando el payload trae la lista:
    // si no la trae, no hay reemplazo, no hay diff y no hay evento, así que la consulta sería
    // trabajo puro. Es una lectura DISTINTA de la del bloque de eventos de más abajo (esa lee el
    // estado POSTERIOR): una es el "antes", la otra el "después", a propósito.
    const previousResponsibleIds = payload.responsiblePersonIds
      ? await readResponsiblePersonIds(requirement.id, ctx.transaction)
      : null;

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

    // El diff (D-1, D-5): `added`/`removed`/`leaderId` los calcula EL EMISOR, no el conector.
    // `changed` distingue un reemplazo real de un payload que reenvía la misma lista.
    const assignment = payload.responsiblePersonIds
      ? diffResponsibles(previousResponsibleIds!, payload.responsiblePersonIds)
      : null;

    // LOS EVENTOS SE ARMAN ACÁ, AL FINAL — después del reemplazo de responsables y después de
    // todo `return linkError` de arriba (S-064, Task 4): el `snapshot` tiene que reflejar el
    // estado COMPLETO del requisito, y un `edit` que falla no llega a este punto (CA-1, gratis
    // por el orden, igual que en `requirements-new.ts`).
    //
    // La traducción del diff se hace con un `find` por tipo, sobre `logged` (la MISMA variable
    // que ya se usó para escribir `RequirementActivity`, no una relectura).
    const stateChange = logged.find((change) => change.type === 'state');
    const titleChange = logged.find((change) => change.type === 'title');
    const descriptionChange = logged.find((change) => change.type === 'description');

    const events: DomainEvent<RequirementSnapshot>[] = [];

    // Sin ninguna entrada de state/title/description NI cambio real de responsables, NO HAY NADA
    // QUE DECLARAR: un `edit` de `priority` (o cualquier otro campo sin evento, CA-2) sigue
    // devolviendo un `Reply` idéntico al de antes de esta story — `reply.events` ni se asigna
    // (criterio 10). La condición se ENSANCHA (D-7) y no se duplica: `assigned` reusa el mismo
    // `responsiblePersonIds`/`snapshot`/`recipients` que los demás eventos de este bloque, sin
    // una segunda consulta a `resolveRecipients` (R-8).
    if (stateChange || titleChange || descriptionChange || assignment?.changed) {
      // `responsiblePersonIds` sale del PAYLOAD cuando está presente (D-4, regla 1: es la única
      // fuente fiel al orden), y de la lectura ordenada cuando no. `recipients` se resuelve UNA
      // SOLA VEZ (R-8) y el `snapshot`, UNA SOLA VEZ: los dos se comparten entre los hasta tres
      // eventos de este bloque (CA-9).
      const responsiblePersonIds = payload.responsiblePersonIds
        ?? await readResponsiblePersonIds(requirement.id, ctx.transaction);
      const snapshot = requirementToSnapshot(requirement, responsiblePersonIds);
      const recipients = await resolveRecipients(
        requirement.id,
        responsiblePersonIds,
        ctx.transaction
      );
      const entity = { id: requirement.id, projectId: requirement.projectId };

      if (stateChange) {
        events.push(requirementStateChanged({
          requirement: entity,
          actorId: actor,
          actorEnvelope: ctx.actor,
          snapshot,
          recipients,
          from: stateChange.previous,
          to: stateChange.next,
        }));
      }

      if (titleChange || descriptionChange) {
        events.push(requirementUpdated({
          requirement: entity,
          actorId: actor,
          actorEnvelope: ctx.actor,
          snapshot,
          recipients,
          title: titleChange ? { from: titleChange.previous, to: titleChange.next } : undefined,
          description: descriptionChange
            ? { from: descriptionChange.previous, to: descriptionChange.next }
            : undefined,
        }));
      }

      // `resolved` y `reopened` van ADEMÁS de `state.changed`, nunca en su lugar (D-6): un
      // requisito que entra o sale de `resuelto` sigue siendo, antes que nada, un cambio de
      // estado (REQ-014 criterio 15). Mutuamente excluyentes por construcción: uno entra a
      // `resuelto`, el otro sale — el `stateChange` de arriba es el mismo para los dos casos.
      if (stateChange?.next === RequirementState.Resuelto) {
        events.push(requirementResolved({
          requirement: entity,
          actorId: actor,
          actorEnvelope: ctx.actor,
          snapshot,
          recipients,
          from: stateChange.previous,
          // LEÍDOS DE LA FILA YA ACTUALIZADA, no del payload (D-7): el hook acaba de escribir
          // `finishedAt`, y los tres campos de resolución reflejan el valor EFECTIVO, que puede
          // venir del payload o haber quedado como estaba.
          resolutionType: requirement.resolutionType,
          resolutionConclusion: requirement.resolutionConclusion,
          resolutionComment: requirement.resolutionComment,
          finishedAt: requirement.finishedAt!.toISOString(),
        }));
      } else if (leavesResolved) {
        // `leavesResolved` YA ESTÁ CALCULADA arriba (no se recalcula): es la misma condición que
        // decidió limpiar los datos de resolución.
        events.push(requirementReopened({
          requirement: entity,
          actorId: actor,
          actorEnvelope: ctx.actor,
          snapshot,
          recipients,
          from: stateChange!.previous,
          to: stateChange!.next,
        }));
      }

      // `assigned` VA ÚLTIMO (D-6): los tests de S-064 asertan por índice sobre el orden que ya
      // existe (`events[0]`, `events[1]`), y appendear acá los deja byte a byte iguales. No hay
      // razón semántica para otro orden — `emitEvents` publica en paralelo (`Promise.allSettled`)
      // y todos comparten `correlationId`.
      if (assignment?.changed) {
        events.push(requirementAssigned({
          requirement: entity,
          actorId: actor,
          actorEnvelope: ctx.actor,
          snapshot,
          recipients,
          from: assignment.from,
          to: assignment.to,
          added: assignment.added,
          removed: assignment.removed,
          leaderId: assignment.leaderId,
        }));
      }
    }

    const reply = success<void>();
    if (events.length > 0) {
      reply.events = events;
    }
    return reply;
  },
};

export default requirementsEdit;
