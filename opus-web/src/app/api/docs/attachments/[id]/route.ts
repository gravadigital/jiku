import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/features/auth/config/nextauth.config';
import { ULID_PATTERN } from '@/features/docs/constants/docs.constants';

/**
 * Adjuntos de documentos del módulo docs (H-4 de REQ-016).
 *
 * Necesita handler propio porque la URL va en un `src`/`href` (el navegador no puede mandar el
 * token) y el catch-all `/api/opus/[...path]` sigue redirecciones: el 302 de la api se
 * convertiría en un proxy del binario a través de Next. Aquí el 302 se propaga sin seguirlo y
 * el navegador baja el archivo directo del storage.
 *
 * `/api/*` está fuera del matcher del middleware: la sesión se valida acá. `API_URL` se lee en
 * cada request (es de runtime).
 */
const API_URL = () => process.env.API_URL ?? '';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ code: 'unauthorized', message: 'Unauthorized' }, { status: 401 });
  }

  // El id se interpola en una URL que viaja con el Bearer del usuario: un id manipulado
  // (`..%2F`) podría apuntar el token a otra ruta. La api responde este mismo 404.
  if (!ULID_PATTERN.test(id)) {
    return NextResponse.json(
      { code: 'attachment_not_found', message: 'Adjunto no encontrado' },
      { status: 404 }
    );
  }

  const base = API_URL();
  if (!base) {
    return NextResponse.json(
      { code: 'server_misconfigured', message: 'API_URL is not set' },
      { status: 500 }
    );
  }

  const target = new URL(`api/opus/docs/attachments/${id}`, base.endsWith('/') ? base : `${base}/`);
  // `redirect: 'manual'` no es opcional: el fetch de Node sigue las redirecciones por defecto,
  // y sin esto el handler descargaría el objeto desde el storage y lo serviría como 200.
  const response = await fetch(target, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    redirect: 'manual',
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('Location') ?? '';
    return new NextResponse(null, {
      status: response.status,
      headers: { Location: location, 'X-Content-Type-Options': 'nosniff' },
    });
  }

  // El body se devuelve tal cual para que el `code` sobreviva.
  const body = await response.json().catch(() => null);
  if (body === null) return new NextResponse(null, { status: response.status });
  return NextResponse.json(body, { status: response.status });
}
