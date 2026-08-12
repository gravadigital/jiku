import { Request, Response, Router } from 'express';
import { sequelize } from '../models';
import { Person, Project, Requirement, RequirementState, RequirementType } from '@jiku/models';
import logger from '../logger';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateQueryParams from '../utils/validate-query-params';
import joi from 'joi';
import { Op } from 'sequelize';

const router: Router = Router();

const querySchema = joi.object({
  projectId: joi.number().integer().optional(),
  state: joi.string().valid(...Object.values(RequirementState)).optional(),
  type: joi.string().valid(...Object.values(RequirementType)).optional(),
  priority: joi.string().optional(),
  createdBy: joi.string().optional(),
  estimatedFinishDate: joi.date().optional(),
  tag: joi.string().optional(),
  search: joi.string().optional(),
  page: joi.number().integer().min(1).default(1),
  limit: joi.number().integer().min(1).max(100).default(20),
  sort: joi.string().optional(),
});

function getRequirements(req: Request, res: Response) {
  const { projectId, state, type, priority, createdBy, estimatedFinishDate, tag, search, page = 1, limit = 20 } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);

  const where: any = {};
  if (projectId) where.projectId = Number(projectId);
  if (state) where.state = state;
  if (type) where.type = type;
  if (priority) where.priority = priority;
  if (createdBy) where.createdBy = createdBy;
  if (estimatedFinishDate) where.estimatedFinishDate = estimatedFinishDate;
  if (search) where.title = { [Op.iLike]: '%' + search + '%' };
  if (tag) {
    const [key, value] = String(tag).split(':');
    where.tags = sequelize.literal(
      `tags @> '[{"key": ${JSON.stringify(key)}, "value": ${JSON.stringify(value)}}]'::jsonb`
    );
  }

  return Requirement.findAll({
    where,
    include: [
      { model: Project, as: 'project', attributes: ['id', 'name'] },
      {
        model: Person,
        as: 'responsiblePeople',
        attributes: ['id', 'firstName', 'lastName'],
        through: { attributes: ['isLeader'] },
      },
    ],
    limit: Number(limit),
    offset,
    order: [['createdAt', 'DESC']],
  })
    .then((requirements) => {
      const response = requirements.map((requirement) => {
        const json = requirement.toJSON() as any;
        json.responsiblePeople = (json.responsiblePeople || []).map((person: any) => ({
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          isLeader: person.PersonRequirement?.isLeader ?? null,
        }));
        return json;
      });
      return res.status(200).json(response);
    })
    .catch((error) => {
      logger.error(`[GET /requirements] error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
    });
}

router.get('/requirements',
  hasAnyRole(['user', 'admin']),
  validateQueryParams(querySchema),
  getRequirements
);

export default router;
