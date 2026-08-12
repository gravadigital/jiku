import { Request, Response, Router } from 'express';
import logger from '../logger';
import { Person } from '@jiku/models';

const router: Router = Router();

function getAllPersons(_req: Request, res: Response) {
  return Person.findAll({
    where: {
      enabled: true
    }
  })
    .then((persons) => {
      return res.status(200).json(persons);
    })
    .catch((error) => {
      logger.error(`GET /api/persons getAllPersons error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

/**
 * @name Get persons
 * @description Get all persons with enabled = true status
 * @route {GET} /api/persons
 * @response {200} OK
 * @responsebody {array<object>} [persons] get all active persons
 * @responsebody {number} [persons[].id] person identifier
 * @responsebody {string} [persons[].firstName] person first name
 * @responsebody {string} [persons[].lastName] person last name
 * @responsebody {boolean} [persons[].enabled] person status
 * @responsebody {date} [persons[].initDate] person init date
 * @responsebody {date} [persons[].endDate] person end date
 * @responsebody {date} [persons[].createdAt] person created date
 * @responsebody {date} [persons[].updatedAt] person updated date
 * @response {500} Error search persons
 * @responsebody {string} [code] internal_error
 * @responsebody {string} [message] Internal error
 */

router
  .get('/persons', getAllPersons);

export default router;
