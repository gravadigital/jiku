'use server';

import { apiClient } from '@/lib/axios';
import type {
  Client,
  ClientFilters,
  CreateClientPayload,
  UpdateClientPayload,
} from '../types/client.types';

const cleanFilters = (filters: ClientFilters): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value && value !== 'all')
  ) as Record<string, string>;
};

export const getClients = async (filters: ClientFilters = {}): Promise<Client[]> => {
  const nonEmptyFilters = cleanFilters(filters);
  const queryParams = new URLSearchParams(nonEmptyFilters).toString();
  const response = await apiClient.get(`/clients${queryParams ? `?${queryParams}` : ''}`);
  return response.data || [];
};

export const getClientById = async (id: number): Promise<Client> => {
  const response = await apiClient.get(`/clients/${id}`);
  return response.data;
};

export const createClient = async (payload: CreateClientPayload): Promise<Client> => {
  const response = await apiClient.post('/clients', payload);
  return response.data;
};

export const updateClient = async (id: number, payload: UpdateClientPayload): Promise<Client> => {
  const response = await apiClient.patch(`/clients/${id}`, payload);
  return response.data;
};
