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

  const response = await fetch(`${process.env.API_URL}api/attachments/${id}/download`, {
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Download failed' }));
    return NextResponse.json(errorData, { status: response.status });
  }

  const contentType = response.headers.get('Content-Type') ?? 'application/octet-stream';
  const contentDisposition = response.headers.get('Content-Disposition');
  const contentLength = response.headers.get('Content-Length');

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  if (contentDisposition) {
    headers.set('Content-Disposition', contentDisposition);
  }
  if (contentLength) {
    headers.set('Content-Length', contentLength);
  }

  return new NextResponse(response.body, { status: 200, headers });
};
