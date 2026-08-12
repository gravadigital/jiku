import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileName: string }> }
) {
  const { id } = await params;

  const backendUrl = `${process.env.API_URL}api/opus/attachments/${id}/public`;

  const response = await fetch(backendUrl);

  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/octet-stream',
      'Content-Disposition': response.headers.get('Content-Disposition') ?? '',
    },
  });
}
