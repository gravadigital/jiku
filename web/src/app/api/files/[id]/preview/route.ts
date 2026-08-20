import { NextRequest, NextResponse } from 'next/server';
import { decodedToken } from '@/shared/utils/decoded-token';

/**
 * Vista previa de un archivo SIN vínculo, por su `files.id` (REQ-001, camino E).
 *
 * POR QUÉ EXISTE, y por qué el de `attachments` no alcanza: son DOS ESPACIOS DE IDS
 * DISTINTOS. Un `[file:N]` del markdown lleva id de `files`; un `[attach:N]`, id de
 * `attachments`. Resolver el primero contra `/api/attachments/{id}/preview` daría un 404 o —peor—
 * el preview de OTRO adjunto que casualmente tenga ese id.
 *
 * ESTA RUTA FALTABA. `getFilePreviewUrl()` ya apuntaba acá y el endpoint de la api ya existía,
 * pero sin el handler Next respondía un 404 sin cuerpo, y `useAttachmentMeta` traduce un 404 sin
 * `code` a `file_not_available`: el usuario veía "El archivo no está disponible" para un archivo
 * subido y vinculado correctamente. Ni la api ni `core` registraban la request, porque nunca
 * salía de Next.
 *
 * Su autorización es SOLO EL JWT, igual que en la api: sin vínculo no hay entidad contra la que
 * validar permiso de proyecto. La consecuencia está registrada en la revisión de ADR-007.
 */
async function callApi(id: string, accessToken: string, method: 'GET' | 'HEAD') {
  return fetch(`${process.env.API_URL}api/files/${id}/preview`, {
    method,
    // `redirect: 'manual'` no es opcional: sin él `fetch` sigue la redirección, el handler baja
    // el objeto de S3 y lo devuelve como 200 — el proxy binario que esta ruta existe para NO ser.
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
    // No se setea Content-Length: en un 302 prometería un cuerpo que no existe.
    return new NextResponse(null, {
      status: 302,
      headers: { Location: location, 'X-Content-Type-Options': 'nosniff' },
    });
  }

  // El body se devuelve TAL CUAL para que el `code` sobreviva: es lo que le permite a la
  // interfaz distinguir `file_not_available` (el byte nunca llegó) de `file_not_found`.
  const errorData = await response.json().catch(() => ({ message: 'Preview failed' }));
  return NextResponse.json(errorData, { status: response.status });
};

/**
 * El `HEAD` resuelve los metadatos (nombre, tamaño, mime) para `useAttachmentMeta`. La api los
 * manda en headers junto con el 302, así que acá se propagan tal cual. `Content-Length` sí va:
 * en un `HEAD` no promete ningún cuerpo.
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
