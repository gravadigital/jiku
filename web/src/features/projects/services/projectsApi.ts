'use server';
import { apiClient } from '@/lib/axios';
import type {
  CreateProjectPayload,
  Project,
  ProjectFilters,
  UpdateProjectPayload,
} from '../types/project.types';

const cleanFilters = (filters: ProjectFilters): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value && value !== 'all')
  ) as Record<string, string>;
};

export const getProjects = async (filters: ProjectFilters = {}): Promise<Project[]> => {
  const nonEmptyFilters = cleanFilters(filters);
  const queryParams = new URLSearchParams(nonEmptyFilters).toString();
  const response = await apiClient.get(`/projects?${queryParams}`);
  return response.data;
};

export const getProjectById = async (id: number): Promise<Project> => {
  const response = await apiClient.get(`/projects/${id}`);
  return response.data;
};

export const createProject = async (payload: CreateProjectPayload): Promise<Project> => {
  const response = await apiClient.post('/projects', payload);
  return response.data;
};

export const updateProject = async (
  id: number,
  payload: UpdateProjectPayload
): Promise<Project> => {
  const response = await apiClient.patch(`/projects/${id}`, payload);
  return response.data;
};

export const deleteProject = async (id: number): Promise<void> => {
  await apiClient.delete(`/projects/${id}`);
};

export interface ProjectObjectiveSummary {
  project: {
    id: number;
    name: string;
    code: string;
    status: string;
    type: string;
  };
  objectives: any[];
  totalWorkedMinutes: number;
  monthWorkedMinutes: number;
}

export const getProjectsObjectivesSummary = async (): Promise<ProjectObjectiveSummary[]> => {
  const response = await apiClient.get('/projects/objectives-summary');
  return response.data;
};
