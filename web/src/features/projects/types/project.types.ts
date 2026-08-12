import type { User } from '@/features/auth/types';

export interface Client {
  id?: number;
  name: string;
}

export type ProjectStatus = 'analisis' | 'activo' | 'inactivo' | 'finalizado' | 'cancelado';

export type ProjectType = 'interno' | 'comercial' | 'investigacion' | 'propuesta';

export interface Project {
  id?: number;
  code: string;
  name: string;
  description: string;
  status: ProjectStatus;
  type: ProjectType;
  priority: number;
  initDate: Date;
  endDate: Date;
  creator: User;
  client?: Client;
  keyValuePairs?: Record<string, string>;
}

export interface ProjectFilters {
  search?: string;
  state?: string;
  type?: string;
  sort?: string;
}

export interface CreateProjectPayload {
  code: string;
  name: string;
  description: string;
  status?: ProjectStatus | string;
  type: ProjectType | string;
  priority?: number;
  initDate: Date;
  endDate?: Date | null;
  clientId?: number | null;
  keyValuePairs?: Record<string, string | null> | null;
}

export type UpdateProjectPayload = Partial<CreateProjectPayload>;
