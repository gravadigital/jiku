import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/features/auth/config/nextauth.config';

/**
 * Preview de un archivo SIN vínculo, por `files.id`.
 *
 * Necesita handler propio por dos razones a la vez, y ninguna es evitable:
 * 1. `GET /api/files/{id}/preview` NO vive bajo `/api/opus/*`, así que el proxy catch-all
 *    —que arma el destino como `api/opus/{path}`— estructuralmente no puede alcanzarlo.
 * 2. La URL va en un `src` de imagen, donde el navegador no puede mandar el Authorization.
 *
 * `API_URL` se lee en cada request: es de runtime y la misma imagen sirve en cualquier
 * entorno.
 */
const API_URL = () => process.env.API_URL ?? '';

async function forward(method: 'GET' | 'HEAD', id: string) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ code: 'unauthorized', message: 'Unauthorized' }, { status: 401 });
  }

  const base = API_URL();
  if (!base) {
    // Sin esto el fetch fallaría con una URL relativa y un error opaco.
    return NextResponse.json(
      { code: 'server_misconfigured', message: 'API_URL is not set' },
      { status: 500 }
    );
  }

  const target = new URL(`api/files/${id}/preview`, base.endsWith('/') ? base : `${base}/`);

  // `redirect: 'manual'` no es opcional: el fetch de Node sigue las redirecciones por
  // defecto, y sin esto el handler descargaría el objeto desde S3 y lo devolvería como
  // 200 — el proxy binario que esta ruta existe para no ser.
  const response = await fetch(target, {
    method,
    headers: { Authorization: `Bearer ${session.accessToken}` },
    redirect: 'manual',
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('Location') ?? '';
    const headers: Record<string, string> = { Location: location };

    const contentType = response.headers.get('Content-Type');
    if (contentType) headers['Content-Type'] = contentType;
    const disposition = response.headers.get('Content-Disposition');
    if (disposition) headers['Content-Disposition'] = disposition;

    // `Content-Length` viaja SOLO en el HEAD: en un GET prometería un cuerpo que un 302
    // no tiene, y el cliente se quedaría esperando bytes que no llegan.
    if (method === 'HEAD') {
      const length = response.headers.get('Content-Length');
      if (length) headers['Content-Length'] = length;
    }

    return new NextResponse(null, { status: response.status, headers });
  }

  // El body se devuelve tal cual para que el `code` sobreviva: la UI distingue
  // `file_not_available` de `file_not_found` por ese campo.
  const body = await response.json().catch(() => null);
  if (body === null) {
    return new NextResponse(null, { status: response.status });
  }
  return NextResponse.json(body, { status: response.status });
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  return forward('GET', (await params).id);
}

export async function HEAD(_req: NextRequest, { params }: Ctx) {
  return forward('HEAD', (await params).id);
}
