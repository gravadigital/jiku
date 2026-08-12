import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/features/auth/config/nextauth.config';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const backendUrl = `${process.env.API_URL}api/opus/attachments/${id}/preview`;

  const response = await fetch(backendUrl, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'Not found' }, { status: response.status });
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/octet-stream',
      'Content-Disposition': response.headers.get('Content-Disposition') ?? '',
      ...(response.headers.get('Content-Length')
        ? { 'Content-Length': response.headers.get('Content-Length')! }
        : {}),
    },
  });
}
