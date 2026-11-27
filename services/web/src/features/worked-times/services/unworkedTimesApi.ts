'use server';

import { apiClient } from '@/lib/axios';
import type {
  UnworkedTime,
  UnworkedTimeCreate,
  UnworkedTimeReason,
  UnworkedTimeReportDay,
} from '../types/unworked-time.types';

export const getUnworkedTimesReasons = async (): Promise<UnworkedTimeReason[]> => {
  const response = await apiClient.get('/unworked-times/reasons');
  return response.data;
};

export const getUnworkedTimes = async (date: string, personId: number): Promise<UnworkedTime[]> => {
  const response = await apiClient.get(`/unworked-times?date=${date}&personId=${personId}`);
  return response.data;
};

export const createUnworkedTime = async (payload: UnworkedTimeCreate): Promise<UnworkedTime> => {
  const response = await apiClient.post('/unworked-times', payload);
  return response.data;
};

export const deleteUnworkedTime = async (id: number): Promise<void> => {
  await apiClient.delete(`/unworked-times/${id}`);
};

export const getUnworkedTimesReport = async (
  dateFrom: string,
  dateTo: string,
  personId: number
): Promise<UnworkedTimeReportDay[]> => {
  const response = await apiClient.get(
    `/unworked-times/report?dateFrom=${dateFrom}&dateTo=${dateTo}&personId=${personId}`
  );
  return response.data;
};
