import { Router, Request, Response, NextFunction } from 'express';
import { runCommand } from '../utils/bus/send-command';
import validateRequirement from '../utils/middlewares/validate-requirement';
import { RequirementSubscriptor, User, UserProjectPermission } from '@jiku/models';
import joi from 'joi';
import validateBodyFields from '../utils/validate-body-fields';
import logger from '../logger';

const router: Router = Router();

function validateUserToSubscribe(req: Request, res: Response, next: NextFunction) {
  return User.findByPk(req.body.userId)
    .then((user) => {
      if (!user) {
        return res.status(404).json({ code: 'user_not_found', message: 'User not found' });
      }
      return next();
    })
    .catch((error: Error) => {
      logger.error(`POST /opus/requirements/:reqid/subscriptors validateUserToSubscribe error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal server error' });
    });
}

function validatePermissionFromUserBody(req: Request, res: Response, next: NextFunction) {
  return UserProjectPermission.findOne({
    where: { userId: req.body.userId, projectId: req.project.id },
  })
    .then((permission) => {
      if (!permission) {
        return res.status(403).json({ code: 'no_permission', message: 'User does not have permission for this project' });
      }
      return next();
    })
    .catch((error: Error) => {
      logger.error(`POST /opus/requirements/:reqid/subscriptors validatePermissionFromUserBody error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal server error' });
    });
}

function checkNotAlreadySubscribed(req: Request, res: Response, next: NextFunction) {
  return RequirementSubscriptor.findOne({
    where: { requirementId: req.requirement.id, userId: req.body.userId },
  })
    .then((subscriptor) => {
      if (subscriptor) {
        return res.status(400).json({ code: 'already_subscribed', message: 'User is already subscribed to this requirement' });
      }
      return next();
    })
    .catch((error: Error) => {
      logger.error(`POST /opus/requirements/:reqid/subscriptors checkNotAlreadySubscribed error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal server error' });
    });
}

/** La escritura la hace core; las validaciones de permiso se quedan acá. */
async function createSubscription(req: Request, res: Response) {
  const ok = await runCommand(res, `requirements.${req.requirement.id}.subscriptors.new`, {
    userId: req.body.userId,
  });
  if (!ok) {
    return;
  }

  return res.status(200).json({});
}

router.post('/opus/requirements/:reqid/subscriptors',
  validateBodyFields(joi.object({ userId: joi.string().required() })),
  validateRequirement,
  validateUserToSubscribe,
  validatePermissionFromUserBody,
  checkNotAlreadySubscribed,
  createSubscription
);

export default router;
