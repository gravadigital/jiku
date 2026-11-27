'use server';
import { apiClient } from '@/lib/axios';
import type { ModuleState } from '../types/module.types';

export const getModules = async (): Promise<ModuleState[]> => {
  const response = await apiClient.get('/modules');
  return response.data;
};
