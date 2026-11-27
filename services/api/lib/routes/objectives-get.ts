import { NextFunction, Request, Response, Router } from 'express';
import logger from '../logger';
import { Objective, Person, Project, WorkedTime } from '@jiku/models';
import parseGetParams from '../utils/parse-query-params';
import validateQueryParams from '../utils/validate-query-params';
import joi from 'joi';
import {Op, WhereOptions} from 'sequelize';

const router: Router = Router();

type WhereClause = WhereOptions<{
  area?: string;
  personId?: number;
  projectId?: number;
  title?: { [Op.iLike]: string };
  state?: { [Op.or]: string[] };
}>;

function buildWhereClauses(params: {
  search?: string;
  state?: string;
  area?: string;
  projectId?: number;
  projectName?: string;
}) {
  const { search, state, area, projectId, projectName } = params || {};

  const whereClause: WhereClause =
    [
      area && { area },
      projectId && { projectId },
      search && {
        title: {
          [Op.iLike]: '%' + search + '%'
        }
      },
      state && {
        state: {
          [Op.or]: state.split(',').map(s => s.trim())
        }
      },
    ]
      .reduce((acc, condition) => (condition ? { ...acc, ...condition } : acc), {});

  const whereProject =
    [
      projectName && { name: { [Op.iLike]: '%' + projectName + '%' } },
    ]
      .reduce((acc, condition) => (condition ? { ...acc, ...condition } : acc), {});

  return { whereClause, whereProject };
}


