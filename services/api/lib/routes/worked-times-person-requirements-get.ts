import { Request, Response, Router } from 'express';
import { Op } from 'sequelize';
import joi from 'joi';
import validateQueryParams from '../utils/validate-query-params';
import hasAnyRole from '../utils/middlewares/has-any-role';
import logger from '../logger';
import { Person, Project, Requirement, RequirementState } from '@jiku/models';

const router: Router = Router();

const querySchema = joi.object({
  personId: joi.number().integer().required()
});

function getPersonRequirements(req: Request, res: Response) {
  const personId = Number(req.query.personId);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return Requirement.findAll({
    attributes: ['id', 'title', 'state', 'projectId'],
    where: {
      state: { [Op.ne]: RequirementState.Cancelado },
      [Op.or]: [
        { state: { [Op.ne]: RequirementState.Resuelto } },
        {
          state: RequirementState.Resuelto,
          finishedAt: { [Op.gt]: sevenDaysAgo }
        }
      ]
    },
    include: [
      {
        model: Person,
        as: 'responsiblePeople',
        where: { id: personId },
        attributes: [],
        through: { attributes: [] },
        required: true
      },
      {
        model: Project,
        as: 'project',
        attributes: ['id', 'name']
      }
    ]
  })
    .then((requirements) => {
      const response = requirements.map((req) => ({
        id: req.id,
        title: req.title,
        state: req.state,
        projectId: req.projectId,
        projectName: req.project?.name || null
      }));
      return res.status(200).json(response);
    })
    .catch((error) => {
      logger.error(`GET /api/worked-times/person-requirements error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * @name Get person requirements for worked times
 * @description Get requirements where the person is responsible, eligible for time tracking
 * @route {GET} /api/worked-times/person-requirements
 * @queryparam {number} personId Person ID
 * @response {200} OK
 * @response {400} Invalid fields
 * @response {403} Access denied
 * @response {500} Internal error
 */
router.get('/worked-times/person-requirements',
  hasAnyRole(['user', 'admin']),
  validateQueryParams(querySchema),
  getPersonRequirements
);

export default router;
