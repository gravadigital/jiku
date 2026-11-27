import { NextRequest, NextResponse } from 'next/server';
import { decodedToken } from '@/shared/utils/decoded-token';

/**
 * Igual que el handler de preview: existe porque el navegador no puede mandar
 * el `Authorization` en un `href`, y propaga el 302 de la api en lugar de
 * proxear el binario. `redirect: 'manual'` evita que `fetch` siga la
 * redirección y reintroduzca el proxy en silencio.
 *
 * El `Content-Disposition` con el nombre original viaja firmado en la URL
 * prefirmada, así que no hay que propagarlo desde acá.
 */
export const GET = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const token = await decodedToken();

  if (!token?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const response = await fetch(`${process.env.API_URL}api/attachments/${id}/download`, {
    redirect: 'manual',
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
    },
  });

  const location = response.headers.get('Location');
  if (location) {
    // Sin Content-Length: un 302 no trae cuerpo.
    return new NextResponse(null, {
      status: 302,
      headers: { Location: location, 'X-Content-Type-Options': 'nosniff' },
    });
  }

  const errorData = await response.json().catch(() => ({ message: 'Download failed' }));
  return NextResponse.json(errorData, { status: response.status });
};
