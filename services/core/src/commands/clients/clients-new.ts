import joi from 'joi';
import { Client } from '@jiku/models';
import { Reply, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';

export interface ClientsNewPayload {
  name: string;
  description?: string;
}

// Equivalente al esquema de POST /api/clients en la api.
const schema = joi.object({
  name: joi.string().required(),
  description: joi.string().optional().allow(''),
});

export const clientsNew: Command<ClientsNewPayload, { id: number }> = {
  pattern: 'clients.new',

  validate(payload: unknown) {
    return validateWith<ClientsNewPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<{ id: number }>> {
    const client = await Client.create(
      { name: payload.name, description: payload.description },
      { transaction: ctx.transaction }
    );

    return success({ id: client.id });
  },
};

export default clientsNew;
