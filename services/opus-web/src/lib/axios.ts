import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getSession } from 'next-auth/react';

// Tipos de error
export interface ApiError {
  code: string;
  message: string;
  status: number;
}

// Cliente base sin interceptores (para uso en servidor)
//
// `API_URL` se lee en el servidor, en cada request: no se embebe en el bundle. Eso es lo
// que permite publicar una imagen sin configuración horneada.
export const apiClientBase = axios.create({
  baseURL: process.env.API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para manejo de errores (compartido)
const errorInterceptor = (error: AxiosError<ApiError>) => {
  const apiError: ApiError = {
    code: error.response?.data?.code ?? 'unknown_error',
    message: error.response?.data?.message ?? 'Error desconocido',
    status: error.response?.status ?? 500,
  };

  // Redirect a login si es 401 (solo en cliente)
  if (error.response?.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  return Promise.reject(apiError);
};

apiClientBase.interceptors.response.use((response) => response, errorInterceptor);

// Cliente para uso en el navegador.
//
// Apunta al MISMO ORIGEN, no a la api: `/api/opus/...` lo atiende un route handler de este
// front, que reenvía agregando el token. Así el bundle no necesita saber dónde está la api
// —no habría forma de decírselo en runtime— y el access token no sale del servidor.
export const apiClient = axios.create({
  baseURL: '/',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación (solo cliente)
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const session = await getSession();
    if (session?.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use((response) => response, errorInterceptor);
