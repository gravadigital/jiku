import { Request, Response, Router } from 'express';
const router: Router = Router();
import { Client } from '@jiku/models';
import validateBodyFields from '../utils/validate-body-fields';
import joi from 'joi';
import { sendCommand } from '../utils/bus/send-command';

/**
 * La escritura la hace core: la api publica el comando y arma la respuesta leyendo la
 * base. Core solo devuelve el id, pero el contrato con la web es el cliente completo,
 * así que hay que recuperarlo.
 */
async function createClient(req: Request, res: Response) {
  const data = await sendCommand<{ id: number }>(res, 'clients.new', {
    name: req.body.name,
    description: req.body.description,
  });
  if (!data) {
    return;
  }

  const client = await Client.findByPk(data.id);
  return res.status(201).json(client);
}

/**
 * @name Create client
 * @description Create a new client
 * @route {POST} /api/clients
 * @bodyparam {string} [name] client name
 * @bodyparam {string} [description] (optional) client description
 * @response {201} Created
 * @responsebody {object} [client] client resource
 * @response {500} Error creating client
 * @responsebody {string} [code] internal_error
 * @responsebody {string} [message] Internal error
 */

router
  .post('/clients',
    validateBodyFields(joi.object({
      name: joi.string().required(),
      description: joi.string().optional().allow(''),
    })),
    createClient
  );

export default router;
