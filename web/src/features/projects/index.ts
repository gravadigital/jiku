/* Components */
export { ProjectCard } from './components/ProjectCard';
export { ProjectDetails } from './components/ProjectDetails';
export { ProjectListFilters } from './components/ProjectListFilters';
export { ProjectPriorityTag } from './components/ProjectPriorityTag';
export { ProjectsBoard } from './components/ProjectsBoard';
export { TagProject as ProjectTag } from './components/TagProject';
export { ProjectTypeTag } from './components/ProjectTypeTag';

/* Hooks */
export {
  useClients,
  useCreateProject,
  useDeleteProject,
  useProject,
  useProjectFilters,
  useProjects,
  useUpdateProject,
} from './hooks';

/* Services */
export { getClients } from './services/clientsApi';
export {
  createProject,
  deleteProject,
  getProjectById,
  getProjects,
  getProjectsObjectivesSummary,
  updateProject,
} from './services/projectsApi';
export type { ProjectObjectiveSummary } from './services/projectsApi';

/* Types */
export type {
  CreateProjectPayload,
  Project,
  ProjectFilters,
  ProjectStatus,
  ProjectType,
  UpdateProjectPayload,
} from './types/project.types';

/* Utils */
export {
  getStatusColor,
  getStatusLabel,
  getTypeLabel,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from './utils/projectHelpers';
export { ProjectObjectives } from './components/ProjectObjectives';
