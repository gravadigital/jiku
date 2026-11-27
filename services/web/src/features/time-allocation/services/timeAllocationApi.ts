'use server';

import { apiClient } from '@/lib/axios';
import type {
  HoursPerDayResponse,
  WeekAllocationResponse,
  WeekAllocationSave,
  WeekAllocationSaveItem,
  WeekAllocationSaveResponse,
} from '../types/time-allocation.types';

export const getWeekAllocations = async (weekStart: string): Promise<WeekAllocationResponse> => {
  const response = await apiClient.get(`/week-assigned-times?weekStart=${weekStart}`);
  return response.data;
};

export const getHoursPerDay = async (): Promise<HoursPerDayResponse> => {
  const response = await apiClient.get('/settings/hours-per-day');
  return response.data;
};

export const saveWeekAllocations = async (
  weekStart: string,
  allocations: WeekAllocationSaveItem[]
): Promise<WeekAllocationSaveResponse> => {
  const payload: WeekAllocationSave = { weekStart, allocations };
  const response = await apiClient.put('/week-assigned-times', payload);
  return response.data;
};
