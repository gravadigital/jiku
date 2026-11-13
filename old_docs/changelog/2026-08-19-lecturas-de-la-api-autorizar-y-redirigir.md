# Las lecturas de la `api`: autorizar y redirigir

**Story:** S-005 · **Request:** REQ-001 · **Servicio:** `api` · **Fecha:** 2026-08-19

Las cuatro rutas de la `api` que servían bytes pasan a **autorizar, resolver el `file_id` del
vínculo, publicar `files.{fileId}.request-download` y responder 302** a la prefirmada que firmó
`core`. Se agrega un quinto camino para el archivo **sin vínculo**, y las dos rutas de metadatos
pasan a leer los campos del archivo por un `include` a `files`.

**La `api` deja de mover bytes.** Es simétrico con la subida: igual que el PUT va directo del
navegador a S3, el GET también.

## Los cinco caminos de lectura

| # | Endpoint | Sesión | Id que recibe | Autorización | `disposition` |
|---|---|---|---|---|---|
| A | `GET /api/attachments/{id}/preview` | Sí | Vínculo | `canUserViewEntity` | `inline` |
| B | `GET /api/attachments/{id}/download` | Sí | Vínculo | `canUserViewEntity` | `attachment` |
| C | `GET /api/opus/attachments/{id}/preview` | Sí | Vínculo | `hasAnyRole` + `canUserViewEntity` | `inline` |
| D | `GET /api/opus/attachments/{id}/public` | **NO** | Vínculo | `visibilityLevel === 'public'` | `attachment` |
| E | `GET /api/files/{id}/preview` — **NUEVO** | Sí | **Archivo** | **Solo el JWT** | `inline` |

**El orden de las operaciones ES el criterio de aceptación, no un detalle de estilo:** el 400, el
404 y el 403 ocurren **antes de publicar nada**. Un handler que publicara primero y autorizara
después pasaría los tests de status igual, pero le habría pedido a `core` una URL firmada para un
archivo que el usuario no puede ver.

**El 302 deja de ser una rama.** La lógica de "archivos ≤15MB por streaming, más grandes por
prefirmada" desaparece: `MAX_STREAMING_SIZE` y `PRESIGNED_URL_EXPIRY` ya no existen en estos
archivos. Es el único camino, para todos los tamaños.

## Camino E: el archivo sin vínculo

Un archivo **sin ningún vínculo es un estado válido**: quien subió tres archivos y todavía no
guardó el requisito tiene que poder previsualizarlos. Sin vínculo no hay id de `attachments`, así
que este camino recibe el **`fileId`** y **su autorización es solo el JWT** — sin vínculo no hay
entidad contra la que validar permiso de proyecto, igual que en la subida.

Se decidió **ruta propia** (`GET /api/files/{id}/preview`) y no un parámetro sobre la ruta
existente: sobrecargar un path con dos espacios de ids distintos es la confusión que D-16 evita.
La decisión quedó escrita en `docs/apis/api.yaml`, reemplazando la nota "a definir al implementar".

El handler **no consulta la base**: la existencia, la retención y el `byte_status` los valida
`core`. **No hay `/files/{id}/download`** — la descarga siempre ocurre sobre un adjunto vinculado.

## El mapa de errores

`file_not_found` y `file_not_available` **no estaban** en `STATUS_BY_ERROR_CODE`
(`lib/utils/bus/protocol.ts`). Sin ellos, CA-7 y CA-8 salían **500** por más correcto que fuera el
handler. Ahora mapean a **404**: son estados del recurso pedido, no validación de entrada.

| Código | Status | Cuándo |
|---|---|---|
| `file_not_found` | 404 | el archivo fue borrado (`retention_status` ≠ `active`) |
| `file_not_available` | 404 | **el byte nunca llegó** (`byte_status: 'pending'`) |

`file_not_available` es el caso que se cobra de verdad: no es un link viejo, es **el usuario cuyo
PUT falló en silencio**. Se detecta antes de redirigir, así que ve un 404 entendible en lugar de un
error opaco de S3 al final de una redirección.

