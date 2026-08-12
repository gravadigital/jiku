import { Request, Response, Router } from 'express';
const router: Router = Router();
import { Client, Project } from '@jiku/models';
import logger from '../logger';

function getClientById(req: Request, res: Response) {
  return Client.findByPk(req.params.id as string, {
    include: [
      { model: Project }
    ]
  })
    .then((clientFound) => {
      if (!clientFound) {
        return res.status(400).json({
          code: 'client_not_found',
          message: 'Client not found'
        });
      }

      return res.status(200).json(clientFound);
    })
    .catch((error) => {
      logger.error(`GET /api/clients/:id getClientById error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * @name Get client by id
 * @description Get a specific client
 * @route {GET} /api/clients/:id
 * @queryparam {number} [id] client identifier
 * @response {200} OK
 * @responsebody {object} [client] client resource
 * @response {400} Client not exists
 * @responsebody {string} [code] client_not_found
 * @responsebody {string} [message] Client not found
 * @response {500} Error getting client
 */

router
  .get('/clients/:id', getClientById);

export default router;
