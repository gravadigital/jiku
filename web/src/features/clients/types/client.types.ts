import type { User } from '@/features/auth/types';
import type { Project } from '@/features/projects/types/project.types';

export interface Client {
  id?: number;
  name: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: User;
  projects?: Project[];
}

export type ClientStatus = 'activo' | 'inactivo';

export interface ClientFilters {
  search?: string;
  status?: ClientStatus;
  sort?: string;
}

export interface CreateClientPayload {
  name: string;
  description?: string;
}

export type UpdateClientPayload = Partial<CreateClientPayload>;
