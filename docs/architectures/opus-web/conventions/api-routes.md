---
id: api-routes
display_name: Route Handlers (proxy catch-all)
language: nextjs
description: Un proxy catch-all reenvía todo /api/opus/* con el token, más dos handlers de adjuntos y uno público
applies_to: [frontend]
required_by: [auth]
package: next
---

# Route Handlers (opus-web)

> **Reemplaza** la convención `api-routes` del catálogo. El catálogo asume BFF selectivo — un
> handler por operación que el servidor no puede hacer. Acá el criterio es el opuesto: **un
> catch-all cubre toda la api**, y los handlers específicos son la excepción.

## La diferencia con `web`

Los dos frontends resuelven el mismo problema (el access token no debe llegar al navegador) de
formas opuestas:

| | `web` | `opus-web` |
|---|---|---|
| Dónde se habla con la api | Server Actions (`'use server'`) | Route handler, desde el navegador |
| Qué sabe el bundle | nada | su propio origen |
| Handlers necesarios | uno por operación que el cliente debe iniciar (4) | uno para todo (1) + 3 casos aparte |
| Endpoint nuevo de la api | requiere una Server Action | **no requiere nada** |

**Regla:** en `opus-web`, para consumir un endpoint nuevo de `/api/opus/*` **no se escribe un
handler.** El catch-all ya lo cubre; alcanza con el método en el servicio.

## El proxy catch-all

`src/app/api/opus/[...path]/route.ts`. Un `forward()` compartido y cinco exports que lo llaman.

```ts
// src/app/api/opus/[...path]/route.ts:18-40
async function forward(req: NextRequest, path: string[]) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ code: 'unauthorized', message: 'Unauthorized' }, { status: 401 });
  }

  const base = API_URL();
  if (!base) {
    // Sin esto el fetch fallaría con una URL relativa y un error opaco.
    return NextResponse.json(
      { code: 'server_misconfigured', message: 'API_URL is not set' }, { status: 500 }
    );
  }

  const target = new URL(
    `api/opus/${path.join('/')}${req.nextUrl.search}`,
    base.endsWith('/') ? base : `${base}/`
  );

  const headers: Record<string, string> = { Authorization: `Bearer ${session.accessToken}` };
  const contentType = req.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;
  // ...
}

export async function GET(req: NextRequest, { params }: Ctx)    { return forward(req, (await params).path); }
export async function POST(req: NextRequest, { params }: Ctx)   { return forward(req, (await params).path); }
export async function PATCH(req: NextRequest, { params }: Ctx)  { return forward(req, (await params).path); }
export async function PUT(req: NextRequest, { params }: Ctx)    { return forward(req, (await params).path); }
export async function DELETE(req: NextRequest, { params }: Ctx) { return forward(req, (await params).path); }
```

### Las cinco decisiones del handler, con su motivo

Cada una está comentada en el código y ninguna es obvia:

**1. `API_URL` es una función, no una constante.**

```ts
const API_URL = () => process.env.API_URL ?? '';
```

Se lee en cada request, no al importar el módulo. Es lo que permite que la variable sea de runtime
y la misma imagen sirva en cualquier entorno.

**2. La base se normaliza con `new URL`.**

`base.endsWith('/') ? base : `${base}/`` — tolera `API_URL` con y sin barra final. Los otros dos
handlers de adjuntos **no** hacen esto; ver [environment.md](../environment.md).

**3. `API_URL` vacío devuelve 500 explícito.** Sin el chequeo, el `fetch` fallaría con una URL
relativa y un error opaco. El comentario lo dice.

**4. El cuerpo va como `ArrayBuffer`, no como texto.**

```ts
// route.ts:51-54
// Como ArrayBuffer y no como texto: una subida multipart es binaria y `text()` la
// corrompería. `duplex` es obligatorio en fetch de Node cuando hay cuerpo.
body: hasBody ? await req.arrayBuffer() : undefined,
...(hasBody ? { duplex: 'half' } : {}),
```

Y el `Content-Type` se reenvía tal cual **incluido el boundary del multipart** (`route.ts:41-45`).
Sin eso, la subida de adjuntos no funciona.

**5. 204 y 304 se devuelven sin cuerpo.**

```ts
// route.ts:57-60
// 204 y 304 no llevan cuerpo: construir una Response con body las rompe.
if (response.status === 204 || response.status === 304) {
  return new NextResponse(null, { status: response.status });
}
```

### El preámbulo de auth

Los tres handlers autenticados repiten el mismo arranque: `await auth()`, y 401 si no hay
`accessToken`. **Con dos formatos de error distintos:**

| Handler | Cuerpo del 401 |
|---|---|
| `api/opus/[...path]` | `{"code":"unauthorized","message":"Unauthorized"}` |
| `api/attachments/[id]/preview` | `{"error":"Unauthorized"}` |

El primero coincide con la forma de `ApiError` que espera el interceptor de axios
(`lib/axios.ts:5-9`); el segundo no. En la práctica no importa porque el preview se consume desde
un `src`, no por axios — pero es una inconsistencia real.

**Regla:** un handler nuevo usa el formato `{code, message}` del catch-all.

### Lo que el catch-all no filtra

No hay allowlist de paths ni de métodos. Reenvía **cualquier** cosa bajo `/api/opus/*` con el token
del usuario logueado, en los cinco métodos.

Eso está bien **siempre que `api` autorice por rol en cada endpoint**, que es donde vive la
autoridad. Pero es explícito: **acá no hay una segunda barrera.** Un endpoint de `/api/opus/*` que
no chequee el rol queda expuesto a cualquier usuario autenticado de este portal.

Tampoco reenvía los headers de respuesta más allá del `Content-Type` (`route.ts:62-67`): un
`Content-Disposition` o un `Cache-Control` que mande la api se pierden. Es por qué los adjuntos
necesitan handlers propios.

## Los tres handlers aparte

### `GET /api/attachments/[id]/preview` — autenticado

Existe porque **la URL va en un `src` o un `href`**, y el navegador no puede agregar el
`Authorization` ahí.

```ts
// src/app/api/attachments/[id]/preview/route.ts:21-30
return new NextResponse(response.body, {
  status: 200,
  headers: {
    'Content-Type': response.headers.get('Content-Type') ?? 'application/octet-stream',
    'Content-Disposition': response.headers.get('Content-Disposition') ?? '',
    ...(response.headers.get('Content-Length')
      ? { 'Content-Length': response.headers.get('Content-Length')! } : {}),
  },
});
```

Reenvía tres headers que el catch-all descarta. `Content-Disposition` es el que usa
`RichContentRenderer` para sacar el nombre del archivo con un `HEAD`
(`RichContentRenderer.tsx:99-105`), y `Content-Length` para el tamaño.

El body pasa como stream (`response.body`), no se buferea.

### `GET /attachments/[id]/[fileName]` — **sin autenticación**

```ts
// src/app/attachments/[id]/[fileName]/route.ts:7-11
const { id } = await params;
const backendUrl = `${process.env.API_URL}api/opus/attachments/${id}/public`;
const response = await fetch(backendUrl);
```

Tres cosas que hay que saber:

- **No llama a `auth()`.** No hay sesión de por medio.
- **Está fuera del matcher del middleware** (`middleware.ts:46` excluye `attachments`), a
  propósito.
- **El `fileName` de la URL se ignora.** Solo sirve para que el archivo baje con nombre legible; el
  handler desestructura únicamente `id`.

**La autorización de ese archivo la decide `api` en el endpoint `/public`, no este frontend.** Si
ese endpoint no valida nada, el adjunto es público para quien tenga el id.

### `GET|POST /api/auth/[...nextauth]`

```ts
// src/app/api/auth/[...nextauth]/route.ts:1-4
// En v5 la ruta solo expone los handlers que arma NextAuth().
import { handlers } from '@/features/auth/config/nextauth.config';
export const { GET, POST } = handlers;
```

No hay lógica propia. En v5 la configuración vive en `NextAuth()` y la ruta solo re-exporta.

## `params` es una Promise

En Next 16 los params dinámicos son asíncronos. El tipo se declara explícito:

```ts
type Ctx = { params: Promise<{ path: string[] }> };
export async function GET(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
```

**Regla:** siempre `await params`. Los cuatro handlers lo hacen.

## Cuándo escribir un handler nuevo

| Caso | Handler propio | Por qué |
|---|---|---|
| Consumir un endpoint de `/api/opus/*` | **no** | El catch-all lo cubre |
| La URL va en un `src`/`href`/`download` | **sí** | El navegador no puede mandar el token |
| Necesitás un header de respuesta que el catch-all descarta | **sí** | Solo reenvía `Content-Type` |
| El recurso debe ser accesible sin sesión | **sí** | Y hay que excluirlo del matcher del middleware |
| Un webhook entrante | **sí** | No hay ninguno hoy |

## Qué NO hacer

- No agregar un handler para un endpoint que el catch-all ya cubre.
- No interpolar `${process.env.API_URL}` directo en una URL: usar `new URL` con base normalizada,
  como el catch-all. Los dos handlers de adjuntos hacen lo primero y rompen si `API_URL` no termina
  en `/`.
- No leer el cuerpo con `.text()` si puede ser binario.
- No devolver un cuerpo en un 204 o 304.
- No inventar un formato de error nuevo: `{code, message}`.
- No sacar una ruta del matcher del middleware sin entender que queda sin sesión.
