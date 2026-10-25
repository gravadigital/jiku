---
id: bus-modules
display_name: Llamadas a módulos opcionales del bus
language: node
description: Calls from the api to optional bus modules (today jiku-docs) - registry-based discovery, per-replica status, caller identity as the full actor from buildActor (fails closed), per-module error map
applies_to: [api]
required_by: []
package: nats
---

# Llamadas a módulos opcionales del bus (api, NATS)

> **Convención nueva**, sin equivalente en el catálogo. No es `bus-commands`: acá el destino no es
> `core` sino un **módulo opcional** que se descubre por registro (`JIKU_MODULES`), el sobre de
> identidad es **el mismo** que recibe core (`buildActor`) pero el embudo **falla cerrado** sin él, el mapa de errores es propio
> del módulo y **también hay lecturas**. Es la segunda excepción a ADR-001 (la api lee por el bus
> porque la documentación no está en su base): ver
> [ADR-015](../../../adrs/ADR-015-modulos-opcionales-del-bus.md).

## Cuándo aplica

Toda ruta que hable con un módulo registrado en el KV `JIKU_MODULES`. Hoy hay uno: **`docs`**
(jiku-docs). Cubre las 20 rutas internas `/api/docs/*`, las 3 del portal `/api/opus/docs/*`, las 2
de estado (`GET /api/modules`, `GET /api/opus/modules`) y las 2 públicas `/p/docs/*`.

Las mutaciones y lecturas **de dominio de core** no pasan por acá: usan
[`bus-commands`](./bus-commands.md) y la base.

## Paquete

```
nats                   # 2.29: KV (views.kv), watch, request, ping
@jiku/nats-protocol    # moduleQuerySubject / moduleCommandSubject / modulePingSubject, ModuleRecord
express-rate-limit     # 8.x, solo la ruta pública /p/docs/*
```

## Estructura

```
api/lib/modules/
├── registry.ts          estado del módulo en memoria por réplica: lectura del KV, watch, ping cada 30 s
├── client.ts            embudo: moduleQuery / moduleCommand / runModuleCommand / sendToModule
├── module-errors.ts     cuerpos 404 module_not_installed y 503 module_unavailable (compartidos)
└── docs/
    ├── errors.ts        DOCS_STATUS_BY_ERROR_CODE y docsErrorBody { code, message, details? }
    ├── features.ts      features.sharing (JIKU_PUBLIC_URL definida)
    ├── ids.ts, query.ts validación de ULID de path y de query params, paginación
    ├── checksum.ts      sha256 del contenido de texto
    ├── download.ts      302 a la URL prefirmada
    ├── public-url.ts    publicDocsHost, isPublicHostRequest, assertPublicUrlConfig, máscara del token
    ├── public-page.ts   PUBLIC_DOCS_HEADERS y páginas genéricas 404/429/503
    ├── public-html.ts   plantilla HTML de la página pública
    └── public-share.ts  shares.resolve / shares.attachment sin actor, con ClientInfo
api/lib/public-routes/   barrel propio, montado en la RAÍZ (ver http-server)
├── index.ts             cadena común de /p/docs
├── public-docs-get.ts   GET /p/docs/:token
└── public-docs-attachments-get.ts   GET /p/docs/:token/attachments/:id
api/lib/utils/middlewares/require-module.ts   requireModule('docs')
api/lib/utils/middlewares/public-docs.ts      publicHostOnly, cabeceras, log enmascarado, rate limit
api/lib/utils/trust-proxy.ts                  parseTrustProxy(API_TRUST_PROXY)
api/lib/routes/modules-get.ts, opus-modules-get.ts
api/lib/routes/docs-*.ts (20), opus-docs-*.ts (3)
```

## Cómo se usa

### La cadena de middlewares

`requireModule('docs')` va **antes** de `hasAnyRole`, y Joi después:

```ts
// lib/routes/docs-documents-get.ts
router.get('/docs/documents', requireModule('docs'), hasAnyRole(['admin', 'user']),
  validateQueryParams(LIST_SCHEMA), listDocuments);
```

Con el módulo no instalado, un token sin rol recibe 404 y no 403: el módulo no existe, y no
importa quién pregunta. `requireModule` lee el estado **en memoria** (no consulta el bus) y, si
responde, no llama a `next()`.

### `moduleQuery` / `moduleCommand` / `runModuleCommand`

Mismo contrato que `sendCommand` / `runCommand` de core: devuelven el `data`, o `null` si **ya
respondieron el error** (el llamador corta con `if (!data) return;`). `runModuleCommand` devuelve
`true` si salió bien, para métodos sin `data`.

```ts
// lib/routes/docs-documents-id-get.ts
const document = await moduleQuery(res, 'docs', 'documents.get', { id, include: [...] });
if (!document) return;
```

El embudo (`call()` de `lib/modules/client.ts`): chequea el estado del módulo → arma `actor` →
`sendToModule` → traduce el resultado a HTTP. Una ruta puede encadenar varias llamadas
(`GET /api/docs/documents/:id` compone `documents.get` + `folders.get` con
`include: ['effectivePermission']`).

