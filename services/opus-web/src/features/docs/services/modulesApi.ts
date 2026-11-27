import { apiClient } from '@/lib/axios';
import type { ModuleEntry } from '../types/docs.types';

export const modulesApi = {
  getAll: async (): Promise<ModuleEntry[]> => {
    const { data } = await apiClient.get<ModuleEntry[]>('/api/opus/modules');
    return data;
  },
};