function getAllObjectives(req: Request, res: Response, next: NextFunction) {
  const { sort, limit, page, personId } = req.parsedParams || {};
  const offset = (page - 1) * limit;

  const { whereClause, whereProject } = buildWhereClauses(req.parsedParams);

  return Objective.findAll({
    order: sort,
    limit: limit,
    offset: offset,
    where: whereClause,
    include: [
      { model: Project, where: whereProject },
      {
        model: Person,
        through: {
          attributes: ['isLeader'],
        },
        where: personId ? { id: personId } : undefined,
      },
      {
        model: WorkedTime,
        as: 'workedTime',
        required: false,
        include: [
          {
            model: Person,
            as: 'person',
            attributes: ['id', 'firstName', 'lastName'],
            required: false,
          },
        ],
      },
    ],
  })
    .then((objectives) => {
      res.locals.objectives = objectives;
      next();
    })
    .catch((error) => {
      logger.error(`GET /api/objectives getAllObjectives error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error',
      });
    });
}

function getTotalMinutes(_req: Request, res: Response) {
  const objectives = res.locals.objectives;

  const objectivesWithTotalMinutes = objectives.map((objective: Objective) => {
    const workedMinutes = objective.workedTime.reduce((sum, workedTime) => sum + workedTime.minutes, 0);

    const workedTimeByPerson = objective.workedTime.reduce((acc: Record<number, any>, workedTime) => {
      const personId = workedTime.personId;
      if (!acc[personId]) {
        acc[personId] = {
          id: workedTime.id,
          minutes: 0,
          person: workedTime.person,
          personId: workedTime.personId,
          date: workedTime.date,
          createdAt: workedTime.createdAt,
        };
      }
      acc[personId].minutes += workedTime.minutes;
      return acc;
    }, {});

    const groupedWorkedTime = Object.values(workedTimeByPerson);

    const workedTimeArray = objective.workedTime.map((workedTime) => ({
      id: workedTime.id,
      minutes: workedTime.minutes,
      person: workedTime.person,
      personId: workedTime.personId,
      date: workedTime.date,
      createdAt: workedTime.createdAt,
    }));

    return {
      ...objective.toJSON(),
      workedMinutes,
      workedTime: groupedWorkedTime,
      workedTimeDetailed: workedTimeArray,
    };
  });

  res.status(200).json(objectivesWithTotalMinutes);
}

function getObjectivesCount(req: Request, res: Response, next: NextFunction) {
  if (!req.parsedParams.count) {
    return next();
  }

  const { personId } = req.parsedParams || {};
  const { whereClause, whereProject } = buildWhereClauses(req.parsedParams);

  return Objective.count({
    where: whereClause,
    include: [
      { model: Project, where: whereProject },
      {
        model: Person,
        through: { attributes: [] },
        where: personId ? { id: personId } : undefined,
      }
    ],
    distinct: true,
    col: 'id'
  })
    .then((count) => {
      return res.status(200).json(count);
    })
    .catch((error) => {
      logger.error(`GET /api/objectives getObjectivesCount error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * @name Get objectives
 * @description Get all objectives with their relations
 * @route {GET} /api/objectives
 * @queryparam (optional) {string} [sort] Sorting criteria
 * @queryparam (optional) {number} [limit] Limit of objectives to retrieve
 * @queryparam (optional) {string} [search] Search term for objective title
 * @queryparam (optional) {string} [state] Filter by objective state (allow multiple states separated by comma)
 * @queryparam (optional) {string} [area] Filter by objective area
 * @queryparam (optional) {number} [personId] Filter by person identifier
 * @queryparam (optional) {number} [projectId] Filter by project identifier
 * @queryparam (optional) {string} [projectName] Filter by project name
 * @queryparam (optional) {number} [page] Page number for pagination
 * @queryparam (optional) {boolean} [count] If true, return the count of objectives
 * @response {200} OK
 * @responsebody {array<object>} [objectives] get all objectives
 * @responsebody {number} [objectives[].id] objective identifier
 * @responsebody {string} [objectives[].title] objective title
 * @responsebody {string} [objectives[].description] objective description
 * @responsebody {date} [objectives[].finishedAt] objective actual finish date
 * @responsebody {string} [objectives[].state] objective state
 * @responsebody {string} [objectives[].area] objective area
 * @responsebody {number} [objectives[].priority] objective priority
 * @responsebody {number} [objectives[].projectId] project identifier
 * @responsebody {date} [objectives[].createdAt] objective created date
 * @responsebody {date} [objectives[].updatedAt] objective updated date
 * @responsebody {object} [objectives[].project] Related project details
 * @responsebody {object} [objectives[].persons] Related responsible persons details
 * @responsebody {boolean} [objectives[].persons[].isLeader] indicates if the person is the leader
 * @responsebody {number} [objectives[].workedMinutes] objective worked minutes
 * @response {500} Error search objectives
 * @responsebody {string} [code] internal_error
 * @responsebody {string} [message] Internal error
 */
/**
 * @name Get amount of objectives
 * @description Return the amount of objectives with filters
 * @route {GET} /api/objectives
 * @queryparam {boolean} [count] TRUE
 * @queryparam (optional) {string} [sort] Sorting criteria
 * @queryparam (optional) {string} [search] Search term for objective title
 * @queryparam (optional) {string} [state] Filter by objective state (allow multiple states separated by comma)
 * @queryparam (optional) {string} [area] Filter by objective area
 * @queryparam (optional) {number} [personId] Filter by person identifier
 * @queryparam (optional) {number} [projectId] Filter by project identifier
 * @queryparam (optional) {string} [projectName] Filter by project name
 * @response {200} All objectives
 * @responsebody {number} [*] amount of objectives
 * @response {500} Error search objectives
 * @responsebody {string} [code] internal_error
 * @responsebody {string} [message] Internal error
 */


router
  .get('/objectives',
    validateQueryParams(
      joi.object({
        sort: joi.string(),
        page: joi.number().default(1).min(1),
        limit: joi.number().default(200).min(1).max(200),
        search: joi.string(),
        state: joi.string(),
        area: joi.string().valid('diseño', 'desarrollo', 'gestion', 'investigacion'),
        personId: joi.number(),
        projectId: joi.number(),
        projectName: joi.string().min(1),
        count: joi.boolean(),
        visibilityLevel: joi.string().valid('public', 'internal'),
      })
    ),
    parseGetParams(),
    getObjectivesCount,
    getAllObjectives,
    getTotalMinutes
  );

export default router;

