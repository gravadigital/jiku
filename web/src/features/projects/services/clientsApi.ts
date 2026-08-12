'use server';
import { apiClient } from '@/lib/axios';
import type { Client } from '@/shared/types';

export const getClients = async (): Promise<Client[]> => {
  const response = await apiClient.get('/clients');
  return response.data;
};
