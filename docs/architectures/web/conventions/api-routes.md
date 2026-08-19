---
id: api-routes
display_name: Route Handlers (BFF selectivo)
language: nextjs
description: Route handlers solo para lo que el navegador no puede resolver server-side
applies_to: [frontend]
required_by: []
package: next
---

# Route Handlers (web)

> **Reemplaza** la convención `api-routes` del catálogo, cuyo criterio es "route handlers para
> clientes externos". Acá no hay clientes externos: los handlers existen porque **el navegador
> necesita originar la operación** y no puede firmar el request.

## El criterio

Un route handler se justifica solo si el navegador tiene que iniciar la llamada **y** una Server
Action no sirve. Hoy hay exactamente cuatro motivos válidos, y los siete handlers que existen
caen en ellos o son infraestructura de Auth.js.

| Handler | Método | Motivo |
|---|---|---|
| `/api/attachments` | POST | Progreso de subida: se hace con `XMLHttpRequest` desde el cliente, que expone `upload.onprogress`. El handler reenvía el body como stream |
| `/api/attachments/[id]/download` | GET | El navegador tiene que recibir el archivo y no puede mandar `Authorization` |
| `/api/attachments/[id]/preview` | GET | Igual: la URL va en el `src` de un `<img>` o el de un `<iframe>` |
| `/api/requirements/[reqid]` | PATCH | Update optimista con rollback en el cliente |
| `/api/clients` | POST | Alta desde un componente cliente |
| `/api/userinfo` | GET | Proxy al `userinfo` del proveedor de identidad |
| `/api/auth/[...nextauth]` | GET, POST | Handlers de Auth.js. No se escribe a mano |

> **`/api/clients` y `/api/userinfo` no cumplen el criterio.**
> El alta de actor no necesita nada del transporte: `createClient` ya existe como Server Action
> en `features/clients/services/clientsApi.ts` y el formulario podría usarla. Hoy
> `clientsClientApi.ts` llama al handler.
> `/api/userinfo` **no tiene ningún consumidor** en el frontend.
> Ambos quedan documentados como están; no son el patrón a copiar.

## El preámbulo obligatorio

Todo handler propio empieza igual: resolver el token y cortar sin él.

```ts
import { NextRequest, NextResponse } from 'next/server';
import { decodedToken } from '@/shared/utils/decoded-token';

export const POST = async (request: NextRequest) => {
  const token = await decodedToken();
  if (!token?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ...
};
```

**Reglas:**

- `decodedToken()` de `@/shared/utils/decoded-token`, no `auth()` directo. Es el punto único.
- El cuerpo del 401 es `{ error: 'Unauthorized' }`. No se filtra el motivo.
- El handler **no** confía en nada que venga del cliente para autorizar. La autorización real la
  hace la api con el `Bearer`.

## Reenvío a la api

```ts
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
```

**Reglas:**

- `fetch` nativo, **no** `apiClient`. El cliente axios está pensado para Server Actions y su
  interceptor ya resolvió el token; acá el token se pasa a mano porque ya se tiene.
- La URL se arma como `${process.env.API_URL}api/...` — **sin** `/` entre medio, porque
  `API_URL` termina en `/` en el deploy (`http://api:3000/`). Es la asimetría con `lib/axios.ts`,
  que normaliza el trailing slash. **Verificar el valor de `API_URL` antes de agregar un handler.**
- Si falta `API_URL`, responder `500 { error: 'Server configuration error' }` y loguear. Solo
  `/api/clients` lo hace hoy (`api/clients/route.ts:10-13`); los demás construirían una URL
  inválida.
- El status de la api se propaga tal cual: `NextResponse.json(data, { status: response.status })`.

## Streaming de respuesta binaria

Para descarga y preview, el body se reenvía sin materializarlo y se propagan las cabeceras que
el navegador necesita:

```ts
const contentType = response.headers.get('Content-Type') ?? 'application/octet-stream';
const contentDisposition = response.headers.get('Content-Disposition');
const contentLength = response.headers.get('Content-Length');

const headers = new Headers();
headers.set('Content-Type', contentType);
if (contentDisposition) headers.set('Content-Disposition', contentDisposition);
if (contentLength) headers.set('Content-Length', contentLength);

return new NextResponse(response.body, { status: 200, headers });
```

**Reglas:**

- Pasar `response.body` (el stream), nunca `await response.blob()`: un adjunto grande no se carga
  en memoria del servidor.
- Propagar `Content-Disposition` sin reescribirlo: es lo que decide el nombre del archivo
  descargado y si se muestra inline.
- Fallback `application/octet-stream` cuando la api no manda `Content-Type`.

## Parámetros dinámicos

En Next 15+ los params son una promesa:

```ts
export const GET = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
```

**Regla:** tipar el params como `Promise<...>` y hacer `await`. Sin el `await` el objeto llega
como promesa y el path sale con `[object Promise]`.

## Manejo de error del upstream

```ts
if (!response.ok) {
  const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
  return NextResponse.json(errorData, { status: response.status });
}
```

**Regla:** el `.catch()` en el parseo es obligatorio. Cuando la api devuelve un error con body
vacío o HTML (un 502 del proxy, por ejemplo), `response.json()` tira y el handler responde 500
en vez del status real.

`/api/clients` va un paso más y maneja el caso de un body que no es JSON leyendo el texto
primero:

```ts
const responseText = await response.text();
let data: unknown = { message: responseText };
try { data = JSON.parse(responseText); }
catch { data = { message: responseText || response.statusText || 'Unknown error' }; }
```

## Cliente del handler

Cuando el handler se llama desde el navegador, la llamada vive en
`features/{módulo}/services/{recurso}ClientApi.ts` — el sufijo `ClientApi` distingue del
`Api` que es Server Action.

```
features/attachments/services/
├── attachmentsApi.ts         'use server'  → apiClient → api
└── attachmentsClientApi.ts   navegador     → /api/attachments
```

**Regla:** el `ClientApi` **no** lleva `'use server'` y no importa `apiClient`. Usa `fetch` o
`XMLHttpRequest` contra rutas relativas (`/api/...`).

## Qué NO hacer

- No crear un handler para algo que una Server Action ya resuelve. El único beneficio sería
  simetría con una API REST que este frontend no expone.
- No poner lógica de negocio en un handler. Es transporte: token, reenvío, propagación de status.
- No devolver el `accessToken` ni ninguna parte del token en la respuesta.
- No omitir el preámbulo de auth "porque la api ya valida": un handler sin él permite usar el
  frontend como proxy anónimo hacia la red interna.
