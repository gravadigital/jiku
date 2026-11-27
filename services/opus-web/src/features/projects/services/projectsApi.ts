import { apiClient } from '@/lib/axios';
import type { Project } from '../types/project.types';

export const projectsApi = {
  getAll: async (): Promise<Project[]> => {
    const { data } = await apiClient.get<Project[]>('/api/opus/projects');
    return data;
  },
};
