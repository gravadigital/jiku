import { NextRequest, NextResponse } from 'next/server';
import { decodedToken } from '@/shared/utils/decoded-token';

/**
 * Este handler existe porque el navegador no puede mandar el `Authorization`
 * cuando la URL va en un `src` / `href`. Esa razón no cambió con REQ-001.
 *
 * Lo que sí cambió: la api responde un 302 a la prefirmada de GetObject en vez
 * del binario, así que el handler propaga la redirección y el byte nunca toca
 * el proceso de Next. `redirect: 'manual'` es lo que lo garantiza: sin él,
 * `fetch` sigue la redirección por su cuenta y el proxy vuelve, invisible.
 */
async function callApi(id: string, accessToken: string, method: 'GET' | 'HEAD') {
  return fetch(`${process.env.API_URL}api/attachments/${id}/preview`, {
    method,
    redirect: 'manual',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export const GET = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const token = await decodedToken();

  if (!token?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const response = await callApi(id, token.accessToken, 'GET');

  const location = response.headers.get('Location');
  if (location) {
    // No se setea Content-Length: en un 302 prometería un cuerpo que no existe
    // y el cliente se quedaría esperando bytes que no llegan.
    return new NextResponse(null, {
      status: 302,
      headers: { Location: location, 'X-Content-Type-Options': 'nosniff' },
    });
  }

  const errorData = await response.json().catch(() => ({ message: 'Preview failed' }));
  return NextResponse.json(errorData, { status: response.status });
};

/**
 * El `HEAD` resuelve los metadatos del adjunto (nombre, tamaño, mime) para
 * `useAttachmentMeta`. La api los manda en headers junto con el 302, así que
 * acá se propagan tal cual. `Content-Length` sí va: en un `HEAD` no promete
 * ningún cuerpo.
 */
export const HEAD = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const token = await decodedToken();

  if (!token?.accessToken) {
    return new NextResponse(null, { status: 401 });
  }

  const { id } = await params;
  const response = await callApi(id, token.accessToken, 'HEAD');

  const location = response.headers.get('Location');
  if (!location) {
    return new NextResponse(null, { status: response.status });
  }

  const headers = new Headers();
  const contentType = response.headers.get('Content-Type');
  const contentDisposition = response.headers.get('Content-Disposition');
  const contentLength = response.headers.get('Content-Length');
  if (contentType) headers.set('Content-Type', contentType);
  if (contentDisposition) headers.set('Content-Disposition', contentDisposition);
  if (contentLength) headers.set('Content-Length', contentLength);

  return new NextResponse(null, { status: 200, headers });
};
