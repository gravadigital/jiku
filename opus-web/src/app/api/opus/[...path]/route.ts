import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/features/auth/config/nextauth.config';

/**
 * Proxy de las llamadas del navegador hacia la api.
 *
 * El navegador no habla con la api directamente: pide a `/api/opus/...` de este mismo
 * origen y este handler reenvía, agregando el access token de la sesión.
 *
 * Es lo que permite publicar una imagen sin configuración horneada. `NEXT_PUBLIC_*` se
 * embebe en el bundle en tiempo de build, así que una URL de api ahí ataría la imagen a
 * un despliegue; `API_URL` se lee en el servidor, en cada request.
 *
 * Efecto secundario deseable: el access token no sale del servidor.
 */
const API_URL = () => process.env.API_URL ?? '';

async function forward(req: NextRequest, path: string[]) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ code: 'unauthorized', message: 'Unauthorized' }, { status: 401 });
  }

  const base = API_URL();
  if (!base) {
    // Sin esto el fetch fallaría con una URL relativa y un error opaco.
    return NextResponse.json(
      { code: 'server_misconfigured', message: 'API_URL is not set' },
      { status: 500 }
    );
  }

  const target = new URL(
    `api/opus/${path.join('/')}${req.nextUrl.search}`,
    base.endsWith('/') ? base : `${base}/`
  );

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
  };
  // El Content-Type se reenvía tal cual, incluido el boundary de un multipart.
  const contentType = req.headers.get('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const response = await fetch(target, {
    method: req.method,
    headers,
    // Como ArrayBuffer y no como texto: una subida multipart es binaria y `text()` la
    // corrompería. `duplex` es obligatorio en fetch de Node cuando hay cuerpo.
    body: hasBody ? await req.arrayBuffer() : undefined,
    ...(hasBody ? { duplex: 'half' } : {}),
  } as RequestInit);

  // 204 y 304 no llevan cuerpo: construir una Response con body las rompe.
  if (response.status === 204 || response.status === 304) {
    return new NextResponse(null, { status: response.status });
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
    },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
