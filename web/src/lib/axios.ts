import axios, { AxiosError } from 'axios';
import { auth } from './auth';

export interface ApiErrorResponse {
  code?: string;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

// Este cliente es de SERVIDOR: el interceptor de abajo llama a `auth()`, que solo corre
// ahí. Por eso la URL puede leerse de `API_URL` en runtime, sin embeberse en el bundle.
const apiUrl = process.env.API_URL ?? '';
const baseURL = `${apiUrl.replace(/\/$/, '')}/api`;

export const apiClient = axios.create({ baseURL });

apiClient.interceptors.request.use(async (config) => {
  try {
    const session = await auth();

    if (session?.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    } else {
      console.warn('No access token available for request:', config.url);
    }
  } catch (error) {
    console.error('Error getting auth session:', error);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    const apiError: ApiError = {
      code: error.response?.data?.code ?? 'internal_error',
      message: error.response?.data?.message ?? 'Internal error',
      status: error.response?.status ?? 500,
    };

    if (error.response?.status === 401) {
      console.error('Unauthorized request detected - token may be expired');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(apiError);
  }
);
