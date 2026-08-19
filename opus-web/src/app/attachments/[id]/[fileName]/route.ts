import { NextRequest, NextResponse } from 'next/server';

/**
 * Camino público de descarga, sin sesión. DEPRECADO: sobrevive para los ids ya emitidos.
 *
 * Es la única ruta exenta de autenticación: la autorización la decide la api, que valida
 * `visibilityLevel === 'public'`. Está fuera del matcher del middleware a propósito.
 *
 * Desde S-005 la api responde 302 a una URL prefirmada: este handler devuelve esa
 * redirección en vez de proxear el binario.
 */
const API_URL = () => process.env.API_URL ?? '';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileName: string }> }
) {
  // El `fileName` de la URL es cosmético: la api resuelve el objeto por el id.
  const { id } = await params;

  const base = API_URL();
  if (!base) {
    return NextResponse.json(
      { code: 'server_misconfigured', message: 'API_URL is not set' },
      { status: 500 }
    );
  }

  const target = new URL(
    `api/opus/attachments/${id}/public`,
    base.endsWith('/') ? base : `${base}/`
  );

  // `redirect: 'manual'` por el mismo motivo que el handler autenticado: sin esto el byte
  // volvería a pasar por el proceso de Next.
  const response = await fetch(target, { redirect: 'manual' });

  if (response.status >= 300 && response.status < 400) {
    const headers: Record<string, string> = {
      Location: response.headers.get('Location') ?? '',
    };
    const contentType = response.headers.get('Content-Type');
    if (contentType) headers['Content-Type'] = contentType;
    const disposition = response.headers.get('Content-Disposition');
    if (disposition) headers['Content-Disposition'] = disposition;
    return new NextResponse(null, { status: response.status, headers });
  }

  return new NextResponse(null, { status: response.status });
}
