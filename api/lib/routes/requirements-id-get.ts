import { Request, Response, Router } from 'express';
import { Objective, Person, Project, Requirement, RequirementActivity, User } from '@jiku/models';
import logger from '../logger';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateRequirement from '../utils/middlewares/validate-requirement';

const router: Router = Router();

function getRequirementDetail(req: Request, res: Response) {
  return Requirement.findOne({
    where: { id: req.params.reqid },
    include: [
      { model: Project, as: 'project', attributes: ['id', 'name'] },
      { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
      {
        model: Person,
        as: 'responsiblePeople',
        attributes: ['id', 'firstName', 'lastName'],
        through: { attributes: ['isLeader'] },
      },
      {
        model: RequirementActivity,
        as: 'requirementActivities',
        include: [{ model: User, as: 'changedByUser', attributes: ['id', 'name', 'email'] }],
        order: [['createdAt', 'ASC']],
      },
    ],
  })
    .then((requirement) => {
      return Objective.findAll({
        where: { requirementId: req.params.reqid },
        include: [
          {
            model: Person,
            through: {
              attributes: ['isLeader'],
            },
          },
        ],
      })
        .then((linkedObjectives) => {
          const response = requirement!.toJSON() as any;
          response.activity = response.requirementActivities;
          delete response.requirementActivities;
          response.responsiblePeople = (response.responsiblePeople || []).map((person: any) => ({
            id: person.id,
            firstName: person.firstName,
            lastName: person.lastName,
            isLeader: person.PersonRequirement?.isLeader ?? null,
          }));
          response.linkedObjectives = linkedObjectives.map((objective) => objective.toJSON());
          return res.status(200).json(response);
        });
    })
    .catch((error) => {
      logger.error(`[GET /requirements/:reqid] error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal error' });
    });
}

router.get('/requirements/:reqid',
  hasAnyRole(['user', 'admin']),
  validateRequirement,
  getRequirementDetail
);

export default router;
