import joi from 'joi';
import { Op } from 'sequelize';
import { AttachmentEntityType, Objective, ObjectiveActivity, Person, PersonObjective, Requirement } from '@jiku/models';
import { DomainEvent, ErrorCode, Reply, TaskSnapshot, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { pickPresent, validateWith } from '../validate';
import { syncFileLinks } from '../link-files';
import { resolveActor } from '../resolve-actor';
import { TASK_PRIORITY_VALUES, TaskPriority, resolvePriority } from './priority';
import { activityVisibility } from './activity';
import { taskStateChanged, taskUpdated } from '../../events/domain/task';
import { readTaskResponsiblePersonIds, taskToSnapshot } from '../../events/domain/task-snapshot';

const COMPONENT = 'tasks.edit';

export interface TasksEditPayload {
  editor?: string;
  title?: string;
  description?: string | null;
  estimatedFinishDate?: Date | null;
  state?: string;
  area?: string;
  priority?: TaskPriority;
  /** Escape transitorio: número original que manda la api. Ver priority.ts */
  priorityValue?: number;
  responsiblePersonIds?: number[];
  visibilityLevel?: string;
  requirementId?: number | null;
  fileIds?: number[];
}

/**
 * Sin campos requeridos: toda edición es parcial.
 *
 * Un campo ausente se deja como estaba; para vaciarlo hay que mandar null explícito.
 *
 * `editor` es OPCIONAL en el esquema, no obstante `objective_activity.changed_by` tener una
 * foreign key contra `users`: con sobre, `resolveActor` toma `actor.id` y el campo sería
 * redundante; sin sobre, sale del subject. Lo que sigue siendo obligatorio es que ALGUNA de
 * las dos fuentes produzca un actor — lo exige `execute()`, no Joi, porque Joi no ve el sobre
 * (lo extrae el despachador antes de validar). Ver docs/apis/core.yaml.
 */
const schema = joi.object({
  editor: joi.string().optional(),
  title: joi.string().optional(),
  description: joi.string().allow('', null).optional(),
  // Ver tasks-new: la columna es STRING.
  estimatedFinishDate: joi.date().allow(null).optional().custom((value) =>
    value instanceof Date ? value.toISOString().split('T')[0] : value
  ),
  state: joi.string()
    .valid('backlog', 'activo', 'finalizado', 'cancelado', 'en_revision')
    .optional(),
  area: joi.string().valid('diseño', 'desarrollo', 'gestion', 'investigacion').optional(),
  priority: joi.string().valid(...TASK_PRIORITY_VALUES).optional(),
  responsiblePersonIds: joi.array().items(joi.number().integer()).optional(),
  visibilityLevel: joi.string().valid('public', 'internal').optional(),
  requirementId: joi.number().integer().allow(null).optional(),
  priorityValue: joi.number().integer().min(0).max(5).optional(),
  // Campo NUEVO en S-003, igual que en `tasks-new`. Conjunto COMPLETO: ausente = no se toca,
  // `[]` = desvincular todo.
  fileIds: joi.array().max(10).items(joi.number().integer().positive()).optional(),
});

/** Campos que dejan rastro en `objective_activities`. */
const TRACKED = ['title', 'estimatedFinishDate', 'state', 'area', 'priority', 'description'] as const;

function asComparable(field: string, value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (field === 'estimatedFinishDate') {
    const date = new Date(value as string);
    return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
  }
  return String(value);
}

export const tasksEdit: Command<TasksEditPayload, void> = {
  pattern: 'tasks.{id}.edit',

  validate(payload: unknown) {
    return validateWith<TasksEditPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<void>> {
    const actor = resolveActor(ctx, payload.editor, COMPONENT);
    if (!actor) {
      return failure(ErrorCode.INVALID_FIELDS, 'Falta el editor de la tarea');
    }

    const task = await Objective.findByPk(ctx.params.id, { transaction: ctx.transaction });
    if (!task) {
      return failure(ErrorCode.OBJECTIVE_NOT_FOUND, 'Objective not found');
    }

    if (payload.responsiblePersonIds && payload.responsiblePersonIds.length > 0) {
      const count = await Person.count({
        where: { id: { [Op.in]: payload.responsiblePersonIds } },
        transaction: ctx.transaction,
      });
      if (count !== payload.responsiblePersonIds.length) {
        return failure(ErrorCode.PERSON_NOT_FOUND, 'Person not found');
      }
    }

    if (payload.requirementId !== undefined && payload.requirementId !== null) {
      const requirement = await Requirement.findByPk(payload.requirementId, {
        transaction: ctx.transaction,
      });
      if (!requirement || requirement.projectId !== task.projectId) {
        return failure(
          ErrorCode.REQUIREMENT_PROJECT_MISMATCH,
          'Requirement does not belong to the specified project'
        );
      }
    }


    // Registrar la actividad ANTES de escribir: hace falta el valor anterior.
    const changedBy = actor;
    const activities = TRACKED.flatMap((field) => {
      if (!Object.prototype.hasOwnProperty.call(payload, field)) {
        return [];
      }
      // `priority` se compara y se registra como número, que es como se guarda.
      const incoming =
        field === 'priority'
          ? resolvePriority(payload.priority, payload.priorityValue)
          : (payload as unknown as Record<string, unknown>)[field];

      const previousValue = asComparable(field, (task as any)[field]);
      const newValue = asComparable(field, incoming);

      if (previousValue === newValue) {
        return [];
      }
      // El paso a vacío no se registra, salvo en estimatedFinishDate: es el historial
      // que espera ver la web.
      if (newValue === '' && field !== 'estimatedFinishDate') {
        return [];
      }
      return [{
        typeOfActivity: field,
        previousValue,
        newValue,
        visibilityLevel: activityVisibility(field),
        objectiveId: task.id,
        changedBy,
      }];
    });

    const changes: Record<string, unknown> = pickPresent(payload, [
      'title', 'description', 'estimatedFinishDate', 'state', 'area',
      'visibilityLevel', 'requirementId',
    ]);

    if (Object.prototype.hasOwnProperty.call(payload, 'priority')) {
      changes.priority = resolvePriority(payload.priority, payload.priorityValue);
    }

    // El diff del EVENTO, calculado ACÁ y NO derivado de `activities` (CA-4, D-2): ese array
    // aplica dos reglas que son DEL HISTORIAL y no del contrato de eventos —coacciona los
    // valores a string con `asComparable` y OMITE el paso a vacío—, así que limpiar la
    // descripción no dejaría fila de historial pero SÍ tiene que emitir `task.updated`, con
    // `to: null`. Se captura ANTES del update porque el modelo `Objective` no tiene
    // `activityLog`: después del `update` Sequelize ya reseteó `_previousDataValues` y el valor
    // anterior no existe en ninguna parte. Las variables existen SIEMPRE, corra o no el
    // `update` de abajo: si no corre, la comparación posterior da "no cambió nada".
    const previousTitle = task.title;
    const previousDescription = task.description;
    const previousState = task.state;

    if (Object.keys(changes).length > 0) {
      await task.update(changes, { transaction: ctx.transaction });
    }

    // Reemplazo total de responsables, igual que la api.
    if (payload.responsiblePersonIds) {
      await PersonObjective.destroy({
        where: {
          objectiveId: task.id,
          personId: { [Op.notIn]: payload.responsiblePersonIds },
        },
        transaction: ctx.transaction,
      });
      await Promise.all(
        payload.responsiblePersonIds.map((personId, index) =>
          PersonObjective.upsert(
            { personId, objectiveId: task.id, isLeader: index === 0 },
            { transaction: ctx.transaction }
          )
        )
      );
    }

    // Conjunto COMPLETO de vínculos, misma semántica que `requirements.{id}.edit`. NO genera
    // entrada de historial: ningún criterio de aceptación lo pide y `TRACKED` no lo incluye a
    // propósito —agregarlo sería alcance inventado—.
    if (payload.fileIds !== undefined) {
      const linkError = await syncFileLinks({
        fileIds: payload.fileIds,
        actor,
        entityType: AttachmentEntityType.Objective,
        entityId: task.id,
        ctx,
      });
      if (linkError) {
        return linkError;
      }
    }

    await Promise.all(
      activities.map((activity) =>
        ObjectiveActivity.create(activity, { transaction: ctx.transaction })
      )
    );

    // LOS EVENTOS SE ARMAN ACÁ, AL FINAL — después del reemplazo de responsables y después de
    // todo `return linkError` de arriba (REQ-014 / S-065, Task 4): el `snapshot` tiene que
    // reflejar el estado COMPLETO de la tarea, y un `edit` que falla no llega a este punto.
    //
    // Comparar `!==` sobre los VALORES, no `String(...)`: la coacción a string es justamente lo
    // que `asComparable` hace y lo que el evento no debe hacer. Un `edit` que manda el mismo
    // valor que ya tenía no cambió nada y no debe emitir.
    const stateChanged = task.state !== previousState;
    const titleChanged = task.title !== previousTitle;
    const descriptionChanged = task.description !== previousDescription;

    const reply = success<void>();

    // TRAMPA DE ALCANCE: este comando TAMBIÉN reemplaza responsables (arriba), pero NO emite
    // `task.assigned` — es S-066. Un `edit` que solo cambia `responsiblePersonIds` no declara
    // ningún evento (stateChanged/titleChanged/descriptionChanged dan los tres `false`).
    if (stateChanged || titleChanged || descriptionChanged) {
      // `responsiblePersonIds` sale del PAYLOAD cuando está presente (la única fuente fiel al
      // orden), y de la lectura ordenada cuando no — se llama DESPUÉS del bloque de reemplazo
      // de responsables de arriba, para que la lista del `snapshot` sea la que quedó escrita.
      const responsiblePersonIds = payload.responsiblePersonIds
        ?? await readTaskResponsiblePersonIds(task.id, ctx.transaction);
      // El `snapshot` se construye UNA VEZ, sobre la instancia ya actualizada (el hook
      // `setFinishedAt` ya escribió `finishedAt`), y se comparte entre los hasta dos eventos.
      const snapshot = taskToSnapshot(task, responsiblePersonIds);
      const entity = { id: task.id, projectId: task.projectId };
      const events: DomainEvent<TaskSnapshot>[] = [];

      if (stateChanged) {
        events.push(taskStateChanged({
          task: entity,
          actorId: actor,
          actorEnvelope: ctx.actor,
          snapshot,
          from: previousState,
          to: task.state,
        }));
      }

      if (titleChanged || descriptionChanged) {
        events.push(taskUpdated({
          task: entity,
          actorId: actor,
          actorEnvelope: ctx.actor,
          snapshot,
          title: titleChanged ? { from: previousTitle, to: task.title } : undefined,
          description: descriptionChanged
            ? { from: previousDescription, to: task.description }
            : undefined,
        }));
      }

      // Orden `task.state.changed` -> `task.updated`. Un `reply.events = []` no publicaría nada,
      // pero cambia el envelope del `Reply` — por eso se asigna SOLO cuando hay algo (criterio
      // 12): un `edit` de `priority` sigue devolviendo un `Reply` idéntico al de antes de esta
      // story.
      reply.events = events;
    }

    return reply;
  },
};

export default tasksEdit;
