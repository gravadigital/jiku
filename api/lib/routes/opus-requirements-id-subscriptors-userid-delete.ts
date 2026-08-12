import { Router, Request, Response, NextFunction } from 'express';
import { runCommand } from '../utils/bus/send-command';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateRequirement from '../utils/middlewares/validate-requirement';
import validateProjectPermissions from '../utils/middlewares/validate-project-permission';
import { RequirementSubscriptor } from '@jiku/models';
import logger from '../logger';

const router: Router = Router();

function validateSelfUnsubscribe(req: Request, res: Response, next: NextFunction) {
  if (req.params.userId !== req.user.id) {
    return res.status(403).json({ code: 'access_denied', message: 'Access denied' });
  }
  return next();
}

function validateSubscriptionExists(req: Request, res: Response, next: NextFunction) {
  return RequirementSubscriptor.findOne({
    where: { requirementId: req.requirement.id, userId: req.params.userId },
  })
    .then((subscription) => {
      if (!subscription) {
        return res.status(404).json({ code: 'subscription_not_found', message: 'Subscription not found' });
      }
      req.subscription = subscription;
      return next();
    })
    .catch((error: Error) => {
      logger.error(`DELETE /opus/requirements/:reqid/subscriptors/:userId validateSubscriptionExists error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal server error' });
    });
}

/** El borrado lo hace core; que solo pueda desuscribirse a sí mismo lo valida la api. */
async function deleteSubscription(req: Request, res: Response) {
  const ok = await runCommand(
    res,
    `requirements.${req.requirement.id}.subscriptors.${req.params.userId}.delete`,
    {}
  );
  if (!ok) {
    return;
  }

  return res.status(200).json({});
}

router.delete('/opus/requirements/:reqid/subscriptors/:userId',
  hasAnyRole(['external-user']),
  validateSelfUnsubscribe,
  validateRequirement,
  validateProjectPermissions,
  validateSubscriptionExists,
  deleteSubscription
);

export default router;
