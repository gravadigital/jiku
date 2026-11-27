import joi from 'joi';
import { Client, Project } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { pickPresent, validateWith } from '../validate';
import { Property, propertiesSchema, propertiesToKeyValuePairs } from './properties';

export interface ProjectsEditPayload {
  name?: string;
  code?: string;
  status?: string;
  type?: string;
  description?: string | null;
  initDate?: Date;
  endDate?: Date | null;
  clientId?: number | null;
  properties?: Property[];
}

/**
 * Sin campos requeridos: toda edición es parcial.
 *
 * `name`, `code`, `status`, `type` e `initDate` no aceptan null porque son obligatorios
 * al crear, y el protocolo dice que mandar null en un campo obligatorio falla.
 *
 * Diferencia con la api: `PATCH /projects/:id` exigía casi todos los campos y vaciaba
 * `endDate` cuando no venía. Acá un campo ausente se deja como estaba, que es lo que
 * define el protocolo.
 */
const schema = joi.object({
  name: joi.string().optional(),
  code: joi.string().optional(),
  status: joi.string()
    .valid('analisis', 'activo', 'inactivo', 'finalizado', 'cancelado')
    .optional(),
  type: joi.string()
    .valid('interno', 'comercial', 'investigacion', 'propuesta')
    .optional(),
  description: joi.string().allow('', null).optional(),
  initDate: joi.date().optional(),
  endDate: joi.date().allow(null).optional(),
  clientId: joi.number().integer().allow(null).optional(),
  properties: propertiesSchema,
});

export const projectsEdit: Command<ProjectsEditPayload, void> = {
  pattern: 'projects.{id}.edit',

  validate(payload: unknown) {
    return validateWith<ProjectsEditPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<void>> {
    const project = await Project.findByPk(ctx.params.id, { transaction: ctx.transaction });

    if (!project) {
      return failure(ErrorCode.PROJECT_NOT_FOUND, 'Project not found');
    }

    if (payload.clientId !== undefined && payload.clientId !== null) {
      const client = await Client.findByPk(payload.clientId, { transaction: ctx.transaction });
      if (!client) {
        return failure(ErrorCode.CLIENT_NOT_FOUND, 'Client not found');
      }
    }

    const changes: Record<string, unknown> = pickPresent(payload, [
      'name', 'code', 'status', 'type', 'description', 'initDate', 'endDate', 'clientId',
    ]);

    // `properties` viaja con otro nombre que la columna.
    if (Object.prototype.hasOwnProperty.call(payload, 'properties')) {
      changes.keyValuePairs = propertiesToKeyValuePairs(payload.properties);
    }

    if (Object.keys(changes).length > 0) {
      await project.update(changes, { transaction: ctx.transaction });
    }

    return success();
  },
};

export default projectsEdit;
