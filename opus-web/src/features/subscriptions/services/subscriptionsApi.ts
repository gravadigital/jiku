import { apiClient } from '@/lib/axios';
import type { ProjectUser } from '../types/subscription.types';

export const subscriptionsApi = {
  subscribe: async (requirementId: number, userId: string): Promise<void> => {
    await apiClient.post(`/api/opus/requirements/${requirementId}/subscriptors`, { userId });
  },

  unsubscribe: async (requirementId: number, userId: string): Promise<void> => {
    await apiClient.delete(`/api/opus/requirements/${requirementId}/subscriptors/${userId}`);
  },

  getProjectUsers: async (projectId: number): Promise<ProjectUser[]> => {
    const { data } = await apiClient.get<ProjectUser[]>(`/api/opus/projects/${projectId}/users`);
    return data;
  },
};
