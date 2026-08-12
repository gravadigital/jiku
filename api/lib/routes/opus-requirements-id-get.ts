import { Router, Request, Response, NextFunction } from 'express';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateRequirement from '../utils/middlewares/validate-requirement';
import validateProjectPermissions from '../utils/middlewares/validate-project-permission';
import { RequirementActivity, RequirementSubscriptor, User, VisibilityLevel } from '@jiku/models';
import logger from '../logger';

const router: Router = Router();

function loadPublicActivity(req: Request, res: Response, next: NextFunction) {
  return RequirementActivity.findAll({
    where: {
      requirementId: req.requirement.id,
      visibilityLevel: VisibilityLevel.Public,
    },
    include: [{
      model: User,
      as: 'changedByUser',
      attributes: ['id', 'name', 'email'],
    }],
    order: [['createdAt', 'ASC']],
  })
    .then((activities) => {
      req.requirementActivity = activities;
      return next();
    })
    .catch((error: Error) => {
      logger.error(`GET /opus/requirements/:reqid loadPublicActivity error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal server error' });
    });
}

function loadSubscriptors(req: Request, res: Response, next: NextFunction) {
  return RequirementSubscriptor.findAll({
    where: { requirementId: req.requirement.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
  })
    .then((subscriptors) => {
      req.requirementSubscriptors = subscriptors;
      return next();
    })
    .catch((error: Error) => {
      logger.error(`GET /opus/requirements/:reqid loadSubscriptors error: ${error.message}`);
      return res.status(500).json({ code: 'internal_error', message: 'Internal server error' });
    });
}

function sendResponse(req: Request, res: Response) {
  const requirement = req.requirement;
  const activities = req.requirementActivity || [];
  const subscriptors = (req.requirementSubscriptors || [])
    .map((sub: RequirementSubscriptor) => ({
      id: sub.user?.id,
      name: sub.user?.name,
      email: sub.user?.email,
    }))
    .filter((s: { id?: string }) => s.id);

  const lastActivity = activities.length > 0 ? activities[activities.length - 1] : null;

  return res.status(200).json({
    id: requirement.id,
    title: requirement.title,
    description: requirement.description,
    type: requirement.type,
    state: requirement.state,
    priority: requirement.priority,
    estimatedFinishDate: requirement.estimatedFinishDate,
    projectId: requirement.projectId,
    createdBy: requirement.createdBy,
    creator: requirement.creator ? {
      id: requirement.creator.id,
      name: requirement.creator.name,
      email: requirement.creator.email,
    } : null,
    createdAt: requirement.createdAt,
    scheduledAt: requirement.scheduledAt ?? null,
    inProgressAt: requirement.inProgressAt ?? null,
    inReviewAt: requirement.inReviewAt ?? null,
    finishedAt: requirement.finishedAt ?? null,
    lastActivityAt: lastActivity ? lastActivity.createdAt : null,
    requirementActivity: activities.map((activity: RequirementActivity) => ({
      id: activity.id,
      typeOfActivity: activity.typeOfActivity,
      previousValue: activity.previousValue,
      newValue: activity.newValue,
      visibilityLevel: activity.visibilityLevel,
      createdAt: activity.createdAt,
      user: activity.changedByUser ? {
        id: activity.changedByUser.id,
        name: activity.changedByUser.name,
        email: activity.changedByUser.email,
      } : null,
    })),
    subscriptors,
  });
}

router.get('/opus/requirements/:reqid',
  hasAnyRole(['user', 'external-user']),
  validateRequirement,
  validateProjectPermissions,
  loadPublicActivity,
  loadSubscriptors,
  sendResponse
);

export default router;
