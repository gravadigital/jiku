'use server';
import { apiClient } from '@/lib/axios';
import type {
  AddActivityPayload,
  CreateRequirementPayload,
  Requirement,
  RequirementDetail,
  RequirementFilters,
  RequirementReportFilters,
  RequirementReportItem,
  TagSuggestion,
  UpdateRequirementPayload,
} from '../types/requirement.types';

const cleanFilters = (filters: object): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value && value !== 'all')
  ) as Record<string, string>;
};

export const getRequirements = async (filters: RequirementFilters = {}): Promise<Requirement[]> => {
  const nonEmptyFilters = cleanFilters(filters);
  const queryParams = new URLSearchParams(nonEmptyFilters).toString();
  const response = await apiClient.get(`/requirements?${queryParams}`);
  return response.data;
};

export const getRequirementById = async (reqid: number): Promise<RequirementDetail> => {
  const response = await apiClient.get(`/requirements/${reqid}`);
  return response.data;
};

export const createRequirement = async (
  payload: CreateRequirementPayload
): Promise<Requirement> => {
  const response = await apiClient.post('/requirements', payload);
  return response.data;
};

export const updateRequirement = async (
  reqid: number,
  payload: UpdateRequirementPayload
): Promise<Requirement> => {
  const response = await apiClient.patch(`/requirements/${reqid}`, payload);
  return response.data;
};

export const addRequirementActivity = async (
  reqid: number,
  payload: AddActivityPayload
): Promise<void> => {
  await apiClient.post(`/requirements/${reqid}/comments`, payload);
};

export const getTagSuggestions = async (
  projectId: number,
  keyQuery?: string
): Promise<TagSuggestion[]> => {
  const params = new URLSearchParams({ projectId: String(projectId) });
  if (keyQuery) params.append('keyQuery', keyQuery);
  const response = await apiClient.get(`/requirements/tags/suggestions?${params.toString()}`);
  return response.data;
};

export const getRequirementsReport = async (
  filters: RequirementReportFilters = {}
): Promise<RequirementReportItem[]> => {
  const nonEmptyFilters = cleanFilters(filters);
  const queryParams = new URLSearchParams(nonEmptyFilters).toString();
  const response = await apiClient.get(`/requirements/report?${queryParams}`);
  return response.data;
};
