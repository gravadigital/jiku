---
id: storage
display_name: Almacenamiento de adjuntos (S3-compatible)
language: node
description: S3-compatible object storage with in-memory multipart uploads, checksums and rollback
applies_to: [api]
required_by: []
package: "@aws-sdk/client-s3"
---

# Almacenamiento de adjuntos (api, S3-compatible)

> **Convención nueva**, sin equivalente en el catálogo. Cubre la subida, el servido y el borrado
> de archivos: la única superficie del servicio que toca un sistema externo con estado.

> ## ⚠ PARCIALMENTE OBSOLETA (REQ-001 / S-005, 2026-08-19)
>
> Con REQ-001 el storage pasa a tener **un solo dueño: `core`**. La `api` pierde el cliente de S3 y
> sus credenciales.
>
> - **La sección "Servido de archivos" YA NO DESCRIBE EL SERVICIO.** S-005 la reemplazó: los cinco
>   caminos de lectura autorizan, publican `files.{fileId}.request-download` y responden **302** a
>   la prefirmada que firmó `core`. La `api` no sirve bytes. La fuente de verdad es
>   [`docs/flows/lectura-de-archivos.md`](../../../flows/lectura-de-archivos.md).
> - **La subida sigue vigente hasta S-004**, que es la que apaga los dos últimos consumidores de
>   `storageService` (`attachments-post.ts` y `opus-attachments-post.ts`). Cuando esa story cierre,
>   esta convención **se elimina entera**.
>
> No agregues consumidores nuevos de `storageService` en la `api`.

## Cuándo aplica

Las rutas de adjuntos: `attachments-*` (superficie interna) y `opus-attachments-*` (portal de
clientes).

## Paquete

```
@aws-sdk/client-s3                # 3.995, operaciones sobre el bucket
@aws-sdk/s3-request-presigner     # URLs pre-firmadas
multer                            # 2.0, multipart en memoria
uuid                              # nombre único del objeto
crypto (node:crypto)              # checksum sha256
```

## El servicio de storage

`lib/utils/storage-service.ts` exporta una **instancia única**, ya construida:

```ts
import storageService, { STORAGE_KEY_PREFIX } from '../utils/storage-service';
```

| Método | Qué hace |
|---|---|
| `uploadFromBuffer(key, buffer, mimeType)` | sube con ACL `private`; devuelve `{key, bucket, region, etag, size}` |
| `getFileStream(key)` | stream de lectura; distingue `NoSuchKey` |
| `deleteFile(key)` | borra |
| `listByPrefix(prefix)` | lista paginando con `ContinuationToken` |
| `getPresignedUrl(key, expiresIn = 60)` | URL firmada, default 60 s |
| `headObject(key)` | metadatos: tamaño, content-type, fecha |

Sirve cualquier proveedor con API de S3: AWS S3, MinIO, DigitalOcean Spaces, Cloudflare R2. Para
MinIO local, `STORAGE_S3_FORCEPATHSTYLE=true`.

### Sin defaults, a propósito

El constructor **lanza** si falta endpoint, credenciales, bucket o región
(`storage-service.ts:60-67`):

> Bucket y región dependen del proveedor de cada instalación. Un default apuntaría a la
> infraestructura de otro, y el error recién aparecería al subir el primer archivo.

**Excepción:** `STORAGE_S3_KEY_PREFIX` sí tiene default (`'grava-gestion'`), y es deliberado:

> La clave se guarda en `attachments.storage_key`. Cambiar el prefijo en una instalación con
> datos deja **inaccesibles los adjuntos ya subidos**. No lo toques en una base existente.

## La clave del objeto

```
{STORAGE_KEY_PREFIX}/{entityType}/{entityId ?? 'draft'}/{uuid}{ext}
```

El nombre original **no** va en la clave: va en la columna `file_name`. El `uuid` evita colisiones
y hace que la clave no sea adivinable.

## Multer: en memoria, con límites

```ts
// lib/utils/multer-config.ts
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});
```

En memoria porque el archivo se sube a S3 y no se persiste en disco. **Los límites de multer son
la primera barrera**, y hay una segunda dentro del handler (`MAX_FILE_SIZE`), porque los campos
del cuerpo llegan después.

## Validación de tipo: doble lista blanca

Extensión **y** MIME type, las dos:

```ts
// lib/routes/attachments-post.ts:15-31
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', ..., 'text/csv'];
export const ALLOWED_EXTENSIONS = ['.jpg', ..., '.csv'];   // 13 extensiones
```

> Las dos, no una. La extensión sola se falsifica renombrando; el MIME solo lo manda el cliente.
> Si agregás un tipo, agregalo a **ambas** listas.

## El flujo de subida

