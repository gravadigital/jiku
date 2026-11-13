# Documentación sin carpetas en la api (jiku-docs 1.3.0) — qué cambia en una instalación existente

**Story:** S-094 · **Request:** REQ-021 · **Fecha:** 2026-10-26

La api se pone al día con el contrato 1.3.0 de jiku-docs (documentación sin carpetas): filtros nuevos,
nombres resueltos desde la base, tres rutas nuevas y el portal sin ruta. La decisión está en la
revisión de [ADR-015](../adrs/ADR-015-modulos-opcionales-del-bus.md) y los recorridos, en
[documentos-desde-la-web](../flows/documentos-desde-la-web.md) y
[buscador-de-documentacion](../flows/buscador-de-documentacion.md).

## Contrato HTTP

### Incompatible: `GET /api/docs/documents/{id}`

| Antes | Ahora |
|---|---|
| Dos consultas (`documents.get` + `folders.get`) | Una sola consulta (`documents.get`) |
| Respuesta con `folder: { id, path, effectivePermission, sharingBlocked }` | **Sin `folder`**. Se agregan `clientRefs`, `projectRefs`, `requirementRefs` y `taskRefs` (nombres desde la base) |

El único consumidor es `web`, que se publica junto. Un cliente propio que lea `folder` deja de funcionar.

### Compatible

- **`GET /api/docs/documents`:** `projectId`, `clientId` y `topic` aceptan listas (hasta 20); nuevos
  `hasProject`, `hasClient`, `hasTopic`, `person` (hasta 10), `visibility`, `myActiveProjects` (excluyente
  con `projectId`) y `count` (`page.total`). Pide `include: ['lock','topics']`. Cada ítem trae `clientRefs`
  y `projectRefs`. `projectId=12` llega a jiku-docs como `[12]`.
- **`GET /api/docs/search`:** mismos filtros (más `clientId`); cada hit trae `clientRefs` y `projectRefs`.
- **`POST /api/docs/documents`:** `folderId` y `fileName` son opcionales; la respuesta trae `folderId` y `fileName`.
- **Rutas nuevas** (`admin`, `user`): `POST /api/docs/documents/{id}/relations`,
  `GET /api/docs/documents/{id}/suggested-relations`, `GET /api/docs/suggestions`. Contrato: 92 operaciones.
- **Errores:** `version_pruned` responde 404 con `details` (antes caía en 500).
- **Portal:** `GET /api/opus/docs/documents` y `/{id}` ya no devuelven `path`, `folderId` ni `fileName`.

## Bus

- Consultas nuevas hacia jiku-docs: `documents.suggest-relations`, `topics.list` (por prefijo) y el comando
  `documents.{id}.relations.update` (sin `via` ni `checksum`).
- `documents.list` y `documents.search` mandan filtros por lista y `or` (`person`); `documents.list`,
  `include: ['lock','topics']` y `count` opcional.
- `@jiku/nats-protocol` y el auth-callout no cambian. El `actor` sigue siendo el de `buildActor`.

## Notes for existing installations

```markdown
### Notes for existing installations

- **jiku-docs 1.3.0 or later is required** by the api from this version. There is no runtime
  check: an older jiku-docs answers `invalid_fields` (400) to the new list filters and still
  demands `folderId` when creating a document. Installations without jiku-docs are not affected.
- **Breaking HTTP change:** `GET /api/docs/documents/{id}` no longer returns `folder`; it returns
  `clientRefs`, `projectRefs`, `requirementRefs` and `taskRefs` instead. Update custom clients.
- The portal endpoints (`/api/opus/docs/documents`) stop returning `path`, `folderId` and `fileName`.
- No new environment variables, no database migrations, no identity-provider role changes and no
  auth-callout changes.
```
