# ADR-015: Módulos opcionales del bus

**Estado:** Aceptado (implementado)
**Fecha:** 2026-10-24 (documentado desde lo implementado; la decisión es de REQ-016 y su
implementación, de S-075 a S-084)
**Deciders:** Equipo de desarrollo de Grava Digital
**Tags:** arquitectura, mensajeria, nats, modulos-opcionales, registro-de-modulos, ruta-publica, documentacion
**Detectado desde:** REQ-016 · S-075 a S-084

---

## Contexto

La documentación de los proyectos vivía en HedgeDoc: una herramienta sin API, con todo público y
fuera del control de acceso de Jiku. REQ-016 la reemplaza por **jiku-docs**, un servicio que **vive
en otro repositorio** (`conectores/jiku-docs`), tiene su propia base y habla con Jiku por el bus
NATS. Tres rasgos del pedido no encajaban con nada de lo que ya existía en la api:

- **Es opcional (RF-14).** Jiku tiene que funcionar igual sin el módulo, incluso si el despliegue
  base todavía no creó el KV del registro. Por eso **nada en Jiku se compila con el nombre
  `jiku-docs`**: el nombre del servicio sale de un registro en runtime.
- **Los datos no están en la base de la api.** Hasta ahora toda lectura de dominio iba directo a
  PostgreSQL ([ADR-001](ADR-001-separacion-lectura-escritura.md)) y solo `core` atendía el bus.
  Con la documentación, la api tiene que **leer por el bus**, a un servicio que no es `core`.
- **Hay una ruta sin credencial que devuelve HTML.** El link compartido `{JIKU_PUBLIC_URL}/p/docs/{token}`
  lo abre alguien sin sesión. Es la primera ruta pública que sirve una página HTML (la única
  exención anterior, el link público de adjuntos, se eliminó en REQ-002 / S-009).

Es una decisión arquitectónica nueva: un servicio del bus que **no es core**, descubierto en
runtime por un registro, al que la api le habla **leyendo por el bus** (primera excepción a ADR-001
en la lectura de dominio) y la primera ruta pública HTML. Este es el DD-17 de REQ-016.

> **Regla de la story de cierre (S-085):** si lo implementado difiere de lo diseñado en REQ-016,
> **gana lo implementado** y la diferencia queda anotada en la tabla "DD-1 a DD-17 tal como
> quedaron".

## Decisión

### El registro `JIKU_MODULES` y el `ModuleRecord`

Un módulo opcional se **anuncia** escribiendo su propia clave en el bucket KV de JetStream
`JIKU_MODULES` (stream subyacente `KV_JIKU_MODULES`). El primer módulo es `docs`. El contrato es
[`docs/apis/jiku-modules.yaml`](../apis/jiku-modules.yaml), propiedad de Jiku y compartido con
jiku-docs. El valor de la clave es un `ModuleRecord` (`@jiku/nats-protocol`):

| Campo | Regla (`api/lib/modules/registry.ts`, `parseRecord`) |
|---|---|
| `module` | Tiene que coincidir con la clave (`docs`) |
| `serviceName` | `^[a-z][a-z0-9-]{1,40}$`. Se valida **antes** de armar cualquier subject |
| `protocol` | `^v[0-9]+$`; la api soporta `SUPPORTED_PROTOCOL = 'v1'` |
| `registeredAt` | string |

Los campos extra se toleran (el contrato permite campos nuevos dentro de v1). El bucket lo crea el
despliegue base de forma idempotente (`deploy/nats/create-modules-kv.sh`: `history 1`, `max_age 0`,
`allow_direct true`, `storage file`, `replicas 1`), aunque no haya módulos. jiku-docs escribe su
clave al arrancar; un apagado normal no la borra; **desinstalar es explícito**
(`jiku-docs module deregister`), y borrar la clave lleva a `not_installed` sin reiniciar la api.

