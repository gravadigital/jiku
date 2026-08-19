import { CommandRegistry } from './registry';
import clientsNew from './clients/clients-new';
import clientsEdit from './clients/clients-edit';
import projectsNew from './projects/projects-new';
import projectsEdit from './projects/projects-edit';
import tasksNew from './tasks/tasks-new';
import tasksEdit from './tasks/tasks-edit';
import tasksComment from './tasks/tasks-comment';
import requirementsNew from './requirements/requirements-new';
import requirementsEdit from './requirements/requirements-edit';
import requirementsResolve from './requirements/requirements-resolve';
import requirementsComment from './requirements/requirements-comment';
import {
  requirementsSubscriptorsNew,
  requirementsSubscriptorsDelete,
} from './requirements/requirements-subscriptors';
import filesRequestUpload from './files/files-request-upload';
import filesRequestDownload from './files/files-request-download';
import { workedTimesNew, workedTimesDelete } from './times/worked-times';
import { unworkedTimesNew, unworkedTimesDelete } from './times/unworked-times';

/**
 * Registro único de comandos. Agregar uno nuevo es sumarlo a esta lista.
 *
 * Los patrones tienen que coincidir con `docs/apis/core.yaml`.
 */
export const registry = new CommandRegistry().registerAll([
  clientsNew,
  clientsEdit,
  projectsNew,
  projectsEdit,
  tasksNew,
  tasksEdit,
  tasksComment,
  requirementsNew,
  requirementsEdit,
  requirementsResolve,
  requirementsComment,
  requirementsSubscriptorsNew,
  requirementsSubscriptorsDelete,
  filesRequestUpload,
  filesRequestDownload,
  workedTimesNew,
  workedTimesDelete,
  unworkedTimesNew,
  unworkedTimesDelete,
]);

export default registry;