```
multer (memoria, ≤10 archivos, ≤10 MB)
   ▼
validar entityType contra el enum → 400 invalid_entity_type
validar entityId presente (salvo requirement_draft) → 400 invalid_fields
   ▼
canUserAccessEntity(...) → 403 access_denied          (solo si hay entidad concreta)
   ▼
por cada archivo:
   tamaño → extensión → MIME  → 400 upload_failed
   uuid + checksum sha256
   storageService.uploadFromBuffer(...)   → registra la clave en uploadedKeys
   Attachment.create(...)                 ← la única escritura directa a la base
   ▼
201 con los adjuntos creados

en cualquier error: borrar del bucket TODO lo de uploadedKeys
```

### El rollback

```ts
// lib/routes/attachments-post.ts:124-134
for (const key of uploadedKeys) {
  try {
    await storageService.deleteFile(key);
    logger.warn(`Rolled back uploaded file: ${key}`);
  } catch (rollbackError: any) {
    logger.error(`Failed to rollback file ${key}: ${rollbackError.message}`);
  }
}
```

> No hay transacción entre S3 y PostgreSQL. El rollback es la compensación, y **loguea tanto el
> borrado como su propia falla** — un rollback que falla deja un objeto huérfano en el bucket y
> tiene que quedar rastreable.

Este es el modelo para cualquier operación futura que toque un sistema externo antes de poder
fallar.

## Drafts sin entidad

`requirement_draft` puede subirse con `entityId` nulo: el requisito todavía no existe y el
adjunto se ancla al usuario por `uploaded_by`. En ese caso no hay entidad contra la que validar
permisos, y el JWT ya garantiza la pertenencia.

## Servido de archivos

> **OBSOLETO desde S-005.** Lo que sigue describe cómo servía la `api` **antes** de REQ-001, y se
> conserva solo como registro. Hoy ninguno de estos endpoints sirve el byte: todos responden **302**
> a una prefirmada de `core`, y la rama por tamaño de archivo dejó de existir. El mecanismo vigente
> está en [`docs/flows/lectura-de-archivos.md`](../../../flows/lectura-de-archivos.md).
>
> Lo único de esta sección que **sigue vigente** es la nota sobre el endpoint público: su validación
> de visibilidad por `entityType` con 403 por default, el `nosniff` y la CSP de sandbox se
> mantienen intactos, y la advertencia sobre ids enumerables sigue aplicando.

Tres endpoints, con criterios distintos:

| Endpoint | Cómo sirve |
|---|---|
| `GET /api/attachments/:id/preview` | inline, con `Content-Disposition: inline` |
| `GET /api/attachments/:id/download` | como descarga, con el `file_name` original |
| `GET /api/opus/attachments/:id/public` | **sin autenticación**; para archivos grandes redirige a URL pre-firmada |

El endpoint público es el único exento de auth de todo el servicio. Sirve **solo** adjuntos cuya
entidad tiene `visibilityLevel === 'public'`, responde 403 en cualquier otro caso, y manda
`X-Content-Type-Options: nosniff` con una CSP de sandbox.

> Los ids son secuenciales, así que ese endpoint **es enumerable**. Es un riesgo aceptado y
> registrado: la protección es la validación de visibilidad por `entityType`, no la opacidad del
> id. Si agregás un `entityType`, agregá su rama de validación de visibilidad ahí también, o
> quedará accesible sin credencial.

## Reglas

- Usá la instancia `storageService`. No construyas otro `S3Client`.
- No agregues defaults para bucket, región, endpoint o credenciales.
- No cambies `STORAGE_S3_KEY_PREFIX` en una instalación con datos.
- La clave se arma con el patrón `{prefix}/{entityType}/{entityId ?? 'draft'}/{uuid}{ext}`. El
  nombre original va en la base, no en la clave.
- Un tipo de archivo nuevo se agrega a `ALLOWED_EXTENSIONS` **y** a `ALLOWED_MIME_TYPES`.
- Subida en memoria, con los límites de multer **y** el chequeo de tamaño en el handler.
- Toda subida calcula el checksum sha256 y lo guarda.
- Si una subida múltiple falla a mitad, borrá del bucket lo ya subido y logueá cada borrado y cada
  falla de borrado.
- Un `entityType` nuevo se agrega a `canUserAccessEntity`, a `canUserViewEntity` y, si aplica, a
  la validación de visibilidad del endpoint público.
- Las URLs pre-firmadas se emiten con el `expiresIn` más corto que sirva. El default es 60 s.
- Nunca logs del contenido de un archivo. La clave y el tamaño, sí.

## Integración con otras convenciones

- **authorization**: `canUserAccessEntity` / `canUserViewEntity` son la capa 3 para adjuntos.
- **http-server**: multer va como primer middleware de la cadena en las rutas de subida.
- **error-handling**: `upload_failed`, `invalid_entity_type`, `no_files`, y el error handler de
  multer.
- **orm**: `Attachment.create()` es la única escritura directa que queda en la api.
- **logging**: cada operación de storage se loguea con la clave.
- **env-config**: las siete variables `STORAGE_S3_*`.
