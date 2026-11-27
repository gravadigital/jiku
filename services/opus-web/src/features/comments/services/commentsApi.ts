import { apiClient } from '@/lib/axios';
import type { CreateCommentPayload, CreateCommentResponse } from '../types/comment.types';

export const commentsApi = {
  create: async (
    requirementId: number,
    payload: CreateCommentPayload
  ): Promise<CreateCommentResponse> => {
    const { data } = await apiClient.post<CreateCommentResponse>(
      `/api/opus/requirements/${requirementId}/comments`,
      { comment: payload.comment, fileIds: payload.fileIds }
    );
    return data;
  },
};