### `sendToModule` — cuando la respuesta no es JSON

Publica el cuerpo **tal cual** (no agrega ni quita `actor`), no mira el estado del módulo y
devuelve un resultado clasificado en vez de responder: `{ kind: 'data' | 'failure' | 'timeout' |
'unreachable' }`. Lo usan las rutas públicas `/p/docs/*`, que responden HTML y no JSON. La opción
`anonymous` de `moduleQuery` existe sin llamadores en producción.

## El estado del módulo

`ModuleRegistry` (`lib/modules/registry.ts`) lee la clave `docs` de `JIKU_MODULES` con
`views.kv(bucket, { bindOnly: true, allow_direct: true })`, la **observa** (watch) y hace ping a
`$SRV.PING` cada `MODULE_CHECK_INTERVAL_MS = 30000` (timeout `MODULE_PING_TIMEOUT_MS = 2000`).
Es **estado en memoria por réplica**: dos réplicas pueden discrepar hasta 30 s.

| Estado | Cuándo | Qué responde una ruta de `/docs` |
|---|---|---|
| `not_installed` | sin clave, clave borrada, o el KV no se pudo leer al arrancar | 404 `module_not_installed` |
| `incompatible` | registro inválido (JSON, `serviceName`, `protocol`, `module`, `registeredAt`) o `protocol` distinto de `v1` | 404 `module_not_installed` (hacia afuera se informa como `not_installed`) |
| `unavailable` | registro válido, pero el ping no responde | 503 `module_unavailable` |
| `available` | registro válido y el ping responde | la ruta sigue |

- **Re-ping inmediato:** un `no responders` en una llamada marca `unavailable` en el acto y
  re-pinguea.
- **`upstream_unavailable` no marca el módulo:** significa que `core` no le respondió a jiku-docs;
  el módulo está vivo.
- **Un fallo al arrancar no tumba la api** (bus caído, KV inexistente): `not_installed` + log +
  reintento a los 30 s. `docsModule.start()` se llama después de conectar el bus y nunca rechaza.
- El registro **deduplica** entradas idénticas del watch (re-entrega el valor vigente) y arma el
  watch **antes** de esperar el primer ping.
- Logs literales: `[modules] docs: {from} -> {to}` (info), `[modules] docs: registro inválido
  (...)`, `[modules] docs: protocolo {x} no soportado (soportado: v1)`, `[modules] docs: no se pudo
  leer el registro (...); reintento en 30 s`.
- `GET /api/modules` y `GET /api/opus/modules` (idénticas; la segunda existe porque el catch-all de
  opus-web solo reenvía `/api/opus/*`) devuelven `[{ module, status, features? }]`; `features`
  (`sharing`) se omite si el módulo no está instalado.

> **`allow_direct: true` no es opcional.** Con `bindOnly`, nats.js 2.29 deja `direct = false` y
> `get()` iría a `$JS.API.STREAM.MSG.GET.*`, que ninguna plantilla de permisos autoriza (autorizan
> `$JS.API.DIRECT.GET.*`).

> **`serviceName` se valida contra `^[a-z][a-z0-9-]{1,40}$`** antes de armar subjects. La política
> del bus es literal: las plantillas autorizan `jiku-docs-commands` / `jiku-docs-queries`; un
> módulo registrado con otro `serviceName` arma el subject correcto y el bus lo rechaza. Cambiarlo
> es un cambio de seguridad deliberado (ADR-015).

## El cuerpo de error de módulo

**Es `{ code, message, details? }`**: `code` es el `errorCode` del módulo **sin traducir**;
`details` es el `errorDetails` **verbatim** (la clave **no existe** si no viene). Difiere de
`error-handling`, que fija `{code, message}` para core. El mapa es **propio del módulo**
(`DOCS_STATUS_BY_ERROR_CODE`, `lib/modules/docs/errors.ts`) y **no** se mezcla con
`STATUS_BY_ERROR_CODE` de core: los códigos se superponen (`invalid_fields`,
`caller_not_authorized`) y la regla es por servicio. Un código desconocido responde 500
conservando el `code`: el catálogo del módulo puede crecer dentro de v1.

| Status | Códigos |
|---|---|
| 400 | `invalid_fields`, `invalid_cursor`, `file_name_invalid`, `frontmatter_invalid`, `invalid_relation`, `content_too_large`, `checksum_mismatch`, `upload_not_found`, `attachment_type_not_allowed`, `attachment_too_large`, `share_expiry_invalid`, `secret_warning_not_acknowledged`, `semantic_search_not_configured` |
| 403 | `permission_denied`, `sharing_blocked`, `unknown_caller`, `caller_not_authorized` |
| 404 | `document_not_found`, `folder_not_found`, `attachment_not_found`, `share_not_found` |
| 409 | `version_conflict`, `document_locked`, `lock_not_held`, `already_exists`, `folder_not_empty` |
| 503 | `upstream_unavailable`, `attachments_not_configured` |
| 504 | `query_timeout` |
| 500 | `internal_error` y cualquier código desconocido |

