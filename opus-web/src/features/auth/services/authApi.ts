'use server';
import { auth } from '../config/nextauth.config';
import { apiClientBase, ApiError } from '@/lib/axios';

export async function presentInApi() {
  const session = await auth();

  if (!session || !session.accessToken) {
    // Tampoco es fatal: sin sesión, el middleware manda al login igual.
    console.warn('presentInApi: sin sesión ni access token');
    return null;
  }

  try {
    return await apiClientBase.post(
      '/api/auth/present',
      {},
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );
  } catch (error) {
    // Desde REQ-007 esto no tiene consecuencia aguas abajo: core espeja la identidad al
    // procesar el primer comando, así que no hay alta que pueda fallar acá. El try/catch
    // se mantiene para que un error de red no bloquee el ingreso.
    const apiError = error as ApiError;
    console.warn('Failed to present in API, but continuing:', apiError.message);
    return null;
  }
}
