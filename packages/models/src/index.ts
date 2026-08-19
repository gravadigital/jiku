/**
 * Modelos Sequelize de la base de gestión.
 *
 * Un solo lugar para los dos servicios que la usan: la api (que lee) y core (que
 * escribe), para que no puedan divergir.
 *
 * El paquete NO abre la conexión: exporta las clases y cada servicio las registra en su
 * propio Sequelize, porque conectan con credenciales distintas.
 */

import Attachment from './attachment.model';
import Client from './client.model';
import ExternalIntegrationConfig from './external-integration-config.model';
import ExternalProject from './external-project.model';
import ExternalSyncEvent from './external-sync-event.model';
import File from './file.model';
import InboundMailThread from './inbound-mail-thread.model';
import ObjectiveMailThread from './objective-mail-thread.model';
import ObjectiveSubscriptor from './objective-subscriptor.model';
import Objective from './objectives.model';
import ObjectiveActivity from './objective-activity.model';
import Origin from './origin.model';
import PersonObjective from './person-objective.model';
import PersonRequirement from './person-requirement.model';
import Person from './person.model';
import ProjectPerson from './project-person.model';
import ProjectStatusUpdate from './project-status-update.model';
import Project from './project.model';
import RequirementActivity from './requirement-activity.model';
import RequirementMailThread from './requirement-mail-thread.model';
import RequirementSubscriptor from './requirement-subscriptor.model';
import Requirement from './requirement.model';
import Resource from './resource.model';
import SystemSetting from './system-setting.model';
import UnworkedTime from './unworked-time.model';
import UserProjectPermission from './user-project-permission.model';
import User from './user.model';
import WeekAssignedTime from './week-assigned-time.model';
import WorkedTime from './worked-time.model';

export { default as Attachment, AttachmentEntityType } from './attachment.model';
export { RetentionStatus } from './retention-status.enum';
export { default as Client } from './client.model';
export { default as ExternalIntegrationConfig } from './external-integration-config.model';
export { default as ExternalProject } from './external-project.model';
export { default as ExternalSyncEvent } from './external-sync-event.model';
export { default as File, ByteStatus } from './file.model';
export { default as InboundMailThread } from './inbound-mail-thread.model';
export { default as ObjectiveMailThread } from './objective-mail-thread.model';
export { default as ObjectiveSubscriptor } from './objective-subscriptor.model';
export { default as Objective, statusObjective } from './objectives.model';
export { default as ObjectiveActivity, activityVisibilityLevel } from './objective-activity.model';
export { default as Origin } from './origin.model';
export { default as PersonObjective } from './person-objective.model';
export { default as PersonRequirement } from './person-requirement.model';
export { default as Person } from './person.model';
export { default as ProjectPerson } from './project-person.model';
export { default as ProjectStatusUpdate } from './project-status-update.model';
export { default as Project, DefaultKeyValuePairs, defaultKeyValuePairsList } from './project.model';
export { default as RequirementActivity, RequirementActivityType, VisibilityLevel } from './requirement-activity.model';
export { default as RequirementMailThread } from './requirement-mail-thread.model';
export { default as RequirementSubscriptor } from './requirement-subscriptor.model';
export { default as Requirement, RequirementVisibilityLevel, RequirementType, RequirementPriority, RequirementState, RequirementResolution, FieldActivityChange } from './requirement.model';
export { default as Resource } from './resource.model';
export { default as SystemSetting } from './system-setting.model';
export { default as UnworkedTime, UnworkedReason } from './unworked-time.model';
export { default as UserProjectPermission } from './user-project-permission.model';
export { default as User } from './user.model';
export { default as WeekAssignedTime } from './week-assigned-time.model';
export { default as WorkedTime } from './worked-time.model';

/**
 * Todas las clases de modelo, para registrarlas en un Sequelize.
 *
 * Explícito y no un glob de archivos: así el compilador avisa si falta uno, y funciona
 * igual corriendo desde TypeScript o desde el JavaScript compilado.
 *
 *     new Sequelize({ ..., models: allModels })
 */
export const allModels = [
  Attachment,
  Client,
  ExternalIntegrationConfig,
  ExternalProject,
  ExternalSyncEvent,
  File,
  InboundMailThread,
  ObjectiveMailThread,
  ObjectiveSubscriptor,
  Objective,
  ObjectiveActivity,
  Origin,
  PersonObjective,
  PersonRequirement,
  Person,
  ProjectPerson,
  ProjectStatusUpdate,
  Project,
  RequirementActivity,
  RequirementMailThread,
  RequirementSubscriptor,
  Requirement,
  Resource,
  SystemSetting,
  UnworkedTime,
  UserProjectPermission,
  User,
  WeekAssignedTime,
  WorkedTime,
];
