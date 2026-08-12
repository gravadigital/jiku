import joi from 'joi';
import { Client } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { pickPresent, validateWith } from '../validate';

export interface ClientsEditPayload {
  name?: string;
  description?: string | null;
}

/**
 * Sin campos requeridos: toda edición es parcial.
 *
 * `name` no acepta null porque es obligatorio al crear, y el protocolo dice que
 * mandar null en un campo obligatorio falla. `description` sí lo acepta: vaciarlo es
 * válido.
 */
const schema = joi.object({
  name: joi.string().optional(),
  description: joi.string().optional().allow('', null),
});

export const clientsEdit: Command<ClientsEditPayload, void> = {
  pattern: 'clients.{id}.edit',

  validate(payload: unknown) {
    return validateWith<ClientsEditPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<void>> {
    const client = await Client.findByPk(ctx.params.id, { transaction: ctx.transaction });

    if (!client) {
      return failure(ErrorCode.CLIENT_NOT_FOUND, 'Client not found');
    }

    // Solo las claves presentes: una ausente se deja como estaba.
    const changes = pickPresent(payload, ['name', 'description']);
    if (Object.keys(changes).length > 0) {
      await client.update(changes, { transaction: ctx.transaction });
    }

    return success();
  },
};

export default clientsEdit;
