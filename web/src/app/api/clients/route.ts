import { NextRequest, NextResponse } from 'next/server';
import { decodedToken } from '@/shared/utils/decoded-token';

export const POST = async (request: NextRequest) => {
  const token = await decodedToken();
  if (!token?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.API_URL) {
    console.error('Missing API_URL in server environment');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const payload = await request.json();
    const response = await fetch(`${process.env.API_URL}api/clients`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let data: unknown = { message: responseText };

    try {
      data = JSON.parse(responseText);
    } catch {
      data = { message: responseText || response.statusText || 'Unknown error' };
    }

    if (!response.ok) {
      console.error('Upstream client creation failed', {
        status: response.status,
        statusText: response.statusText,
        data,
      });
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error in /api/clients route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};
