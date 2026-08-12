import { Request, Response, NextFunction, Router } from 'express';
const router: Router = Router();
import { Client, Project } from '@jiku/models';
import logger from '../logger';
import validateQueryParams from '../utils/validate-query-params';
import parseGetParams from '../utils/parse-query-params';
import hasAnyRole from '../utils/middlewares/has-any-role';
import joi from 'joi';
import { Op } from 'sequelize';

function validateClientId(req: Request, res: Response, next: NextFunction) {
  const clientId = Number(req.params.clientId);
  if (!Number.isInteger(clientId)) {
    return res.status(400).json({
      code: 'invalid_fields',
      message: 'Invalid field - clientId must be an integer'
    });
  }
  return next();
}

function validateClientExists(req: Request, res: Response, next: NextFunction) {
  const clientId = Number(req.params.clientId);
  return Client.findByPk(clientId)
    .then((client) => {
      if (!client) {
        return res.status(404).json({ code: 'client_not_found', message: 'Client not found' });
      }
      return next();
    })
    .catch((error) => {
      logger.error(`GET /api/clients/:clientId/projects validateClientExists error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

function getClientProjects(req: Request, res: Response) {
  const clientId = Number(req.params.clientId);
  const { page, limit } = req.parsedParams || {};
  const status = req.query.status as string;
  const offset = (page - 1) * limit;

  const whereClause = {
    clientId,
    ...(status && {
      status: {
        [Op.or]: status.split(',').map((s: string) => s.trim())
      }
    })
  };

  return Project.findAll({
    limit,
    offset,
    where: whereClause,
  })
    .then((projects) => {
      return res.status(200).json(projects);
    })
    .catch((error) => {
      logger.error(`GET /api/clients/:clientId/projects getClientProjects error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * @name Get client projects
 * @description Get projects associated with a specific client
 * @route {GET} /api/clients/:clientId/projects
 * @routeparam {number} clientId Client identifier
 * @queryparam (optional) {string} [status] Filter by project status (allow multiple statuses separated by comma)
 * @queryparam (optional) {number} [page] Page number for pagination
 * @queryparam (optional) {number} [limit] Limit of projects to retrieve
 * @response {200} OK
 * @responsebody {array<object>} [projects] projects of the client
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {404} Client not found
 * @response {500} Internal error
 */
router
  .get('/clients/:clientId/projects',
    hasAnyRole(['user', 'admin']),
    validateQueryParams(
      joi.object({
        status: joi.string().pattern(/^(analisis|activo|inactivo|finalizado|cancelado)(,(analisis|activo|inactivo|finalizado|cancelado))*$/),
        page: joi.number().default(1).min(1),
        limit: joi.number().default(200).min(1).max(30),
      })
    ),
    validateClientId,
    parseGetParams(),
    validateClientExists,
    getClientProjects);

export default router;
