'use server';
import { apiClient } from '@/lib/axios';
import type {
  CreateCommentPayload,
  ObjectiveActivity,
  UpdateCommentPayload,
} from '../types/activity.types';

export const createComment = async (
  objectiveId: number,
  payload: CreateCommentPayload
): Promise<ObjectiveActivity> => {
  const response = await apiClient.post(`/objectives/${objectiveId}/comments`, payload);
  return response.data;
};

export const updateComment = async (
  objectiveId: number,
  commentId: number,
  payload: UpdateCommentPayload
): Promise<void> => {
  const { comment, fileIds } = payload;
  await apiClient.patch(`/objectives/${objectiveId}/comment/${commentId}`, {
    comment,
    ...(fileIds !== undefined ? { fileIds } : {}),
  });
};
