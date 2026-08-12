// Re-exports from features (canonical locations)
export type { CustomError, Person, TokenInfo, User, UserCredentials } from '@/features/auth/types';
export { Token } from '@/features/auth/types';
export type { Client, Project, ProjectFilters } from '@/features/projects/types';
export type {
  Client as FullClient,
  ClientFilters as ClientFiltersType,
} from '@/features/clients/types/client.types';
export type {
  Objective,
  ObjectiveActivity,
  ObjectiveFilters,
  WorkedTime,
} from '@/features/objectives/types';

// Legacy aliases for backward compatibility
export type { Person as IPerson } from '@/features/auth/types';
export type {
  Objective as IObjective,
  WorkedTime as IWorkedTime,
} from '@/features/objectives/types';
