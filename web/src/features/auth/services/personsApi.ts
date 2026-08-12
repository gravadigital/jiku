'use server';
import { apiClient } from '@/lib/axios';
import type { Person } from '../types/auth.types';

export const getPersons = async (): Promise<Person[]> => {
  const response = await apiClient.get('/persons');
  return response.data;
};
