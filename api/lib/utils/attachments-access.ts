import { AttachmentEntityType, Objective, ObjectiveActivity, Person, PersonObjective, Requirement, RequirementActivity, UserProjectPermission } from '@jiku/models';

export async function canUserAccessEntity(
  userId: string,
  userRoles: string[],
  entityType: string,
  entityId: number
): Promise<boolean> {
  if (entityType === AttachmentEntityType.Objective) {
    return canUserAccessObjective(userId, userRoles, entityId);
  }

  // For project: only restrict external-users
  if (!userRoles.includes('external-user')) {
    return true;
  }

  return hasProjectPermission(userId, entityType, entityId);
}

export async function canUserViewEntity(
  userId: string,
  userRoles: string[],
  entityType: string,
  entityId: number | null
): Promise<boolean> {
  // Draft anclado al usuario (entity_id null): sólo el dueño puede verlo. La
  // titularidad ya se valida por uploaded_by al recuperar el adjunto en cada
  // endpoint, por lo que aquí no hay entidad contra la cual chequear permisos.
  if (entityId === null) {
    return true;
  }

  // internal users (user, admin) can view attachments of any entity
  if (!userRoles.includes('external-user')) {
    return true;
  }

  // external-users are restricted by project permission for all entity types
  if (entityType === AttachmentEntityType.Objective) {
    const objective = await Objective.findByPk(entityId, { attributes: ['projectId'] });
    if (!objective) return false;
    const permission = await UserProjectPermission.findOne({
      where: { userId, projectId: (objective as any).projectId }
    });
    return permission !== null;
  }

  if (entityType === AttachmentEntityType.Requirement) {
    const requirement = await Requirement.findByPk(entityId, { attributes: ['projectId'] });
    if (!requirement) return false;
    const permission = await UserProjectPermission.findOne({
      where: { userId, projectId: requirement.projectId }
    });
    return permission !== null;
  }

  if (entityType === AttachmentEntityType.RequirementComment) {
    const reqActivity = await RequirementActivity.findByPk(entityId, { attributes: ['requirementId'] });
    if (!reqActivity) return false;
    const requirement = await Requirement.findByPk(reqActivity.requirementId, { attributes: ['projectId'] });
    if (!requirement) return false;
    const permission = await UserProjectPermission.findOne({ where: { userId, projectId: requirement.projectId } });
    return permission !== null;
  }

  if (entityType === AttachmentEntityType.ObjectiveComment) {
    const objActivity = await ObjectiveActivity.findByPk(entityId, { attributes: ['objectiveId'] });
    if (!objActivity) return false;
    const objective = await Objective.findByPk(objActivity.objectiveId, { attributes: ['projectId'] });
    if (!objective) return false;
    const permission = await UserProjectPermission.findOne({ where: { userId, projectId: (objective as any).projectId } });
    return permission !== null;
  }

  // Legado: entityType === 'comment' — solo filas no migradas. Remover cuando S-096
  // confirme que no quedan attachments con entity_type='comment' en producción.
  if (entityType === AttachmentEntityType.Comment) {
    const objActivity = await ObjectiveActivity.findByPk(entityId, { attributes: ['objectiveId'] });
    if (objActivity) {
      const objective = await Objective.findByPk(objActivity.objectiveId, { attributes: ['projectId'] });
      if (!objective) return false;
      const permission = await UserProjectPermission.findOne({ where: { userId, projectId: objective.projectId } });
      return permission !== null;
    }
    // May be a requirement activity comment
    const reqActivity = await RequirementActivity.findByPk(entityId, { attributes: ['requirementId'] });
    if (!reqActivity) return false;
    const requirement = await Requirement.findByPk(reqActivity.requirementId, { attributes: ['projectId'] });
    if (!requirement) return false;
    const permission = await UserProjectPermission.findOne({ where: { userId, projectId: requirement.projectId } });
    return permission !== null;
  }

  if (entityType === AttachmentEntityType.CommentDraft) {
    // entityId may be a requirementId or an objectiveId depending on the draft's origin
    const requirement = await Requirement.findByPk(entityId, { attributes: ['projectId'] });
    if (requirement) {
      const permission = await UserProjectPermission.findOne({ where: { userId, projectId: requirement.projectId } });
      return permission !== null;
    }
    const objective = await Objective.findByPk(entityId, { attributes: ['projectId'] });
    if (!objective) return false;
    const permission = await UserProjectPermission.findOne({ where: { userId, projectId: objective.projectId } });
    return permission !== null;
  }

  if (entityType === AttachmentEntityType.ObjectiveDraft
    || entityType === AttachmentEntityType.RequirementDraft) {
    // entityId is projectId for draft types
    const permission = await UserProjectPermission.findOne({ where: { userId, projectId: entityId } });
    return permission !== null;
  }

  return hasProjectPermission(userId, entityType, entityId);
}

async function canUserAccessObjective(
  userId: string,
  userRoles: string[],
  objectiveId: number
): Promise<boolean> {
  if (userRoles.includes('admin')) {
    return true;
  }

  const objective = await Objective.findByPk(objectiveId, { attributes: ['id', 'createdBy', 'projectId'] });
  if (!objective) return false;

  // Internal users (non external-user) can access any objective in a project they belong to
  if (!userRoles.includes('external-user')) {
    const permission = await UserProjectPermission.findOne({
      where: { userId, projectId: objective.projectId }
    });
    if (permission) return true;

    if (objective.createdBy === userId) return true;

    const person = await Person.findOne({ where: { userId }, attributes: ['id'] });
    if (!person) return false;

    const assignment = await PersonObjective.findOne({
      where: { personId: person.id, objectiveId }
    });
    return assignment !== null;
  }

  // External-users must have explicit project permission
  const permission = await UserProjectPermission.findOne({
    where: { userId, projectId: objective.projectId }
  });
  if (!permission) return false;

  if (objective.createdBy === userId) return true;

  const person = await Person.findOne({ where: { userId }, attributes: ['id'] });
  if (!person) return false;

  const assignment = await PersonObjective.findOne({
    where: { personId: person.id, objectiveId }
  });
  return assignment !== null;
}

async function hasProjectPermission(
  userId: string,
  entityType: string,
  entityId: number
): Promise<boolean> {
  let projectId: number | null = null;

  if (entityType === AttachmentEntityType.Project) {
    projectId = entityId;
  } else if (entityType === AttachmentEntityType.Stage) {
    // El concepto de etapa se eliminó: la tabla ya no existe. Los adjuntos históricos
    // con este entityType quedan sin proyecto que verificar, así que no se autorizan.
    return false;
  } else if (entityType === AttachmentEntityType.Requirement) {
    const requirement = await Requirement.findByPk(entityId, { attributes: ['projectId'] });
    if (!requirement) return false;
    projectId = requirement.projectId;
  } else if (entityType === AttachmentEntityType.CommentDraft) {
    const requirement = await Requirement.findByPk(entityId, { attributes: ['projectId'] });
    if (requirement) {
      projectId = requirement.projectId;
    } else {
      const objective = await Objective.findByPk(entityId, { attributes: ['projectId'] });
      if (!objective) return false;
      projectId = (objective as any).projectId;
    }
  }

  if (!projectId) return false;

  const permission = await UserProjectPermission.findOne({
    where: { userId, projectId }
  });

  return permission !== null;
}
