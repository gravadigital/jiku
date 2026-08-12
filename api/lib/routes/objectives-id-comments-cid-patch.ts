import { Router, Request, Response, NextFunction } from 'express';
import { Objective, ObjectiveActivity } from '@jiku/models';
import logger from '../logger';
import validateBodyFields from '../utils/validate-body-fields';
import joi from 'joi';
import transactionStart from '../utils/transaction-start';
import transactionCommit from '../utils/transaction-commit';

const router: Router = Router();

function findObjective(req: Request, res: Response, next: NextFunction) {
  return Objective.findByPk(req.params.id as string)
    .then((objectiveFound) => {
      if (!objectiveFound) {
        return res.status(400).json({
          code: 'objective_not_found',
          message: 'Objective not found'
        });
      }
      return next();
    })
    .catch((error) => {
      logger.error(`PATCH /api/objectives/:id/comment/:cid findObjective error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

function findObjectiveActivity(req: Request, res: Response, next: NextFunction) {
  return ObjectiveActivity.findOne({
    where: {
      id: req.params.cid,
      typeOfActivity: 'comment',
      objectiveId: req.params.id
    }
  })
    .then((objectiveActivity) => {
      if (!objectiveActivity) {
        return res.status(400).json({
          code: 'comment_not_found',
          message: 'Comment not found'
        });
      }

      if (objectiveActivity.changedBy !== req.user.id) {
        return res.status(403).json({
          code: 'forbidden',
          message: 'You do not have permission to edit this comment'
        });
      }

      res.locals.previousComment = objectiveActivity.newValue;
      return next();
    })
    .catch((error) => {
      logger.error(`PATCH /api/objectives/:id/comment/:cid findObjectiveActivity error: ${error.message}`);
      return res.status(500).json({
        code: 'internal_error',
        message: 'Internal error'
      });
    });
}

export function saveNewValue(req: Request, res: Response, next: NextFunction) {
  return ObjectiveActivity.update(
    { previousValue: res.locals.previousComment, newValue: req.body.comment },
    {
      where: {
        id: req.params.cid,
        typeOfActivity: 'comment',
        objectiveId: req.params.id,
        changedBy: req.user.id
      },
      transaction: req.transaction
    }
  )
    .then(() => {
      return next();
    })
    .catch((error) => {
      logger.error(`PATCH /api/objectives/:id/comment/:cid saveNewValue error: ${error.message}`);
      return req.transaction.rollback()
        .then(() => {
          return res.status(500).json({
            code: 'internal_error',
            message: 'Internal error'
          });
        });
    });
}

function successPatch(_req: Request, res: Response) {
  return res.status(200).json({
    code: 'comment_updated',
    message: 'Comment Updated'
  });
}

/**
 * @name Update comment
 * @description Update a comment related to a objective
 * @route {PATCH} /api/objectives/:id/comment/:cid
 * @queryparam {number} [id] objective identifier
 * @queryparam {number} [cid] comment identifier
 * @bodyparam {string} [comment] (required) new comment text
 * @response {200} OK
 * @responsebody {string} [code] comment_updated
 * @responsebody {string} [message] Comment Updated
 * @response {400} Comment not found
 * @responsebody {string} [code] comment_not_found
 * @responsebody {string} [message] Comment not found
 * @response {500} Internal error
 * @responsebody {string} [code] internal_error
 * @responsebody {string} [message] Internal error
 */

router.patch(
  '/objectives/:id/comment/:cid',
  validateBodyFields(
    joi.object({
      comment: joi.string().required()
    })
  ),
  findObjective,
  findObjectiveActivity,
  transactionStart,
  saveNewValue,
  transactionCommit,
  successPatch
);

export default router;
