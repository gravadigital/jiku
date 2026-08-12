import { NextRequest, NextResponse } from 'next/server';
import { decodedToken } from '@/shared/utils/decoded-token';

export const GET = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const token = await decodedToken();

  if (!token?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const response = await fetch(`${process.env.API_URL}api/attachments/${id}/preview`, {
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Preview failed' }));
    return NextResponse.json(errorData, { status: response.status });
  }

  const contentType = response.headers.get('Content-Type') ?? 'application/octet-stream';
  const contentLength = response.headers.get('Content-Length');
  const contentDisposition = response.headers.get('Content-Disposition');

  const headers: Record<string, string> = { 'Content-Type': contentType };
  if (contentLength) headers['Content-Length'] = contentLength;
  if (contentDisposition) headers['Content-Disposition'] = contentDisposition;

  return new NextResponse(response.body, {
    status: 200,
    headers,
  });
};
