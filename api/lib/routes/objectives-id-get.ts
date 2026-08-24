import { Request, NextFunction, Response, Router } from 'express';
import logger from '../logger';
import { Objective, ObjectiveActivity, Person, Project, User, WorkedTime } from '@jiku/models';
const router: Router = Router();

function getObjectiveById(req: Request, res: Response, next: NextFunction) {
  return Objective.findOne({
    where: {
      id: req.params.id
    },
    include: [Project,
      { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
      {
        model: ObjectiveActivity,
        include: [
          { model: User, as: 'user', attributes: ['id', 'name', 'email'] }
        ]
      },
      {
        model: Person,
        through: {
          attributes: ['isLeader'],
        },
      },
      {
        model: WorkedTime,
        as: 'workedTime',
        required: false,
      },
    ],
  })
    .then((objectiveFound) => {
      if (!objectiveFound) {
        return res.status(400).json({
          code: 'objective_not_found',
          message: 'Objective not found'
        });
      }

      res.locals.objective = objectiveFound;
      return next();
    })
    .catch((error) => {
      logger.error(`GET /api/objectives/:id getObjectiveById error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

function getTotalMinutes(_req: Request, res: Response) {
  const objective: Objective = res.locals.objective;

  const workedTimes = objective.workedTime || [];

  const workedMinutes = workedTimes.reduce((sum, workedTime) => {
    return sum + (workedTime.minutes || 0);
  }, 0);

  const objectiveWithTotalMinutes = {
    ...objective.toJSON(),
    workedMinutes,
  };
  return res.status(200).json(objectiveWithTotalMinutes);
}

/**
 * @name Get objective by id
 * @description Get an objective by id and their relations
 * @route {GET} /api/objectives/:id
 * @queryparam {number} [id] objective identifier
 * @response {200} OK
 * @responsebody {object} [objective] get objective by id
 * @responsebody {number} [objective.id] objective identifier
 * @responsebody {string} [objective.title] objective title
 * @responsebody {string} [objective.description] objective description
 * @responsebody {date} [objective.estimatedFinishDate] objective estimated finish date
 * @responsebody {string} [objective.state] objective state
 * @responsebody {string} [objective.state] objective area
 * @responsebody {number} [objective.priority] objective priority
 * @responsebody {number} [objective.projectId] project identifier
 * @responsebody {date} [objective.createdAt] objective created date
 * @responsebody {date} [objective.updatedAt] objective updated date
 * @responsebody {object} [objective.project] Related project details
 * @responsebody {number} [objective.workedMinutes] objective worked minutes
 * @responsebody {array<object>} [objective.objectiveActivity] Activity in the objective
 * @responsebody {array<object>} [objective.persons[]] Persons related to the objective
 * @responsebody {boolean} [objectives.persons[].isLeader] indicates if the person is the leader
 * @responsebody {<object>} [objective.creator] Details of the objective Creator
 * @response {400} Objective not exists
 * @responsebody {string} [code] objective_not_found
 * @responsebody {string} [message] Objective not found
 * @response {500} Error search objectives
 * @responsebody {string} [code] internal_error
 * @responsebody {string} [message] Internal error
 */

router
  .get('/objectives/:id',
    getObjectiveById,
    getTotalMinutes);

export default router;
