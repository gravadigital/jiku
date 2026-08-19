import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/features/auth/config/nextauth.config';

/**
 * Preview de un adjunto YA vinculado, por `attachments.id`.
 *
 * Necesita handler propio porque la URL va en un `src`/`href`, donde el navegador no
 * puede mandar el Authorization.
 *
 * Desde S-005 la api responde 302 a una URL prefirmada en vez del binario: este handler
 * devuelve esa redirección y deja de proxear el byte.
 */
const API_URL = () => process.env.API_URL ?? '';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    // El formato `{error}` es el que este handler ya tenía y el que ADR-009 cita: se
    // conserva. Cambiarlo sería un cambio de contrato con alcance propio.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base = API_URL();
  if (!base) {
    return NextResponse.json(
      { code: 'server_misconfigured', message: 'API_URL is not set' },
      { status: 500 }
    );
  }

  const { id } = await params;
  const target = new URL(
    `api/opus/attachments/${id}/preview`,
    base.endsWith('/') ? base : `${base}/`
  );

  // `redirect: 'manual'`: sin esto el fetch de Node seguiría el 302 solo, descargaría el
  // objeto desde S3 y lo serviría desde el proceso de Next. No falla de forma visible —
  // funciona mal en silencio, con el ancho de banda saliendo de Next en vez del bucket.
  const response = await fetch(target, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    redirect: 'manual',
  });

  if (response.status >= 300 && response.status < 400) {
    const headers: Record<string, string> = {
      Location: response.headers.get('Location') ?? '',
    };
    const contentType = response.headers.get('Content-Type');
    if (contentType) headers['Content-Type'] = contentType;
    const disposition = response.headers.get('Content-Disposition');
    if (disposition) headers['Content-Disposition'] = disposition;
    // Sin `Content-Length`: este handler ya no reenvía un cuerpo binario.
    return new NextResponse(null, { status: response.status, headers });
  }

  // El body se devuelve tal cual para que el `code` sobreviva: reemplazarlo por
  // `{error:'Not found'}` haría imposible distinguir `file_not_available`.
  const body = await response.json().catch(() => null);
  if (body === null) {
    return new NextResponse(null, { status: response.status });
  }
  return NextResponse.json(body, { status: response.status });
}
