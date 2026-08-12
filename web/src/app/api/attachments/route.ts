import { NextRequest, NextResponse } from 'next/server';
import { decodedToken } from '@/shared/utils/decoded-token';

export const POST = async (request: NextRequest) => {
  const token = await decodedToken();

  if (!token?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const response = await fetch(`${process.env.API_URL}api/attachments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': request.headers.get('Content-Type') ?? '',
      },
      body: request.body,
      // @ts-expect-error -- Node.js fetch supports duplex for streaming request bodies
      duplex: 'half',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};
