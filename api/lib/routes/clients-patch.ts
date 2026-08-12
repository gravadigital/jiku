import { Request, Response, Router } from 'express';
const router: Router = Router();
import validateBodyFields from '../utils/validate-body-fields';
import joi from 'joi';
import { runCommand } from '../utils/bus/send-command';

/**
 * La escritura la hace core; la api arma el cuerpo de respuesta que espera la web.
 *
 * El "cliente no existe" lo resuelve core: responde `client_not_found`, que
 * `httpStatusFor` traduce a 400.
 */
async function updateClient(req: Request, res: Response) {
  const ok = await runCommand(res, `clients.${req.params.id}.edit`, req.body);
  if (!ok) {
    return;
  }

  return res.status(200).json({
    code: 'client_updated',
    message: 'Client Updated',
  });
}

/**
 * @name Update client
 * @description Update a client
 * @route {PATCH} /api/clients/:id
 * @queryparam {number} [id] client identifier
 * @bodyparam {string} [name] (optional) client name
 * @bodyparam {string} [description] (optional) client description
 * @response {200} OK
 * @responsebody {object} [code] client_updated
 * @response {400} Client not exists
 * @responsebody {string} [code] client_not_found
 * @responsebody {string} [message] Client not found
 * @response {500} Error updating client
 */

router
  .patch('/clients/:id',
    validateBodyFields(joi.object({
      name: joi.string().optional(),
      description: joi.string().optional().allow(''),
    })),
    updateClient
  );

export default router;