## Los metadatos y el `HEAD` — el detalle que no es de estilo

Los frontends hacen `HEAD` al preview para resolver nombre y tamaño antes de renderizar embebido.
Los metadatos viajan en el **reply del comando** (`fileName`, `mimeType`, `fileSize`) y la `api`
los pone en los headers del 302, **sin volver a consultar la base**.

Dos decisiones que parecen cosméticas y sostienen el renderizado:

1. **No se usa `res.redirect()`.** Internamente hace `format()` + `send(body)`, que **pisan** el
   `Content-Type` con `text/html` y el `Content-Length` con el largo de su cuerpo de cortesía. Con
   eso el `HEAD` perdería justo los metadatos que el 302 existe para dar.
2. **`Content-Length` se manda SOLO en `HEAD`.** En un `GET` prometería bytes que una redirección
   no tiene: el cliente se queda esperando y la conexión termina abortada. En el `HEAD`, que no
   lleva body, el header describe el recurso y es correcto. **Esto corrige el diseño original de la
   story**, que pedía el header en ambos: se descubrió al implementar, con la conexión colgada.

El helper vive en `lib/utils/bus/download-ticket.ts`, junto con la interfaz `DownloadTicket`.

## Metadatos de adjuntos desde el `include`

`GET /api/attachments` y `GET /api/attachments/{id}` **no cambian su contrato** —los frontends no
se tocan— pero los campos del archivo ahora salen de un `include` a `files`, no de las columnas
duplicadas de `attachments`, que después del backfill son un espejo que puede divergir. Se suma
`byteStatus`, que ni siquiera existe en `attachments`.

**La respuesta se mantiene APLANADA a propósito:** los tipos de `web` y `opus-web` están escritos a
mano y **no fallan en compilación si divergen**. Anidar el archivo obligaría a tocar todos los
consumidores por un beneficio de forma, y el modo de fallo sería en runtime.

`uploadedBy` **cambia de origen**: sale de `files.uploaded_by`, no del vínculo. Son la misma
persona hoy solo porque el backfill copió el valor, y esa igualdad no está garantizada.

Se **conservan** `description`, `retentionStatus` y `updatedAt` del vínculo, que ya salían en la
respuesta: los tipos de los frontends los declaran **no opcionales**, y sacarlos no rompería la
compilación de nadie —aparecería en runtime—.

## El estado de CA-9: la mitad que cierra y la que no

CA-9 pide que la `api` se quede **sin cliente de S3 ni credenciales**. Esta story cierra la mitad
que le corresponde y deja escrito lo que falta:

- ✅ **Ninguna ruta de lectura toca S3.** Los cinco caminos, `lib/utils/bus/` y
  `attachments-access.ts` no referencian `S3Client`, `getFileStream`, `getPresignedUrl` ni
  `headObject`.
- ✅ **El bloque `api` de `deploy/docker-compose.yml` no tiene `STORAGE_S3_*`** (ya cumplido por
  S-002; solo figuran bajo `core`).
- ⏳ **`lib/utils/storage-service.ts` NO se puede borrar todavía.** Lo siguen usando
  `attachments-post.ts` y `opus-attachments-post.ts`, que son de **S-004**. El archivo quedó
  anotado con un comentario que declara su alcance y qué falta para eliminarlo.
- ⏳ Las variables `STORAGE_S3_*` de `api/.env.dist` y `api/.env.test`, y las dependencias
  `@aws-sdk/*`, **se retiran en S-004**.

## Revisiones de ADR que esta story obliga

Cambia supuestos que estaban escritos como decisiones vigentes. Dejarlos sin actualizar sería peor
que no documentarlos:

- **ADR-001** — su regla *"un endpoint que lee NO DEBE pasar por el bus"* gana una **excepción
  declarada**: la lectura de archivos. Y su ventaja *"si core está caído el producto sigue siendo
  consultable"* **deja de valer para los adjuntos** (503 al vencer el timeout). Es la consecuencia
  aceptada de que el storage tenga un solo dueño. **La salida, si molesta, NO es devolverle
  credenciales a la `api`** sino subir la disponibilidad de `core`.
