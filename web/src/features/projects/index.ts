/* Components */
export { ProjectCard } from './components/ProjectCard';
export { ProjectListFilters } from './components/ProjectListFilters';
export { ProjectsBoard } from './components/ProjectsBoard';

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
