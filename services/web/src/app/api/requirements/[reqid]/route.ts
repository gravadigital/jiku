import { NextRequest, NextResponse } from 'next/server';
import { decodedToken } from '@/shared/utils/decoded-token';

export const PATCH = async (
  request: NextRequest,
  { params }: { params: Promise<{ reqid: string }> }
) => {
  const token = await decodedToken();

  if (!token?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { reqid } = await params;
  const body = await request.json();

  const response = await fetch(`${process.env.API_URL}api/requirements/${reqid}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
};
