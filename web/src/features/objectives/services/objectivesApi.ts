'use server';
import { apiClient } from '@/lib/axios';
import type {
  CreateObjectivePayload,
  Objective,
  ObjectiveFilters,
  UpdateObjectivePayload,
} from '../types/objective.types';

const cleanFilters = (filters: ObjectiveFilters): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value && value !== 'all')
  ) as Record<string, string>;
};

export const getObjectives = async (filters: ObjectiveFilters = {}): Promise<Objective[]> => {
  const nonEmptyFilters = cleanFilters(filters);
  const queryParams = new URLSearchParams(nonEmptyFilters).toString();
  const response = await apiClient.get(`/objectives?${queryParams}`);
  return response.data;
};

export const getObjectivesCount = async (filters: ObjectiveFilters = {}): Promise<number> => {
  const nonEmptyFilters = cleanFilters(filters);
  const queryParams = new URLSearchParams(nonEmptyFilters).toString();
  const response = await apiClient.get(`/objectives?${queryParams}&count=true`);
  return response.data;
};

export const getObjectiveById = async (id: number): Promise<Objective> => {
  const response = await apiClient.get(`/objectives/${id}`);
  return response.data;
};

export const createObjective = async (payload: CreateObjectivePayload): Promise<Objective> => {
  const response = await apiClient.post('/objectives', payload);
  return response.data;
};

export const updateObjective = async (
  id: number,
  payload: UpdateObjectivePayload
): Promise<Objective> => {
  const response = await apiClient.patch(`/objectives/${id}`, payload);
  return response.data;
};

export const updateObjectiveState = async (id: number, state: string): Promise<void> => {
  await apiClient.patch(`/objectives/${id}`, { state });
};

export const deleteObjective = async (id: number): Promise<void> => {
  await apiClient.delete(`/objectives/${id}`);
};
