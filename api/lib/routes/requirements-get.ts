import { NextFunction, Request, Response, Router } from 'express';
import { sequelize } from '../models';
import { Person, Project, Requirement, RequirementState, RequirementType } from '@jiku/models';
import logger from '../logger';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateQueryParams from '../utils/validate-query-params';
import joi from 'joi';
import { Op } from 'sequelize';

const router: Router = Router();

// `state` acepta un CSV de uno o varios valores. Se valida como una lista (separador ',') en la
// que cada miembro tiene que pertenecer al enum: un unico miembro invalido invalida el parametro
// completo con 400, igual que hoy, y no lo convierte en un filtro parcial silencioso (a
// diferencia de `objectives-get.ts`, que no valida sus miembros contra el enum).
const querySchema = joi.object({
  projectId: joi.number().integer().optional(),
  state: joi
    .string()
    .custom((value, helpers) => {
      const members = String(value).split(',').map((s) => s.trim());
      const validValues = Object.values(RequirementState) as string[];
      const isValid = members.every((member) => validValues.includes(member));
      if (!isValid) return helpers.error('any.only');
      return value;
    }, 'CSV of RequirementState')
    .messages({ 'any.only': `"state" must be one of [${Object.values(RequirementState).join(', ')}]` })
    .optional(),
  type: joi.string().valid(...Object.values(RequirementType)).optional(),
  priority: joi.string().optional(),
  createdBy: joi.string().optional(),
  estimatedFinishDate: joi.date().optional(),
  tag: joi.string().optional(),
  search: joi.string().optional(),
  page: joi.number().integer().min(1).default(1),
  limit: joi.number().integer().min(1).max(100).default(20),
  sort: joi.string().optional(),
  count: joi.boolean().optional(),
});

// Un solo constructor del `where` para listado y conteo: si cada uno armara el suyo, un filtro
// nuevo agregado a uno y no al otro los haria divergir sin que ningun test lo note.
function buildWhere(query: any) {
  const { projectId, state, type, priority, createdBy, estimatedFinishDate, tag, search } = query;

  const where: any = {};
  if (projectId) where.projectId = Number(projectId);
  if (state) where.state = { [Op.or]: String(state).split(',').map((s) => s.trim()) };
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

  return where;
}

function getRequirementsCount(req: Request, res: Response, next: NextFunction) {
  // `count` llega como string: Express 5 no coerciona req.query, y validateQueryParams descarta
  // el value que Joi devuelve ya coercido (solo usa `error`). Por eso se compara contra 'true' en
  // vez de evaluar la verdad del valor: el string 'false' es truthy y devolveria el conteo a quien
  // pidio el listado.
  if (String(req.query.count) !== 'true') {
    return next();
  }

  // Sin `include`: ningun filtro depende de las relaciones -`project` y `responsiblePeople` se
  // incluyen solo para armar el cuerpo del listado-, asi que no hay filas duplicadas que obliguen
  // al `distinct` que si necesita el conteo de objectives.
  return Requirement.count({ where: buildWhere(req.query) })
    .then((count) => {
      return res.status(200).json(count);
    })
    .catch((error) => {
      logger.error(`[GET /requirements] getRequirementsCount error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
    });
}

function getRequirements(req: Request, res: Response) {
  const { page = 1, limit = 20 } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);

  const where = buildWhere(req.query);

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
  getRequirementsCount,
  getRequirements
);

export default router;
