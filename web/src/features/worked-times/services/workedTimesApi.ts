'use server';

import { apiClient } from '@/lib/axios';
import type {
  CreateWorkedTimePayload,
  PersonObjective,
  PersonRequirement,
  ReportByPerson,
  ReportByProject,
  WorkedTimeEntry,
} from '../types/worked-time.types';

export const getWorkedTimes = async (
  date: string,
  personId: number
): Promise<WorkedTimeEntry[]> => {
  const response = await apiClient.get(`/worked-times?date=${date}&personId=${personId}`);
  return response.data;
};

export const getWorkedTimesMultipleDates = async (
  dates: string[],
  personId: number
): Promise<WorkedTimeEntry[]> => {
  const results = await Promise.all(
    dates.map((date) => apiClient.get(`/worked-times?date=${date}&personId=${personId}`))
  );
  return results.flatMap((r) => r.data);
};

export const getPersonObjectives = async (personId: number): Promise<PersonObjective[]> => {
  const response = await apiClient.get(`/worked-times/person-objectives?personId=${personId}`);
  return response.data;
};

export const getPersonRequirements = async (personId: number): Promise<PersonRequirement[]> => {
  const response = await apiClient.get(`/worked-times/person-requirements?personId=${personId}`);
  return response.data;
};

export const createWorkedTime = async (
  payload: CreateWorkedTimePayload
): Promise<WorkedTimeEntry> => {
  const response = await apiClient.post('/worked-times', payload);
  return response.data;
};

export const deleteWorkedTime = async (id: number): Promise<void> => {
  await apiClient.delete(`/worked-times/${id}`);
};

export const getReportByPerson = async (
  dateFrom: string,
  dateTo: string
): Promise<ReportByPerson[]> => {
  const response = await apiClient.get(
    `/worked-times/report/by-person?dateFrom=${dateFrom}&dateTo=${dateTo}`
  );
  return response.data;
};

export const getReportByProject = async (
  dateFrom: string,
  dateTo: string
): Promise<ReportByProject[]> => {
  const response = await apiClient.get(
    `/worked-times/report/by-project?dateFrom=${dateFrom}&dateTo=${dateTo}`
  );
  return response.data;
};
