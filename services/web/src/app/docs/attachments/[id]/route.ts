import { NextResponse, type NextRequest } from 'next/server';
import { decodedToken } from '@/shared/utils/decoded-token';

// Link estable de los adjuntos de documentación (`{JIKU_WEB_URL}/docs/attachments/{id}`, D-5).
// Vive FUERA de `(loggedin)`: no hay guard de layout, así que valida la sesión por sí mismo.
// No reenvía binario: propaga el 302 de la api hacia la URL prefirmada de S3.
const handler = async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const token = await decodedToken();
  if (!token?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.API_URL) {
    console.error('[docs/attachments] API_URL no configurada');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { id } = await params;
  const response = await fetch(
    `${process.env.API_URL}api/docs/attachments/${encodeURIComponent(id)}`,
    {
      redirect: 'manual',
      headers: { Authorization: `Bearer ${token.accessToken}` },
    }
  );

  const location = response.headers.get('Location');
  if (location) {
    return new NextResponse(null, {
      status: 302,
      headers: { Location: location, 'X-Content-Type-Options': 'nosniff' },
    });
  }

  const errorData = await response.json().catch(() => ({ message: 'Download failed' }));
  return NextResponse.json(errorData, { status: response.status });
};

export const GET = handler;
export const HEAD = handler;
