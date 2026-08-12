import { Request, Response, Router } from 'express';
import logger from '../logger';
import { Client, Project } from '@jiku/models';

const router: Router = Router();

function getAllClients(_req: Request, res: Response) {
  return Client.findAll({
    include: [
      { model: Project }
    ],
    order: [['name', 'ASC']]
  })
    .then((clients) => {
      return res.status(200).json(clients);
    })
    .catch((error) => {
      logger.error(`GET /api/clients getAllClients error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * @name Get clients
 * @description Get all clients
 * @route {GET} /api/clients
 * @response {200} OK
 * @responsebody {array<object>} [clients] get all clients
 * @responsebody {number} [clients[].id] client identifier
 * @responsebody {string} [clients[].name] client name
 * @responsebody {date} [clients[].createdAt] client created date
 * @responsebody {date} [clients[].updatedAt] client updated date
 * @response {500} Error search clients
 * @responsebody {string} [code] internal_error
 * @responsebody {string} [message] Internal error
 */

router
  .get('/clients', getAllClients);

export default router;
