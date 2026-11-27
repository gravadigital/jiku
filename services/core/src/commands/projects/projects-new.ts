import joi from 'joi';
import { Client, Project } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';
import { resolveActor } from '../resolve-actor';
import { Property, propertiesSchema, propertiesToKeyValuePairs } from './properties';

const COMPONENT = 'projects.new';

export interface ProjectsNewPayload {
  creator?: string;
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
  // OPTIONAL, no `.required()`: con sobre, `creator` es redundante con `actor.id` y la api ya
  // no tiene que mandarlo (`extractActor` rechaza si lo manda Y difiere). Sin sobre —una
  // persona o un conector publicando directo— la identidad sale del subject vía `resolveActor`
  // y este campo no se usa para nada. Ver `resolveActor` para la escalera completa.
  creator: joi.string().optional(),
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
    const actor = resolveActor(ctx, payload.creator, COMPONENT);
    if (!actor) {
      // Solo alcanzable si publicó la api sin sobre y sin `creator`: el contrato exige uno de
      // los dos. Más legible que dejar que el `NOT NULL` de `created_by` falle con un
      // `internal_error` opaco.
      return failure(ErrorCode.INVALID_FIELDS, 'Falta el creador del proyecto');
    }

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
        createdBy: actor,
      },
      { transaction: ctx.transaction }
    );

    return success({ id: project.id });
  },
};

export default projectsNew;
