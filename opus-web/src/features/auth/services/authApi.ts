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
    // No es fatal: si el alta falla, el usuario igual tiene sesión y las pantallas
    // resuelven solas si le falta permiso. Antes se relanzaba y /login/enter quedaba en
    // una pantalla blanca de error, sin poder entrar. La web ya lo trataba así.
    const apiError = error as ApiError;
    console.warn('Failed to present in API, but continuing:', apiError.message);
    return null;
  }
}