- **ADR-007** — el comando recibe un `fileId`, así que **quien pueda publicar en el bus puede pedir
  la URL de cualquier archivo del catálogo**. Mismo modelo de confianza, ahora sobre la lectura y
  con la superficie del catálogo entero. El `attachmentId` opcional se evaluó y **se descartó**;
  queda disponible como mitigación aditiva.
- **ADR-009** — con el 302 el navegador conoce el endpoint del bucket **en cada lectura**, no solo
  al subir. Sigue sin ser el token, y las URLs viajan **por respuesta de la api** (`Location`), no
  por `NEXT_PUBLIC_*`, que es lo que preserva la premisa central.

## Corrección de documentación: `canUserAccessEntity`

El flujo `lectura-de-archivos` declaraba que `/download` autorizaba con **`canUserAccessEntity`**.
**El código nunca lo hizo**: siempre usó `canUserViewEntity`, y S-005 lo mantiene deliberadamente.

`canUserAccessEntity` es la función de **adjuntar**, con reglas más finas sobre objetivos.
Aplicarla a la descarga **restringiría** el acceso de usuarios que hoy descargan sin problema: un
cambio observable que ningún CA pidió, en una story cuyo único cambio observable debía ser el 302.
No era una decisión pendiente sino documentación que afirmaba algo que el servicio no hacía.

## Tests

- **29 tests nuevos o reescritos**, y los tres archivos de rutas de lectura se reescribieron
  enteros: ya no hay stream que inspeccionar ni `storageService` que stubear con `sinon`. El doble
  correcto es el `fakeBus`, ya instalado globalmente.
- **El fixture cambió de forma:** primero la fila de `files`, después el `Attachment` con su
  `file_id`. Las columnas viejas se siguen poblando —son `allowNull: false` en el modelo
  compartido—, y esa duplicación es justo lo que permite probar que la lectura sale del `include`.
- **El test que importa es el de la divergencia:** con `attachments.file_name = 'VIEJO.txt'` y
  `files.file_name = 'informe.pdf'`, la respuesta trae `'informe.pdf'`. Es lo único que distingue
  "lee del `include`" de "lee de la columna vieja y casualmente coinciden".
- Las **cinco ramas de visibilidad** del endpoint público se prueban en su caso `public` **y** en su
  caso `internal`, más el `else` que deniega por default: es el deny-by-default de ADR-008 sobre la
  única puerta sin autenticación del producto.
- `file_not_available` y `file_not_found` se prueban **ejecutando `core` de verdad** (ADR-013): se
  arman con la fila, no con `reply()`.

> **Los 20 tests que fallan son de S-004, no de esta story.** Están en rutas de requisitos y
> comentarios que todavía mandan `attachmentIds` a `core`, que desde S-003 espera **`fileIds`** y
> los rechaza como campo desconocido. Fallan igual **antes** de S-005 (644 passing / 20 failing en
> la rama base; 673 / 20 después), y el changelog de S-003 ya los declara como el comportamiento
> esperado de este intervalo. Los cierra **S-004**, que es la dueña de migrar el contrato del lado
> de la `api`.

## Qué queda para las stories siguientes

- **S-004** — apagar los dos consumidores de subida de `storageService`, borrar el archivo, las
  dependencias `@aws-sdk/*` y las variables `STORAGE_S3_*` de los `.env`. Con eso CA-9 queda
  completo y la convención `storage` se elimina entera. Además, migrar `attachmentIds` → `fileIds`
  en las rutas de dominio, que es lo que devuelve la suite a verde.
- **S-006 / S-007** — los route handlers de `web` y `opus-web` dejan de proxear el binario y pasan a
  propagar la redirección. Recién ahí el flujo `lectura-de-archivos` pasa a `Active`.
- **S-008** — la URL pública del bucket tiene que ser alcanzable desde el navegador, o el 302 lleva
  a un host que el cliente no resuelve.
