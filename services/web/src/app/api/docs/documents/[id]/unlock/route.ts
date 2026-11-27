import { NextResponse, type NextRequest } from 'next/server';
import { ULID_PATTERN } from '@/features/docs/utils/docsUrlTransform';
import { decodedToken } from '@/shared/utils/decoded-token';

// BFF de la liberación del lock con `keepalive` (ADR-009): un Server Action no corre en el
// evento `pagehide` (la página se está descargando) y `fetch` con `keepalive: true` sí. Por eso
// este handler existe. Reenvía SOLO `{ sessionId }`: `force` nunca se expone.
export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const token = await decodedToken();
  if (!token?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.API_URL) {
    console.error('[docs/unlock] API_URL no configurada');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { id } = await params;
  if (!ULID_PATTERN.test(id)) {
    return NextResponse.json(
      { code: 'document_not_found', message: 'Documento no encontrado' },
      { status: 404 }
    );
  }

  const body = (await request.json().catch(() => null)) as { sessionId?: unknown } | null;
  const sessionId = body?.sessionId;
  if (typeof sessionId !== 'string' || !ULID_PATTERN.test(sessionId)) {
    return NextResponse.json(
      { code: 'invalid_fields', message: 'sessionId inválido' },
      { status: 400 }
    );
  }

  const response = await fetch(`${process.env.API_URL}api/docs/documents/${id}/unlock`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId }),
  }).catch(() => null);

  if (!response) {
    // La api no respondió: si el lock no se liberó, vence solo a los 120 s (R-7).
    return NextResponse.json({ message: 'Unlock failed' }, { status: 502 });
  }

  const data = await response.json().catch(() => ({ message: 'Unlock failed' }));
  return NextResponse.json(data, { status: response.status });
};
