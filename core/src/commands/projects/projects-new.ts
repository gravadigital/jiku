import joi from 'joi';
import { Client, Project } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';
import { Property, propertiesSchema, propertiesToKeyValuePairs } from './properties';

export interface ProjectsNewPayload {
  creator: string;
  name: string;
  code: string;
  status?: string;
  type?: string;
  description?: string;
  initDate?: Date;
  endDate?: Date | null;
  clientId?: number | null;
  properties?: Property[];
}

/**
 * `status`, `type`, `description` e `initDate` son opcionales con valor por defecto,
 * según el protocolo.
 */
const schema = joi.object({
  creator: joi.string().required(),
  name: joi.string().required(),
  code: joi.string().required(),
  status: joi.string()
    .valid('analisis', 'activo', 'inactivo', 'finalizado', 'cancelado')
    .default('analisis'),
  type: joi.string()
    .valid('interno', 'comercial', 'investigacion', 'propuesta')
    .default('comercial'),
  description: joi.string().allow('').optional(),
  initDate: joi.date().default(() => new Date()),
  endDate: joi.date().allow(null).optional(),
  clientId: joi.number().integer().allow(null).optional(),
  properties: propertiesSchema,
});

export const projectsNew: Command<ProjectsNewPayload, { id: number }> = {
  pattern: 'projects.new',

  validate(payload: unknown) {
    return validateWith<ProjectsNewPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<{ id: number }>> {
    if (payload.clientId !== undefined && payload.clientId !== null) {
      const client = await Client.findByPk(payload.clientId, { transaction: ctx.transaction });
      if (!client) {
        return failure(ErrorCode.CLIENT_NOT_FOUND, 'Client not found');
      }
    }

    const project = await Project.create(
      {
        name: payload.name,
        code: payload.code,
        status: payload.status,
        type: payload.type,
        description: payload.description,
        initDate: payload.initDate,
        endDate: payload.endDate ?? null,
        clientId: payload.clientId ?? null,
        keyValuePairs: propertiesToKeyValuePairs(payload.properties),
        createdBy: payload.creator,
      },
      { transaction: ctx.transaction }
    );

    return success({ id: project.id });
  },
};

export default projectsNew;
