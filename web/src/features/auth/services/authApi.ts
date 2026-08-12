'use server';
import { auth } from '@/lib/auth';
import { apiClient } from '@/lib/axios';

export const presentInApi = async (): Promise<void> => {
  // Temporal (entorno local): imprime el access token para poder probar la api a mano.
  // Sacar antes de mergear.
  if (process.env.LOG_ACCESS_TOKEN === 'true') {
    const session = await auth();
    console.log(
      '\n===== ACCESS TOKEN =====\n' +
        (session?.accessToken ?? '(sin sesión)') +
        '\n========================\n'
    );
  }

  try {
    await apiClient.post('/auth/present', {});
  } catch (error) {
    console.warn('Failed to present in API, but continuing:', error);
  }
};
