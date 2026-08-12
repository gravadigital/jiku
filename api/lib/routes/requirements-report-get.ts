import { Request, Response, Router } from 'express';
import joi from 'joi';
import { Op, literal } from 'sequelize';
import { Project, Requirement } from '@jiku/models';
import logger from '../logger';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateQueryParams from '../utils/validate-query-params';

const router: Router = Router();

const querySchema = joi.object({
  search: joi.string().optional(),
  createdFrom: joi.date().iso().optional(),
  createdTo: joi.date().iso().optional(),
  projectId: joi.number().integer().optional(),
});

function buildWhereClause(query: Request['query']) {
  const { search, createdFrom, createdTo, projectId } = query as {
    search?: string;
    createdFrom?: string;
    createdTo?: string;
    projectId?: string;
  };

  const conditions: Record<string, unknown>[] = [];

  if (search) {
    if (/^\d+$/.test(search)) {
      conditions.push({ id: Number(search) });
    } else {
      conditions.push({ title: { [Op.iLike]: `%${search}%` } });
    }
  }

  if (createdFrom || createdTo) {
    const range: Record<symbol, Date> = {};
    if (createdFrom) range[Op.gte] = new Date(`${createdFrom}T00:00:00.000Z`);
    if (createdTo) range[Op.lte] = new Date(`${createdTo}T23:59:59.999Z`);
    conditions.push({ createdAt: range });
  }

  if (projectId) {
    conditions.push({ projectId: Number(projectId) });
  }

  return conditions.length ? { [Op.and]: conditions } : {};
}

function getRequirementsReport(req: Request, res: Response) {
  const whereClause = buildWhereClause(req.query);

  return Requirement.findAll({
    where: whereClause,
    include: [{ model: Project, as: 'project', attributes: ['id', 'name'] }],
    attributes: {
      include: [
        [literal(`(
          SELECT COALESCE(SUM(wt.minutes), 0)
          FROM worked_times wt
          WHERE wt.requirement_id = "Requirement"."id"
        )`), 'directMinutes'],
        [literal(`(
          SELECT COALESCE(SUM(wt.minutes), 0)
          FROM worked_times wt
          INNER JOIN objectives o ON o.id = wt.objective_id
          WHERE o.requirement_id = "Requirement"."id"
        )`), 'objectiveMinutes'],
      ],
    },
  })
    .then((requirements) => {
      const result = requirements.map((requirement) => {
        const raw = requirement.get({ plain: true }) as typeof requirement extends never ? never : Record<string, any>;
        return {
          id: raw.id,
          title: raw.title,
          type: raw.type,
          state: raw.state,
          createdBy: raw.createdBy,
          createdAt: raw.createdAt,
          inProgressAt: raw.inProgressAt,
          finishedAt: raw.finishedAt,
          totalMinutes: Number(raw.directMinutes) + Number(raw.objectiveMinutes),
          resolutionType: raw.resolutionType,
          resolutionConclusion: raw.resolutionConclusion,
          resolutionComment: raw.resolutionComment,
          project: raw.project ? { id: raw.project.id, name: raw.project.name } : null,
        };
      });
      return res.status(200).json(result);
    })
    .catch((error: Error) => {
      logger.error(`GET /requirements/report error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
    });
}

router.get('/requirements/report',
  hasAnyRole(['user', 'admin']),
  validateQueryParams(querySchema),
  getRequirementsReport
);

export default router;
