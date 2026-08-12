import { Request, Response, Router } from 'express';
import logger from '../logger';
import validateBodyFields from '../utils/validate-body-fields';
import joi from 'joi';
import validateProjectPermissions from '../utils/middlewares/validate-project-permission';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateProject from '../utils/middlewares/validate-project';
import { Requirement, RequirementState, User } from '@jiku/models';
import { literal, OrderItem } from 'sequelize';

const router: Router = Router();

const STATE_ENUM = Object.values(RequirementState);

function buildOrderForState(state: RequirementState): OrderItem[] {
  switch (state) {
  case RequirementState.Resuelto:
    return [[literal('"Requirement"."finished_at" DESC NULLS LAST')] as unknown as OrderItem];
  default:
    return [['id', 'ASC']];
  }
}

function getProjectRequirements(req: Request, res: Response) {
  const project = req.project;
  const { state, sort = 'createdAt', limit = 20, skip = 0 } = req.query;
  const sortField = String(sort);

  const filters: any = { projectId: project.id };

  let order: OrderItem[];

  if (state && !Array.isArray(state) && STATE_ENUM.includes(state as RequirementState)) {
    filters.state = state;
    order = buildOrderForState(state as RequirementState);
  } else {
    if (state) {
      filters.state = Array.isArray(state) ? state : [state];
    }
    order = [[sortField, 'ASC']];
  }

  return Requirement.findAll({
    where: filters,
    order,
    limit: Number(limit),
    offset: Number(skip),
    attributes: ['id', 'title', 'description', 'state', 'type', 'createdAt', 'priority', 'createdBy', 'finishedAt'],
    include: [{
      model: User,
      as: 'creator',
      attributes: ['id', 'name', 'email'],
    }],
  })
    .then((requirements) => res.status(200).json(requirements))
    .catch((error: Error) => {
      logger.error(`GET /api/opus/projects/:projid/requirements getProjectRequirements error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal server error' });
    });
}

router.get('/opus/projects/:projid/requirements',
  validateBodyFields(joi.object({
    state: joi.alternatives().try(
      joi.string().valid(...STATE_ENUM),
      joi.array().items(joi.string().valid(...STATE_ENUM))
    ),
    sort: joi.string().valid('createdAt', 'title').default('createdAt'),
    limit: joi.number().integer().min(1).max(20).default(20),
    skip: joi.number().integer().min(0).default(0),
  })),
  validateProject,
  hasAnyRole(['user', 'external-user']),
  validateProjectPermissions,
  getProjectRequirements
);

export default router;