**Códigos locales de la api** (no vienen del módulo):

| Status | `code` | Cuándo |
|---|---|---|
| 404 | `module_not_installed` | módulo `not_installed` / `incompatible` |
| 503 | `module_unavailable` | módulo `unavailable`, o el bus no entrega (`unreachable`) |
| 504 | `gateway_timeout` | el módulo no respondió a tiempo |
| 401 | `unauthorized` | sin identidad verificada (ver abajo) |
| 404 | `sharing_not_configured` | `JIKU_PUBLIC_URL` sin definir y se pide un link (`'Los links compartidos no están configurados'`) |
| 404 | `share_not_found` / `*_not_found` | **id de path con forma inválida**: se responde sin llamar al bus (`respondDocsNotFound`) |

## Identidad

**Se llama siempre en nombre de la persona con el `actor` de `buildActor(res.req)` sin transformar**
—`{ id, roles, name?, username?, email? }`, el mismo sobre que recibe core (REQ-019)—, inyectado
**después** del spread (gana el del token, entero). jiku-docs clasifica a la persona con esos `roles`
(D-11): `admin`/`user` → interna, `external-user` → externa, otro → sin acceso.
**Falla cerrado**: sin identidad verificada, la ruta responde **401 sin publicar**, porque un
llamado sin `actor` lo trata jiku-docs como el propio servicio (clase `service`) y **lee todo**.

> **Por qué no se reusan `sendCommand` ni `withActor`:** el sobre es el mismo, pero `withActor` sin
> identidad publica **sin `actor`** (falla abierto, correcto para core) y para jiku-docs eso es el
> propio servicio. Tampoco hay un actor "por defecto" aceptable. Hasta REQ-019 el embudo mandaba solo
> `{ id }`.

**Requiere jiku-docs con D-11.** Un jiku-docs anterior declara `Actor` con solo `id` y responde
`invalid_fields` (400) a toda llamada con `roles` (ADR-015, R-9).

**La api no autoriza el dominio de documentación**: jiku-docs decide qué ve y qué edita la persona
(`permission_denied`, `sharing_blocked`). La api solo decide si la ruta existe para el rol
(`hasAnyRole`) y, en el portal, el recorte de superficie (ver
[`authorization`](./authorization.md)).

**Las rutas públicas `/p/docs/*` no llevan `actor`**: llaman `shares.resolve` y `shares.attachment`
con `sendToModule`, y mandan un `client` (`ClientInfo`: `ip` ≤ 100, `userAgent` ≤ 2000) para la
auditoría de accesos de jiku-docs. El token del link es la credencial.

## Reglas

- Una ruta que habla con un módulo declara `requireModule('<módulo>')` **antes** de `hasAnyRole`.
- Usá `moduleQuery` / `moduleCommand` / `runModuleCommand`. Después de la llamada, `if (!data)
  return;` (o `if (!ok) return;`): la respuesta ya salió.
- **Nunca** armes el `actor` a mano, ni lo tomes del cuerpo, ni le agregues campos: lo inyecta el embudo con `buildActor(res.req)` entero.
- **Nunca** llames a un módulo sin identidad verificada: el embudo responde 401 y no publica.
- **Nunca** loguees `payload`, `options`, el token de un link ni el contenido de un documento.
  El error de bus se loguea como `[modules] {module} {method}: {error.message}`.
- Un módulo nuevo agrega su mapa en `ERRORS_BY_MODULE` (`client.ts`) y su carpeta
  `lib/modules/{módulo}/`. No mezcles su mapa con `STATUS_BY_ERROR_CODE`.
- El cuerpo de error de módulo conserva `code` y `details` tal cual vienen. No traduzcas el `code`.
- Un id de path con forma inválida es 404 `*_not_found` **sin llamar al bus**.
- El estado del módulo se lee de memoria. No consultes el KV ni hagas ping en el request.
- Una ruta que responde HTML (pública) usa `sendToModule`, no `moduleQuery`.
- No cambies `allow_direct: true` ni el patrón del `serviceName` sin revisar los permisos de las
  plantillas de `deploy/nats/auth-callout/`.
- `upstream_unavailable` no se traduce a `unavailable`: no marques el módulo por eso.

## Integración con otras convenciones

- **bus-commands**: el destino de las mutaciones de dominio de core. Comparte `bus()` y el `Reply`;
  no comparte sobre de identidad, mapa de errores ni `STATUS_BY_ERROR_CODE`.
- **error-handling**: fija `{code, message}`; acá se agrega `details?` para los módulos.
- **authorization**: la api no autoriza el dominio de documentación; el portal recorta por
  `visibility: 'public'`.
- **http-server**: la excepción de `lib/public-routes/`, montada en la raíz.
- **logging**: nunca payloads ni tokens; `/p/docs/*` se excluye del log de requests y escribe su
  propia línea con el token enmascarado.
- **testing**: `FakeBus` simula el KV, el ping y las respuestas de módulo (`tests/helpers/docs-module.ts`).
- **env-config**: `JIKU_PUBLIC_URL`, `API_TRUST_PROXY` y los asserts de arranque.