El `serviceName` solo nombra los dos servicios micro del módulo, `{serviceName}-commands` y
`{serviceName}-queries`. Para `docs`, la plantilla del callout autoriza `jiku-docs-commands` y
`jiku-docs-queries` ([política literal](#la-política-del-bus-es-literal-h-2-f-8)).

### El estado calculado, en memoria, por réplica (DD-5, DD-6)

`ModuleRegistry` (`api/lib/modules/registry.ts`) mantiene el estado de cada módulo **en memoria de
cada réplica de la api**. No hay estado compartido: dos réplicas pueden discrepar hasta 30 s.

| Estado interno | Condición |
|---|---|
| `not_installed` | No existe la clave, o fue borrada (`DEL`/`PURGE`), o la api no pudo abrir el KV |
| `incompatible` | Valor ilegible o inválido, o `protocol` distinto de `v1`. **Hacia afuera se informa como `not_installed`** (`PublicModuleStatus` no tiene `incompatible`) y se loguea un error |
| `unavailable` | Clave válida, pero el ping no obtuvo respuesta |
| `available` | Clave válida y ping con respuesta |

Valores y comportamientos, tal como están en `registry.ts`:

- `MODULE_CHECK_INTERVAL_MS = 30000` (tick de 30 s) y `MODULE_PING_TIMEOUT_MS = 2000`. Sobre el
  tick: si el KV o el watch se perdieron, **se reabre**; si hay un registro válido, **se hace
  ping**. El ping es `request(modulePingSubject(serviceName), Empty, { timeout })` (cuerpo vacío,
  `Empty`).
- Un llamado que recibe `no responders` marca `unavailable` **ya** (sincrónico) y dispara un
  re-ping inmediato (`markUnavailable()`). Un `upstream_unavailable` (core no respondió **a
  jiku-docs**) **no** marca el módulo.
- **Dedupe**: el watch re-entrega el valor vigente al armarse; el registro ignora una entrada
  idéntica a la última aplicada (`lastApplied`), para no duplicar pings ni logs.
- **El watch se arma antes de esperar el primer ping**: así un cambio de la clave mientras el ping
  está en vuelo no se pierde. Un contador de `generation` descarta el resultado de un ping cuya
  clave cambió (sin él, un ping en vuelo dejaría `available` un módulo desinstalado).
- **Un fallo al arrancar no tumba la api (DD-6).** `start()` nunca rechaza. Con el bus caído o el KV
  inexistente el estado es `not_installed`, se loguea `[modules] docs: no se pudo leer el registro
  (...); reintento en 30 s` y el siguiente tick reintenta. `app.ts` lo arranca **después** de
  conectar el bus (`afterInitialize`, `.then(() => docsModule.start())`).
- Logs literales: `[modules] docs: {from} -> {to}` (info, solo en transición),
  `[modules] docs: registro inválido (...)` y `[modules] docs: protocolo {x} no soportado (soportado:
  v1)` (error).
- El estado hacia afuera lo exponen `GET /modules` y `GET /opus/modules` (idénticas; la segunda
  existe porque el catch-all de opus-web solo reenvía `/api/opus/*`), con `features` solo si el
  módulo está `unavailable` o `available`.

**`bindOnly` + `allow_direct: true`.** El cliente abre el KV con
`views.kv(MODULES_BUCKET, { bindOnly: true, allow_direct: true })`
(`api/lib/utils/bus/index.ts`, `openModuleKv`). `bindOnly` evita consultar el stream (la persona o
el servicio quizá no tenga permiso para `STREAM.INFO` más allá de lo concedido). **`allow_direct:
true` no es opcional**: con `bindOnly`, nats.js 2.29 deja `direct = false` y `get()` iría a
`$JS.API.STREAM.MSG.GET.*`, que ninguna plantilla autoriza (las plantillas autorizan
`$JS.API.DIRECT.GET.*`). El watch nunca rechaza: si termina con error se loguea y el registro lo
reabre en el próximo tick.

### La api como lectora por el bus: la primera excepción a ADR-001 en la lectura de dominio

[ADR-001](ADR-001-separacion-lectura-escritura.md) dice que un endpoint que lee **no** pasa por el
bus: va directo a PostgreSQL. La documentación no está en esa base, así que las rutas `/docs/*` y
`/opus/docs/*` **leen por el bus** (`jiku-docs-queries`). Es una excepción de **dominio**; la única
excepción previa (la lectura de archivos, REQ-001 / S-005) es de infraestructura. El JSDoc de
`api/lib/modules/client.ts` lo dice textualmente: *"EXCEPCIÓN A ADR-001: acá la api LEE por el bus,
porque la documentación no está en su base"*.

La excepción tiene un único punto de entrada, para que no se extienda por accidente: **todo llamado
a un módulo pasa por `api/lib/modules/client.ts`**.

### El embudo `actor: { id }` que falla cerrado (DD-1, DD-9)

`moduleQuery` / `moduleCommand` / `runModuleCommand` (`client.ts`, función interna `call`):

1. **Estado del módulo primero**: `respondIfModuleNotReady` responde 404 `module_not_installed`
   (también para `incompatible`) o 503 `module_unavailable`, sin publicar.
2. **Siempre `actor: { id }`**, solo `id`, con el `id` de la identidad verificada del token
   (`buildActor(res.req)?.id`). Lo inyecta el embudo **después** del spread del payload: si el
   payload trae un `actor`, gana el del token. El contrato de jiku-docs (`Actor`,
   `additionalProperties: false`) rechaza el sobre de core (`roles`, `name`…) con `invalid_fields`;
   por eso **no se reusan `sendCommand` ni `withActor`**.
3. **Falla cerrado**: sin identidad verificada la respuesta es **401 `{ code: 'unauthorized',
   message: 'Unauthorized' }` sin publicar**. Es lo opuesto a `withActor`. La razón: un llamado a
   jiku-docs **sin `actor`** lo trata como el propio servicio (clase `service`), que lee todo.
4. `payload` y `options` **nunca se loguean** (contenido de documentos, tokens de links).
5. Sin respuesta: timeout → **504 `{ code: 'gateway_timeout' }`**; inalcanzable (sin registro,
   `no responders`, bus no conectado) → **503 `module_unavailable`**. `no responders` además marca
   `unavailable`. **No hay reintentos automáticos en la api** ni caché de respuestas.
6. Un reply de error se traduce con el mapa del módulo (siguiente sección).

`via` lo fija la api (DD-9): `human` en las escrituras y los locks (`docs-documents-post.ts`,
`docs-documents-id-put.ts`, `docs-documents-id-lock-post.ts`). `agent` es de jiku-go.

La excepción a DD-1 son `shares.resolve` y `shares.attachment` (la ruta pública), que se llaman
**sin `actor`** porque no hay identidad. Esas rutas responden HTML, no JSON, y por eso usan
`sendToModule` (el mismo embudo sin traducción a HTTP) en lugar de `moduleQuery`. La opción
`anonymous` de `ModuleCallOptions` **existe sin llamadores en producción** (se conserva por
compatibilidad con TS-26 de S-077).

### El mapa de errores propio y el cuerpo `{ code, message, details? }` (DD-7)

`api/lib/modules/docs/errors.ts` (`DOCS_STATUS_BY_ERROR_CODE`) es **propio del módulo y no se mezcla
con `STATUS_BY_ERROR_CODE` de core**: los códigos se superponen (`invalid_fields`,
`caller_not_authorized`) y la regla de traducción es por servicio. El cuerpo es `{ code, message,
details? }`: `code` es el `errorCode` **sin traducir**; `details` es el `errorDetails` **verbatim**
y la clave **no existe** si jiku-docs no lo manda. Un código desconocido (el catálogo puede crecer
dentro de v1) → **500 conservando el `code`**.

| Status | Códigos |
|---|---|
| 400 | `invalid_fields`, `invalid_cursor`, `file_name_invalid`, `frontmatter_invalid`, `invalid_relation`, `content_too_large`, `checksum_mismatch`, `upload_not_found`, `attachment_type_not_allowed`, `attachment_too_large`, `share_expiry_invalid`, `secret_warning_not_acknowledged`, `semantic_search_not_configured` |
| 403 | `permission_denied`, `sharing_blocked`, `unknown_caller`, `caller_not_authorized` |
| 404 | `document_not_found`, `folder_not_found`, `attachment_not_found`, `share_not_found` |
| 409 | `version_conflict`, `document_locked`, `lock_not_held`, `already_exists`, `folder_not_empty` |
| 503 | `upstream_unavailable`, `attachments_not_configured` |
| 504 | `query_timeout` |
| 500 | `internal_error` y cualquier código desconocido |

Códigos **locales de la api** (no vienen de jiku-docs): `module_not_installed` (404),
`module_unavailable` (503, cuerpo compartido en `module-errors.ts`), `gateway_timeout` (504),
`unauthorized` (401 del embudo), `sharing_not_configured` (404, `'Los links compartidos no están
configurados'`) y `share_not_found` local (`'Link compartido no encontrado'`). Un id de path mal
formado responde 404 `*_not_found` **sin llamar al bus** (`api/lib/modules/docs/ids.ts`: el id entra
al subject, [ADR-002](ADR-002-comandos-nats-sin-jetstream.md)).

### La api no autoriza el dominio de documentación (DD-2) y las dos superficies (DD-3, DD-4)

La api solo **autentica, rutea por superficie y traduce errores**. Quien decide quién ve qué (ACL de
carpetas, visibilidad, clase de caller) es jiku-docs ([ADR-008](ADR-008-autorizacion-deny-by-default.md)
aplicado al módulo).

Todas las rutas de módulo llevan `requireModule('docs')` **antes** de `hasAnyRole`
(`api/lib/utils/middlewares/require-module.ts`): el orden es `requireModule → hasAnyRole → Joi`.

| Superficie | Rutas | Control |
|---|---|---|
| Estado | `GET /modules`, `GET /opus/modules` | `hasAnyRole(['admin','user','external-user'])` |
| Interna | 20 operaciones `/docs/*` | `hasAnyRole(['admin','user'])` |
| Portal (solo lectura) | `GET /opus/docs/documents`, `GET /opus/docs/documents/{id}`, `GET /opus/docs/attachments/{id}` | `hasAnyRole(['external-user','admin','user'])` (DD-3) |
| Pública (raíz) | `GET /p/docs/{token}`, `GET /p/docs/{token}/attachments/{id}` | sin credencial (ver abajo) |

- **DD-3**: el portal fuerza `filter.visibility: 'public'` en el listado (lo pone el handler, no sale
  de la query) y responde 404 a un documento no `public`. Es la regla de superficie de
  [ADR-006](ADR-006-dos-frontends-una-api.md): qué se expone en la superficie no depende del rol.
- **DD-4**: el listado del portal aplica `loadDocsScope` → `validateProjectPermissions` →
  `validateRequirementIsPublic` (si filtra por requisito). El detalle por id **no puede** (el
  proyecto no se conoce antes de pedirlo): queda cubierto por jiku-docs y por DD-3. Es la excepción
  anotada a la regla de ADR-008 sobre `external-user`.

`GET /docs/documents/{id}` compone dos consultas **en serie** (`documents.get` + `folders.get` con
`include: ['effectivePermission']`) y responde `{ ...document, folder: { id, path,
effectivePermission, sharingBlocked } }` (`api/lib/routes/docs-documents-id-get.ts`).

### Los ULID, el checksum y el límite de cuerpo (DD-8, F-10)

La api genera el `id` de alta (`documents.new`, `attachments.request-upload`, `shares.new`) con
`generateUlid` de `@jiku/nats-protocol` si el cliente no manda uno, y calcula el `checksum` del
contenido de texto (`api/lib/modules/docs/checksum.ts`: `sha256:` + hex del UTF-8). El `sessionId`
del lock y el `checksum` del binario de un adjunto los genera la web (solo quien tiene el archivo o
la sesión de edición puede).

**Límite de cuerpo de 768kb en `/api/docs`** (`DOCS_WRITE_BODY_LIMIT` en `api/app.ts`): un parser
`express.json({ limit: '768kb' })` solo para `POST`/`PUT` bajo `/api/docs`, instalado **antes** del
parser global. 768 KiB = 256 KiB de `content` con 2x de expansión por el escapado de JSON, más el
sobre. El resto de la api conserva los 100 kb de body-parser. Lo que supere el límite es 413.

### La ruta pública `/p/docs/*`: la primera ruta pública HTML (DD-10, DD-11, DD-12)

Se monta **en la raíz** de la api (`app.use(publicRoutes)`, barrel propio `api/lib/public-routes/`,
fuera de `/api`): el link es `{JIKU_PUBLIC_URL}/p/docs/{token}`. Es una excepción deliberada a la
convención `http-server`, y la **única exención** de `api/config/public.ts` (`get: ['p/docs/']`;
las otras cuatro listas siguen vacías). `put` entró al mecanismo global de autenticación (H-3):
`app.ts` instala `validateToken` para **cinco** métodos y `week-assigned-times-put.ts` ya no declara
el suyo.

**Orden real en `api/app.ts`:**

1. `app.set('trust proxy', parseTrustProxy(API_TRUST_PROXY))` si la variable viene (vacía = default
   de Express; un valor inválido hace lanzar a Express y la api no arranca).
2. **`publicHostOnly` — primer middleware** (DD-10): en el host de `JIKU_PUBLIC_URL` solo pasan
   `GET`/`HEAD` de `/p/docs/<algo>`; todo lo demás recibe el 404 genérico, antes de `validateToken`
   y del logger. Recíprocamente, fuera de ese host `/p/docs/*` también es 404.
3. `cors()`: por eso `Access-Control-Allow-Origin: *` llega también a `/p/docs/*` (F-18).
4. `app.use('/api/docs', docsWriteJson)` (768kb), `express.json()`, logger de requests con
   `ignoreRoute` para `/p/docs/*` (la URL lleva el token; esas rutas loguean su propia línea con el
   token enmascarado `jds_…`; no se loguea IP, User-Agent, título ni contenido).
5. `validateToken` global para `get`, `patch`, `post`, `put`, `delete`.
6. `app.use(publicRoutes)` en la raíz y luego el barrel de `lib/routes` bajo `/api`.

**Cadena de la ruta pública** (`api/lib/public-routes/index.ts`): `publicDocsHeaders` →
`publicDocsAccessLog` → `requirePublicHost` → `publicDocsRateLimit` → handler → `publicDocsNotFound`.
En el handler: token que no cumple `^jds_[A-Za-z0-9_-]{43}$` → 404 **sin llamar al bus**; módulo
`not_installed`/`incompatible` → 404 genérico; `unavailable` → 503 genérico; cualquier error de
jiku-docs → el **mismo** 404 (no revela si un link existió, venció o fue revocado).

**Rate limit (DD-11)**: `express-rate-limit` (dependencia nueva de `api`), `MemoryStore`
**por réplica**, `windowMs = 60000`, `limit = 60`, `standardHeaders: 'draft-8'`, solo sobre
`/p/docs/*`. **Un solo limitador** para la página y sus imágenes (P-8 de S-080).

**Cabeceras de toda respuesta** de `/p/docs/*` (200, 302, 404, 429, 503;
`api/lib/modules/docs/public-page.ts`, `PUBLIC_DOCS_HEADERS`):

```
Content-Security-Policy: default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
X-Robots-Tag: noindex
Referrer-Policy: no-referrer
Cache-Control: private, no-store
X-Content-Type-Options: nosniff
```

`img-src` admite `https:` porque las imágenes apuntan a `/p/docs/{token}/attachments/{id}`, que
redirige (302) al storage S3 y la CSP se evalúa también contra el destino de la redirección
(H-5). `Referrer-Policy: no-referrer` evita que el token viaje como `Referer` al storage.

**Página HTML (DD-12)**: la arma la api con una plantilla mínima propia (`renderSharedDocument`):
título escapado + el `html` de `shares.resolve`, **que ya sanitizó jiku-docs** (la api no vuelve a
sanitizar ni parsea markdown). Si viene `htmlUrl` (> 256 KiB) la api lo descarga **del lado del
servidor** (`public-html.ts`: tope 5 MiB, timeout 10 s, `maxRedirects: 0`, solo `http(s)`) y lo
incrusta. Las páginas 404/429/503 son genéricas e idénticas para cualquier causa.

**`client` en `shares.resolve` / `shares.attachment`.** jiku-docs no ve al visitante: la api reenvía
`client` (`ClientInfo`: `ip` ≤ 100, `userAgent` ≤ 2000, claves ausentes omitidas;
`api/lib/modules/docs/public-share.ts`) para que la auditoría de accesos al link no quede vacía.
Mandar más de esos largos sería `invalid_fields` y el link se vería inválido, por eso se recorta.

### `features.sharing` y `sharing_not_configured` (DD-13, DD-14)

`GET /modules` informa `features.sharing: boolean` para el módulo `docs`: `true` si
`JIKU_PUBLIC_URL` está definida y no vacía (`api/lib/modules/docs/features.ts`, leída en cada
llamada). Es aditivo a la respuesta. `POST /docs/documents/{id}/shares` responde **404
`sharing_not_configured`** si la api no tiene `JIKU_PUBLIC_URL`: jiku-docs arma la `url` con su
propio `JIKU_PUBLIC_URL`, y crear un link que la api después no sirve sería entregar un link roto.
Revocar (`DELETE /docs/shares/{id}`) **no** chequea `sharing`: revocar un link existente sigue
siendo posible aunque la instalación deje de publicar links.

`assertPublicUrlConfig()` corta el arranque si `JIKU_PUBLIC_URL` está configurada pero no es una
URL, no usa `http:`/`https:`, o trae path, query o fragmento. Ausente o en blanco es válido (los
links quedan apagados). Un path haría que jiku-docs entregue links `.../docs/p/docs/{token}` que la
api nunca sirve, con `features.sharing: true`.

### Reescritura de adjuntos por path (DD-15) y `features/docs/` (DD-16)

Los visores de `web` y `opus-web` reescriben **por path y sin mirar el host** todo enlace cuyo path
sea `/docs/attachments/{ULID}` hacia su propio proxy. No hace falta una variable nueva por frontend,
y es seguro: el proxy solo le pide a jiku-docs ese id con la identidad de quien mira. En `web` el
módulo es `web/src/features/docs/` con dos páginas (`/docs` y `/docs/[id]`) y el panel embebible en
proyecto, objetivo y requisito; `opus-web` tiene `opus-web/src/features/docs/` (solo lectura) y un
handler propio de adjuntos con `redirect: 'manual'` (el catch-all de opus-web sigue redirecciones y
convertiría el 302 en un proxy del binario).

### La política del bus es literal (H-2, F-8)

Las plantillas del auth-callout autorizan subjects **literales**: `{instance}.*.jiku-docs-commands.v1.>`
y `{instance}.*.jiku-docs-queries.v1.>` (el comodín va al final del prefijo de servicio; es lo que
exige [ADR-008](ADR-008-autorizacion-deny-by-default.md) y el README del callout). Un módulo
registrado con otro `serviceName` hace que la api arme un subject correcto **y el bus lo rechaza**.
**Cambiar el `serviceName` de un módulo (o agregar un módulo) es un cambio de seguridad
deliberado: una línea por plantilla** (`deploy/nats/auth-callout/templates/`). Generalizar el
permiso a cualquier servicio es exactamente la ampliación que el README prohíbe. El patrón
`^[a-z][a-z0-9-]{1,40}$` se valida antes de armar cualquier subject, así que un registro
malicioso no puede inyectar tokens de subject ni comodines.

El invariante de las plantillas: `docs.yaml ⊇ connector.yaml` (más el servidor), con test; la regla
`match: docs` va **antes** de `internal-app` en `rules.yaml` (si no, el machine user cae en la
plantilla de conector y reinicia en loop).

## DD-1 a DD-17 tal como quedaron

Fuente del diseño: sección "Decisiones de diseño" de
[REQ-016](../requests/REQ-016.modulo-opcional-de-documentacion-jiku-docs.md).

| DD | Diseño (REQ-016) | Implementado (archivo) | Diferencia |
|---|---|---|---|
| DD-1 | `actor: { id }` siempre; sin `actor` en `shares.resolve`/`shares.attachment` | `api/lib/modules/client.ts` inyecta `{ id }` tras el spread y falla cerrado con 401; `public-share.ts` llama sin `actor` | Se agregó **falla cerrada** (401 sin publicar) y la opción `anonymous` quedó **sin llamadores** (las rutas públicas usan `sendToModule`, P-9 de S-080). Las rutas públicas **sí** mandan `client` (`ClientInfo`), que el diseño no preveía (P-1 de S-080) |
| DD-2 | La api no autoriza el dominio | Ningún handler de `docs-*.ts` evalúa ACL; solo `requireModule` + `hasAnyRole` | Ninguna |
| DD-3 | `/docs/*` internas; `/opus/docs/*` solo lectura, fuerza `visibility: public`, 404 si no es `public` | `opus-docs-documents-get.ts`, `opus-docs-documents-id-get.ts`, `opus-docs-attachments-id-get.ts` | El tercer endpoint del portal (`GET /opus/docs/attachments/{id}`) **no puede** aplicar DD-3 para usuarios internos (F-13; ver Riesgos) |
| DD-4 | Listado del portal con permiso de proyecto y requisito público | `loadDocsScope` → `validateProjectPermissions` → `validateRequirementIsPublic` | Ninguna |
| DD-5 | Estado en memoria por réplica; lectura, watch, ping 30 s y ante `no responders` | `api/lib/modules/registry.ts` | Se sumaron dedupe de entradas, watch armado antes del primer ping y descarte de pings por `generation` (S-077) |
| DD-6 | Un fallo al arrancar no tumba la api | `registry.ts` (`open()` nunca rechaza) y `app.ts` (`afterInitialize`) | Ninguna |
| DD-7 | `{ code, message, details? }` | `api/lib/modules/docs/errors.ts` | Ninguna |
| DD-8 | La api genera ULID de alta y `checksum` de texto; la web, `sessionId` y checksum del binario | `generateUlid` en `docs-documents-post.ts`, `docs-attachments-post.ts`, `docs-documents-id-shares-post.ts`; `docs/checksum.ts` | **Límite de 768kb** en `POST`/`PUT` de `/api/docs` (F-10), no previsto; el alta sin `id` **no es idempotente** y los documentos de más de 256 KiB no se crean ni se editan por HTTP (F-11) |
| DD-9 | `via` lo fija la api (`human`) | `docs-documents-post.ts`, `docs-documents-id-put.ts`, `docs-documents-id-lock-post.ts` | Ninguna |
| DD-10 | `/p/docs/*` en la raíz, exento, solo en el host de `JIKU_PUBLIC_URL`; en ese host nada más | `app.ts`, `public-routes/index.ts`, `public-docs.ts`, `public-url.ts`, `config/public.ts` | El host se compara contra el `Host` **crudo** (`req.headers.host`), nunca `X-Forwarded-Host` (P-7 de S-080); `HEAD` también pasa (y suma un acceso, F-17); `assertPublicUrlConfig` corta el arranque con una URL inválida (P-3) |
| DD-11 | `express-rate-limit`, memoria, 60/min por IP, `trust proxy` | `public-docs.ts`, `api/lib/utils/trust-proxy.ts` | **Un solo limitador** para página e imágenes (P-8): un documento con más de ~59 imágenes agota el cupo en una carga. Timeout del bus en la ruta pública → **503** (P-5) |
| DD-12 | La api arma la página con `html` de `shares.resolve`; `htmlUrl` > 256 KiB se descarga del lado del servidor | `public-page.ts`, `public-html.ts` | Falla de `htmlUrl` o reply sin `html` ni `htmlUrl` → **503** con log sin URL (P-6) |
| DD-13 | `features.sharing` en `GET /modules` | `docs/features.ts`, `modules/registry.ts` | Ninguna |
| DD-14 | 404 `sharing_not_configured` | `docs-documents-id-shares-post.ts` | Ninguna |
| DD-15 | Reescritura por path de `/docs/attachments/{ULID}` | `web/.../docsUrlTransform`, `opus-web/.../docsUrlTransform` | Ninguna. Documento con `contentUrl` (> 256 KiB): **web** lo descarga del lado del servidor (P-5 de S-081); **opus-web** lo descarga **desde el navegador** (P-8 de S-084) y necesita CORS `GET` en el bucket de jiku-docs (sin verificar) |
| DD-16 | Módulo `features/docs/` con dos páginas y el panel en las tres fichas | `web/src/features/docs/`, `web/src/app/(loggedin)/docs/page.tsx` y `docs/[id]/page.tsx` | Rutas reales `/docs` y `/docs/[id]`; el handler de adjuntos está **fuera** de `(loggedin)` (`web/src/app/docs/attachments/[id]/route.ts`); la ruta BFF `api/docs/documents/[id]/unlock` se agregó para `pagehide` con `keepalive` |
| DD-17 | Documentar un ADR-015 | Este documento | — |

Diferencias de infraestructura (no son DD pero cambiaron lo diseñado):

| Tema | Diseño | Implementado |
|---|---|---|
| Lectura del KV | `kv.get` con `bindOnly` | **`allow_direct: true` es obligatorio** con `bindOnly` (nats.js 2.29); sin él el `get` va a `$JS.API.STREAM.MSG.GET.*`, que ninguna plantilla autoriza |
| Permiso de consumidor del watch | Forma con sufijo | `KV_READ_WATCH` (6 líneas) incluye `$JS.API.CONSUMER.CREATE.KV_JIKU_MODULES` **sin sufijo** (la forma pelada, H-P1 de S-075 deploy) en `connector`, `docs` y las dos plantillas de persona |
| Plantillas | `docs` independiente | `docs.yaml ⊇ connector.yaml` (invariante con test, H-P2/H-P3) más el lado servidor |
| `local.sh up` | Sin cambios | Invoca `create-modules-kv.sh` (`deploy/local.sh:123`) y por eso **ahora requiere `nsc`**; `local.sh down -v` borra el volumen y el KV (por eso `up` lo crea) |
| `core` | "core no cambia" (D-1) | Cambia en una línea: `SERVICE_ROLES = ['internal-app', 'core', 'docs']` (`core/src/events/auth/identity-type.ts`, H-1). Sin eso el evento de autenticación del machine user (llega con `matched_role: "docs"` y sin `email`) se descartaba y core respondía `caller_not_authorized`/`unknown_caller` |

## Implementation Rules

- Toda llamada a un módulo **DEBE** pasar por `api/lib/modules/client.ts`
  (`moduleQuery`/`moduleCommand`/`runModuleCommand`, o `sendToModule` en las rutas que responden
  HTML). **NO SE DEBE** hablar con un módulo desde un handler con `bus()` directo.
- **NO SE DEBE** usar `sendCommand` ni `withActor` con un módulo: su sobre (`roles`, `name`…) es
  `invalid_fields` para jiku-docs.
- El `actor` **DEBE** ser solo `{ id }` y **DEBE** inyectarlo el embudo, después del spread del
  payload. Sin identidad verificada el embudo **DEBE** fallar cerrado (401 sin publicar). **NO SE
  DEBE** llamar a un módulo sin `actor` salvo en una ruta pública deliberada
  (`shares.resolve`/`shares.attachment`).
- Toda ruta de módulo **DEBE** llevar `requireModule('<módulo>')` **antes** de `hasAnyRole`.
- El mapa de errores **DEBE** ser **por módulo** (`docs/errors.ts`); **NO SE DEBE** mezclar con
  `STATUS_BY_ERROR_CODE` de core. El cuerpo **DEBE** ser `{ code, message, details? }` con `code`
  sin traducir y `details` verbatim.
- **NADA se compila con el nombre del servicio**: el `serviceName` sale del registro. El
  `serviceName` **DEBE** validarse (`^[a-z][a-z0-9-]{1,40}$`) antes de armar un subject.
- Agregar un módulo o cambiar su `serviceName` **DEBE** acompañarse de la edición de las plantillas
  del callout (`deploy/nats/auth-callout/templates/`): es un cambio de seguridad y se revisa como tal.
- El cliente del KV **DEBE** abrirse con `bindOnly: true` **y** `allow_direct: true`.
- El estado del módulo **NO DEBE** persistirse ni compartirse entre réplicas.
- La api **NO DEBE** autorizar el dominio de un módulo (ACL, visibilidad): solo autentica, rutea
  por superficie y traduce errores.
- `/p/docs/*` **NO DEBE** loguearse con el token en la URL (`ignoreRoute` en el logger de requests;
  línea propia con `jds_…` enmascarado). **NO DEBE** loguearse la `downloadUrl` ni el `htmlUrl`.
- El host público **NO DEBE** servir nada más que `GET`/`HEAD` de `/p/docs/*`
  (`publicHostOnly` va primero en `app.ts`). La comparación **DEBE** hacerse contra el `Host` crudo,
  nunca contra `X-Forwarded-Host`.
- Toda respuesta de `/p/docs/*` **DEBE** llevar las cinco cabeceras de `PUBLIC_DOCS_HEADERS` y el
  404 **DEBE** ser el mismo para cualquier link inválido.
- Cualquier cambio en `api/config/public.ts` es un **cambio de seguridad** (ADR-008).

## Consecuencias

### Positivas

- **Jiku sigue funcionando sin el módulo.** Con el KV inexistente o la clave ausente la api arranca,
  informa `not_installed` y los frontends ocultan la sección.
- **Agregar o quitar jiku-docs no requiere desplegar la api**: el registro y el watch lo detectan
  (borrar la clave pasa a `not_installed` sin reiniciar).
- **La excepción a ADR-001 está confinada** a un único archivo (`client.ts`), con falla cerrada.
- **Un solo punto de autorización del dominio** (jiku-docs), sin duplicar el ACL en la api.
- **La superficie pública es mínima y revisable**: una exención en `config/public.ts`, host
  exclusivo, cabeceras de solo lectura y un 404 indistinguible.

### Negativas

- **Dos consultas en serie en `GET /docs/documents/{id}`** (`documents.get` + `folders.get`): suma
  latencia de dos viajes al bus.
- **El estado puede discrepar hasta 30 s entre réplicas** (DD-5): una réplica puede aún ver
  `available` lo que otra ya marcó `unavailable`.
- **`Access-Control-Allow-Origin: *` llega a `/p/docs/*`** (F-18): `cors()` corre antes del router
  público. No amplía la exposición (la ruta ya es pública y de solo lectura), pero está.
- **Dos mapas de errores** (core y docs) con códigos superpuestos, a propósito.
- **Infraestructura nueva**: un bucket KV, una plantilla y una regla de callout, una dependencia
  (`express-rate-limit`) y tres variables (`JIKU_PUBLIC_URL`, `API_TRUST_PROXY`,
  `DOCS_PUBLIC_DOMAIN`).
- Sin `$SRV.PING` para personas: un cliente con token de persona (jiku-go) no puede distinguir
  `unavailable` de `available` (DV-2).

### Riesgos

- **R-1** — *El orden de `rules.yaml`*. Si `docs` no va antes de `internal-app`, el machine user
  cae en la plantilla de conector y reinicia en loop. **Mitigación implementada:** test estructural
  que exige `docs` antes de `internal-app`.
- **R-2** — *H-1 no detectado donde la fila ya existe*. **Mitigación implementada:** el test de
  core parte de un evento con `matched_role: 'docs'` y sin `email`, no de una fila existente.
- **R-3** — *Ampliar `connector.yaml` amplía a **todos** los `internal-app`*: cualquier conector
  puede llamar a jiku-docs y jiku-docs lo trata como clase `service`, que **lee toda la
  documentación**. **Aceptado** (D-2 de jiku-docs) y documentado en el README del callout y en las
  notas de instalación. Revisable si aparece un conector que no deba leer la documentación.
- **R-4** — *Personas con permisos de JetStream por primera vez* (`$JS.API.INFO`, `DIRECT.GET`,
  `CONSUMER.CREATE` sobre `KV_JIKU_MODULES`). Acotado por stream y sin mutación; un test
  estructural verifica que ninguna plantilla de persona tenga `$JS.API.STREAM.` distinto de `INFO`
  ni `$KV.`.
- **R-5** — *Rate limit en memoria por réplica*: con N réplicas el límite efectivo es 60·N/min.
  **Aceptado**; el token de 256 bits hace inviable la enumeración igual. Documentado en
  `known-limitations.md`.
- **R-6** — *Ruteo de Next*: `app/docs/attachments/[id]/route.ts` (fuera del grupo) convive con
  `app/(loggedin)/docs/[id]/page.tsx`; resuelven paths distintos (el segmento estático gana) y los
  ids son ULID, nunca `attachments`.
- **R-7** — *Locks huérfanos al cerrar el navegador*. **Mitigación:** `keepalive` en `pagehide` +
  vencimiento de 120 s: nunca peor que esperar el TTL.
- **R-8** — *Divergencia de tipos entre `web` y `opus-web`* (declaran tipos a mano). **Mitigación:**
  los tipos de docs se escriben verbatim del contrato de jiku-docs.
- **F-13 — Ruta 23 del portal sin recorte para internos.** `GET /opus/docs/attachments/{id}` no
  puede aplicar DD-3, porque el reply de `request-download` no trae la visibilidad. Para
  `external-user` lo cubre jiku-docs; **un usuario interno que use el portal recibe el adjunto de un
  documento `internal` si conoce el id**. Aceptado: el usuario interno ya puede leerlo por
  `/docs/attachments/{id}`.

## Divergencias con el contrato `jiku-modules.yaml`

El contrato [`docs/apis/jiku-modules.yaml`](../apis/jiku-modules.yaml) declara qué permisos del
callout bastan para leer y observar el registro. Lo implementado difiere en tres puntos; en ningún
caso se corrige el contrato desde esta story.

- **DV-1 — Permiso de lectura directa más amplio (F-1).** Las plantillas conceden
  `$JS.API.DIRECT.GET.KV_JIKU_MODULES.>`; el contrato declara
  `$JS.API.DIRECT.GET.KV_JIKU_MODULES.$KV.JIKU_MODULES.>`. Es un **superconjunto**, solo lectura,
  acotado al stream del registro.
- **DV-2 — Sin `$SRV.PING` para personas (F-2).** Un cliente con token de persona (jiku-go) **no
  puede distinguir `unavailable` de `available`** por ping: lee la clave, pero no pregunta si el
  servicio responde. La sugerencia D-2 lo contemplaba; la story no lo concedió. Efecto: un cliente
  de persona ve `available` cuando el módulo está registrado pero caído. Se documenta en
  `known-limitations.md`.
- **DV-3 — Coinciden.** El cálculo de estado (`not_installed`, `incompatible`, `unavailable`,
  `available`), el ping a `{serviceName}-queries` y el tratamiento de `incompatible` como
  `not_installed` hacia afuera son los del contrato.

## Pendientes de verificación

Ninguno de estos puntos se verificó contra el bus real. **No se afirma que funcionen**: se registran
para correrlos con el stack levantado.

- **F-3 — `$JS.ACK.JIKU_DOCS_EVENTS` sin veredicto.** El ack del indexer de jiku-docs
  (`AckWait 2m`) podría quedar fuera del permiso de respuesta (`ttl 45s`). Si aparece `Publish
  Violation ... $JS.ACK`, se agrega `$JS.ACK.JIKU_DOCS_EVENTS.>`. El mismo síntoma en `JIKU_EVENTS`
  sería un defecto de S-067.
- **F-4 — Permisos KV provisorios.** La lista `KV_READ_WATCH` vigente es provisoria hasta TS-34
  (reset del consumidor ordenado con nats.js y con el cliente Go). La verificación contra el bus real
  (Task 6 de S-075 deploy) **no se ejecutó**; la sonda no cubre TS-26/27/28/30; los flags de `nats
  kv add` dentro de nats-box no se verificaron.
- **F-6 — Comentario desactualizado** en `deploy/nats/auth-callout/templates/core.yaml`: el
  encabezado dice que core es el único que recibe requests, y ya no es cierto. Ajuste de comentario
  de la fila `deploy`.
- **F-7 — Prueba manual contra NATS real de S-077 (TS-62) no ejecutada**: `openModuleKv`,
  `pingModule` y la ausencia de `Permissions Violation` sobre `STREAM.MSG.GET`.
- **F-23 — Inconsistencia cosmética** del elemento `titulo-documento` en el estado "módulo no
  disponible" de opus-web.
- **F-26 — Microcopy sin fuente UX** (P-15 de S-082; P-6 y P-10 de S-083).
- **F-27 — Verificaciones manuales contra el stack real no ejecutadas** (S-079, S-080, S-082,
  S-083): curl de escritura, lock con dos sesiones, subida real a S3, link compartido de punta a
  punta, `code`/`details` visibles en un build de producción.
- Sin verificar además: el CORS `GET` del bucket de jiku-docs que necesita opus-web para bajar un
  `contentUrl` (F-22), y el límite real de adjuntos de jiku-docs frente al tope de 10 MB del
  `Dropzone` de la web (F-25).

### Pendientes fuera de este REQ

- **F-30 — `users.list` no expone `roles` ni `identityType`.** D-10 de jiku-docs pide hacerlos
  incluibles solo para la clase `connector` (CA-7 de core). **Resuelto por REQ-017 (S-086):**
  `users` declara `roles` e `identityType` en `includableByClass.connector`; para personas siguen sin
  existir. Riesgo aceptado R-2 en `documentation/known-limitations.md`.
- **F-31 — Enlaces del importador de HedgeDoc.** El importador reescribe enlaces a
  `{JIKU_WEB_URL}/docs/documents/{id}` y la web sirve `/docs/{id}`. NOT DOCUMENTED - needs
  verification. Story de seguimiento.

### Discrepancias reportadas

Se reportan; **no se corrigen en esta story** (las reglas de la story mandan que `docs/apis/*.yaml`
sea la fuente de verdad y que la discrepancia sea un bug a reportar).

- **F-20 — Cuerpo del 401.** [ADR-009](ADR-009-token-confinado-al-servidor.md) fija
  `{"error":"Unauthorized"}`; la convención `api-routes` de opus-web manda `{code, message}` para
  handlers nuevos, y tres handlers de opus-web (catch-all, `files/[id]/preview`,
  `docs/attachments/[id]`) ya la usan. `web` usa `{error}` en todos. El status 401 —lo que el ADR
  protege— se cumple igual. Se resuelve con `/product-change-technical-definition`, no acá.
- **Auditoría de `docs/apis/api.yaml` contra `api/lib/routes` y `api/lib/public-routes`**
  (27 operaciones `x-jiku-module: docs`): método, path, roles y presencia de archivo coinciden en
  las 27. Bugs encontrados:
  - **B-1 (F-12).** El encabezado de `api.yaml` dice "los 88 endpoints" y el archivo declara **89**
    operaciones (72 internas, 15 de portal, 2 públicas). Desfase de uno previo a REQ-016.
  - **B-2.** `DELETE /docs/shares/{id}` declara `400` (`ModuleBadRequest`) y el handler
    (`docs-shares-id-delete.ts`) no tiene validación de entrada: un id mal formado responde 404
    `share_not_found` sin llamar al bus y no hay otro input. El `400` solo podría llegar si
    jiku-docs respondiera `invalid_fields`.
  - **B-3.** Ninguna de las operaciones de escritura de `/api/docs` declara `413`, aunque el cuerpo
    supera 768kb en `POST`/`PUT` (`DOCS_WRITE_BODY_LIMIT`) y body-parser responde 413 antes de
    llegar a la ruta (solo `POST /docs/documents` lo menciona en la descripción). Ese 413 no
    es JSON `{code, message}`: la api no tiene un manejador de errores propio para él.
  - **B-4 (documentos relacionados, fuera de `docs/apis/`).** `docs/prd/architecture.md` decía "los
    61 endpoints"; el conteo real es 89 (se corrige en esta story). `documentation/api-reference.md` y
    `README.md` dicen 62 (F-33): se actualizan en la release.
  - `docs/stories/S-080…md` tiene `status: Ready` en el frontmatter y `**Status:** Completed` en el
    cuerpo (F-32).

## Alternativas Consideradas

### Alternativa 1: El nombre del servicio compilado o configurado por variable

**Pros:**
- Sin registro, sin KV, sin watch ni ping: el nombre sería una constante o una variable de entorno.

**Cons:**
- Jiku quedaría acoplado al nombre `jiku-docs`, contra el requisito de que nada se compile con él.
- Instalar o quitar el módulo exigiría tocar la configuración y reiniciar la api.
- No hay forma de distinguir `not_installed` de `unavailable` sin un estado que declare la intención.

**Por qué se descartó:** RF-14 pide opcionalidad real. El registro permite que el módulo se anuncie
y se retire sin tocar Jiku, y da los cuatro estados.

---

### Alternativa 2: Comodín de servicio en las plantillas

Permitir `{instance}.{user_id}.*.v1.>` para que la api hable con cualquier `serviceName`.

**Pros:**
- Cambiar el `serviceName` no tocaría las plantillas del callout.

**Cons:**
- Es la ampliación que ADR-008 y el README del callout prohíben ("el comodín va al final del
  prefijo de servicio"): cualquier servicio del bus quedaría alcanzable por cualquier identidad.

**Por qué se descartó:** la política queda literal (`jiku-docs-commands`/`-queries`). Cambiar el
`serviceName` es un cambio de seguridad deliberado de una línea por plantilla (H-2).

---

### Alternativa 3: Proxy de la página pública en la web en vez de la api

**Pros:**
- Un solo host de cara al usuario; la web ya sirve páginas.

**Cons:**
- El host público tiene que ser **propio**, para no compartir cookies con la aplicación. Servirlo
  desde la web lo acercaría a la sesión.
- La web reenviaría por la api igual; un salto más sin beneficio.
- La api ya tiene el rate limit, el módulo y las cabeceras de la ruta pública.

**Por qué se descartó:** DD-10 monta la ruta en la api, en la raíz y con host exclusivo.

---

### Alternativa 4: Estado del módulo compartido entre réplicas

**Pros:**
- Todas las réplicas verían el mismo estado, sin la ventana de 30 s.

**Cons:**
- Estado nuevo (caché, tabla o clave) que mantener y que puede quedar desactualizado.

**Por qué se descartó:** RF-2 pide no agregar estado nuevo. El indicador de disponibilidad tolera
una discrepancia de hasta 30 s (DD-5).

## Referencias

- Pedido: [REQ-016](../requests/REQ-016.modulo-opcional-de-documentacion-jiku-docs.md) (decisiones
  DD-1 a DD-17, hallazgos H-1 a H-5 y riesgos R-1 a R-8)
- Stories: S-075 a S-084 (implementación) y S-085 (documentación de arquitectura y operación) en
  `docs/stories/`
- ADRs relacionados: [ADR-001](ADR-001-separacion-lectura-escritura.md) (excepción de lectura),
  [ADR-002](ADR-002-comandos-nats-sin-jetstream.md) (gramática request/reply),
  [ADR-006](ADR-006-dos-frontends-una-api.md) (superficies), [ADR-007](ADR-007-identidad-zitadel-auth-callout.md)
  (rol `docs` y auth-callout), [ADR-008](ADR-008-autorizacion-deny-by-default.md) (exención de
  `/p/docs/*`), [ADR-009](ADR-009-token-confinado-al-servidor.md) (discrepancia F-20),
  [ADR-014](ADR-014-jetstream-para-eventos-de-dominio.md) (`JIKU_DOCS_EVENTS` es de jiku-docs, no de
  Jiku)
- Contratos: [`docs/apis/api.yaml`](../apis/api.yaml),
  [`docs/apis/jiku-modules.yaml`](../apis/jiku-modules.yaml)
- Flujos: [`descubrimiento-de-modulos`](../flows/descubrimiento-de-modulos.md),
  [`documentos-desde-la-web`](../flows/documentos-desde-la-web.md),
  [`lectura-por-link-compartido`](../flows/lectura-por-link-compartido.md)
- Operación del callout: `deploy/nats/auth-callout/README.md`
- Documentos de jiku-docs (otro repositorio, `conectores/jiku-docs/docs/`):
  `decisiones-integracion.md`, `especificacion-v1.md` y `apis/` (contratos `jiku-docs-queries.yaml`
  y `jiku-docs-commands.yaml`)
