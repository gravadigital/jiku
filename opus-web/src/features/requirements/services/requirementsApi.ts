import { apiClient } from '@/lib/axios';
import type {
  Requirement,
  RequirementDetail,
  CreateRequirementPayload,
  CreateRequirementResponse,
  UpdateOpusRequirementPayload,
} from '../types/requirement.types';

interface GetRequirementsParams {
  sort?: string;
  limit?: number;
}

interface GetByStatusParams {
  status: string[];
  limit?: number;
  skip?: number;
}

export const requirementsApi = {
  getByProject: async (
    projectId: number,
    params?: GetRequirementsParams
  ): Promise<Requirement[]> => {
    const { data } = await apiClient.get<Requirement[]>(
      `/api/opus/projects/${projectId}/requirements`,
      { params }
    );
    return data;
  },

  getById: async (id: number): Promise<RequirementDetail> => {
    const { data } = await apiClient.get<RequirementDetail>(`/api/opus/requirements/${id}`);
    return data;
  },

  create: async (payload: CreateRequirementPayload): Promise<CreateRequirementResponse> => {
    const { data } = await apiClient.post<CreateRequirementResponse>(
      '/api/opus/requirements',
      payload
    );
    return data;
  },

  getByStatus: async (projectId: number, params: GetByStatusParams): Promise<Requirement[]> => {
    const { data } = await apiClient.get<Requirement[]>(
      `/api/opus/projects/${projectId}/requirements`,
      {
        params: {
          state: params.status,
          limit: params.limit ?? 20,
          skip: params.skip ?? 0,
        },
      }
    );
    return data;
  },

  updateRequirement: async (
    requirementId: number,
    payload: UpdateOpusRequirementPayload
  ): Promise<Requirement> => {
    const { data } = await apiClient.patch<Requirement>(
      `/api/opus/requirements/${requirementId}`,
      payload
    );
    return data;
  },

  addActivity: async (requirementId: number, comment: string): Promise<void> => {
    await apiClient.post(`/api/opus/requirements/${requirementId}/comment`, {
      comment,
      typeOfActivity: 'comment',
      visibilityLevel: 'public',
    });
  },

  subscribe: async (requirementId: number, userId: string): Promise<void> => {
    await apiClient.post(`/api/opus/requirements/${requirementId}/subscriptors`, { userId });
  },

  unsubscribe: async (requirementId: number, userId: string): Promise<void> => {
    await apiClient.delete(`/api/opus/requirements/${requirementId}/subscriptors/${userId}`);
  },
};
