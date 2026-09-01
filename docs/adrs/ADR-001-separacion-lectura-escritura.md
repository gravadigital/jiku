# ADR-001: Separación lectura/escritura por credenciales de base de datos

**Estado:** Aceptado (implementado)
**Fecha:** 2026-08-18 (documentado retroactivamente; la decisión es anterior)
**Deciders:** Equipo de desarrollo de Grava Digital
**Tags:** arquitectura, cqrs, base-de-datos, integridad
**Detectado desde:** `api`, `core`

---

## Contexto

El producto necesitaba una garantía de integridad de escritura que no dependiera de que cada
endpoint recordara aplicar las reglas de negocio. Con 61 endpoints HTTP organizados como un
archivo por ruta, la validación y los permisos se repiten entre archivos vecinos: es cuestión de
tiempo hasta que un endpoint nuevo escriba sin pasar por alguna regla.

La forma habitual de resolverlo es una capa de dominio o de servicios por la que toda escritura
tiene que pasar. El problema de esa forma es que **la disciplina es opcional**: nada impide que
alguien llame al ORM directo desde un handler, y en revisión de código eso se detecta a veces.

## Decisión

Separar lectura y escritura en dos servicios, y hacer que la separación **la imponga PostgreSQL
por permisos**, no una convención de código.

- La **`api`** conecta con un rol de base de datos **sin `INSERT`/`UPDATE`/`DELETE`**. Lee
  cualquier tabla y no puede escribir ninguna, aunque el código lo intente.
- **`core`** conecta con el **usuario dueño** de la base y es el único que escribe.
- Toda mutación viaja de la api a core como comando por el bus (ver [ADR-002](ADR-002-comandos-nats-sin-jetstream.md)).

Implementado en:
- `api/lib/models/index.ts:19-31` — conexión de solo lectura
- `core/src/models/index.ts:11-16` — conexión con el usuario dueño
- `api/db-upgrade/config.js:10-14` — las migraciones usan un tercer usuario
  (`POSTGRESQL_MIGRATION_USER`) con permisos de DDL

### Excepciones vigentes

Tres, y las tres son deliberadas o deuda reconocida:

1. **Las migraciones** corren al arrancar la api con credenciales propias. Es intencional: la api
   es la dueña del esquema.
2. **La fila de `attachments`** (`attachments-post.ts:105-118`) se escribe directo con el ORM.
3. **`PUT /api/week-assigned-times`** (`week-assigned-times-put.ts:39-78`) borra y recrea la
   semana con el ORM en una transacción.

Las excepciones 2 y 3 son **deuda**: escriben con las credenciales de solo lectura y funcionan
porque el rol de la instalación se lo permite. Son las únicas escrituras de dominio que no pasan
por core.

> **Excepción cerrada por REQ-011 (2026-09-01): una cuarta, no declarada.**
> `PATCH /api/objectives/{id}/comment/{cid}` escribía con `ObjectiveActivity.update(...)` directo,
> sin publicar comando, y la propia `api.yaml` lo documentaba así ("No pasa por el bus") sin que
> esta sección la enumerara — ni `NFR-S09` (`docs/prd/requirements.md`), que solo contaba dos.
> REQ-011 migró ese endpoint a publicar `tasks.{id}.comment.{cid}.edit`, cerrando la excepción en
> vez de duplicarla al agregar la edición de comentarios de requisito. Las excepciones vigentes
> vuelven a ser las tres de arriba.

## Implementation Rules

- Toda escritura de dominio nueva **DEBE** implementarse como comando en `core`. **NO SE DEBE**
  agregar escritura con el ORM en `api`.
- La conexión de `api` **DEBE** usar credenciales sin `INSERT`/`UPDATE`/`DELETE`. Si un endpoint
  nuevo requiere escribir, la respuesta correcta es un comando, no ampliar los permisos del rol.
- La conexión de `core` **DEBE** usar el usuario dueño de la base.
- Las migraciones **DEBEN** correr desde `api` con `POSTGRESQL_MIGRATION_USER`, nunca desde `core`.
- Después de publicar un comando de creación, la api **DEBE** releer la base para armar la
  respuesta: core devuelve solo `{ id }` y el contrato con los frontends es el recurso completo
  con sus relaciones.
- Un endpoint que lee **NO DEBE** pasar por el bus: la lectura va directo a PostgreSQL desde la api.
  **Excepción declarada desde REQ-001 (S-005): la lectura de archivos.** Los cinco caminos de
  lectura de adjuntos publican `files.{fileId}.request-download` para obtener la URL prefirmada,
  porque el storage tiene un solo dueño y es `core`. Ver "Revisión: la lectura de archivos".

## Consecuencias

### Positivas

- **La garantía es de infraestructura, no de disciplina.** Un intento de escritura desde la api
  falla con un error de permisos de PostgreSQL, no pasa desapercibido en revisión de código.
- **Un único lugar donde auditar las reglas de escritura.** Los 17 comandos de core son la lista
  completa de formas en que los datos pueden cambiar.
- **Las lecturas escalan independientemente del bus.** Si core está caído, el producto sigue
  siendo consultable: solo se pierde la escritura. **Desde REQ-001 esto ya NO vale para los
  adjuntos** — ver "Revisión: la lectura de archivos".
- **Las réplicas de core se reparten la carga** por queue group sin coordinación adicional.

### Negativas

- **Toda escritura cuesta dos saltos y una relectura.** Publicar el comando, esperar la respuesta,
  y volver a leer la base para armar el recurso completo.
- **La lógica de un mismo caso de uso vive en dos servicios.** Las reglas que dependen del rol,
  del usuario final o del calendario están en la api (ventana de carga de horas, quién imputa a
  otra persona, semanas pasadas); las que no, en core. Entender una feature completa exige leer
  los dos.
- **Duplicación de validación.** Algunas reglas se validan en ambos lados, con esquemas Joi
  separados que pueden divergir.
- **Dos excepciones vivas** que contradicen la regla y funcionan por permisos permisivos de la
  instalación.

### Riesgos

- **Riesgo:** las excepciones 2 y 3 se normalizan y aparecen más escrituras desde la api.
  - **Mitigación:** están registradas como deuda en `requirements.md` (NFR-S09) y en el feature
    group FG-6. Cualquier escritura nueva desde la api debe rechazarse en revisión.
- **Riesgo:** el rol de solo lectura se configura mal en una instalación nueva y la garantía
  desaparece en silencio.
  - **Mitigación:** ninguna hoy. Un test de arranque que verifique que la api **no puede**
    escribir sería la verificación correcta.

## Revisión: la lectura de archivos (REQ-001 / S-005, 2026-08-19)

**La decisión de este ADR no cambia.** Lo que cambia es el alcance de dos de sus afirmaciones, y
conviene dejarlo escrito antes que dejarlo implícito: la próxima persona que lea este documento
tiene que encontrar acá lo que el código ya hace.

### La regla "un endpoint que lee no pasa por el bus" tiene una excepción

Con REQ-001 el storage pasa a tener **un solo dueño**: `core`. La `api` pierde el cliente de S3 y
sus credenciales, así que ya no puede leer un objeto del bucket por su cuenta. En consecuencia, los
**cinco caminos de lectura de archivos** publican un comando:

| Camino | Endpoint |
|---|---|
| A | `GET /api/attachments/{id}/preview` |
| B | `GET /api/attachments/{id}/download` |
| C | `GET /api/opus/attachments/{id}/preview` |
| D | `GET /api/opus/attachments/{id}/public` (deprecado) |
| E | `GET /api/files/{id}/preview` (archivo sin vínculo) |

Los cinco autorizan primero —la autorización sigue siendo de la `api`—, resuelven el `file_id` y
recién entonces publican `files.{fileId}.request-download`. `core` firma la URL prefirmada y la
`api` responde **302**. **La `api` no mueve un solo byte.**

Es la misma garantía que este ADR logró para la escritura, aplicada al storage: **por
credenciales, no por convención**. Una superficie entera de acceso desaparece del servicio expuesto
a internet.

### "Si core está caído el producto sigue siendo consultable" deja de valer para los adjuntos

Esta es la consecuencia negativa real y **está aceptada, no pasada por alto**. Con `core` o el bus
caídos, los cinco caminos responden **503** al vencer el timeout de 5000 ms (ADR-002), y sin
JetStream no hay reintento. El caso más visible es un link público en el correo de un cliente: no
abre, y del otro lado no hay diagnóstico posible.

**Mitigación: ninguna dentro de este diseño.** Es el precio aceptado de que el único control del
storage sea `core`.

> **Si más adelante molesta, la salida NO es devolverle credenciales de S3 a la `api`** —eso
> deshace la garantía completa— **sino subir la disponibilidad de `core`**, que ya se reparte por
> queue group sin coordinación adicional.

El resto del producto (proyectos, requisitos, horas, reportes) **sigue siendo consultable con
`core` caído**: la excepción es exclusivamente la lectura de archivos.

## Alternativas Consideradas

### Alternativa 1: Capa de servicios/dominio dentro de la misma api

**Pros:**
- Un solo servicio, un solo despliegue, sin bus
- Sin latencia de red en la escritura ni relectura

**Cons:**
- La disciplina es opcional: nada impide llamar al ORM desde un handler
- Sin frontera física, la capa se erosiona con el tiempo

**Por qué se descartó:** no da la garantía buscada. El objetivo explícito era que la separación
fuera imposible de saltear, no solo desaconsejada.

---

### Alternativa 2: Un solo servicio con transacciones explícitas por endpoint

**Pros:**
- La forma más simple y directa
- Sin problemas de disponibilidad del bus

**Cons:**
- Cada endpoint tiene que acordarse de abrir la transacción y de hacer rollback en cada rama de
  error
- Es exactamente el modo de fallo que [ADR-003](ADR-003-transaccion-del-despachador.md) elimina

**Por qué se descartó:** el producto ya había tenido escrituras a medias por rollbacks olvidados.

---

### Alternativa 3: Microservicios con base de datos por servicio

**Pros:**
- Aislamiento real de datos, despliegue independiente

**Cons:**
- El dominio está muy entrelazado: horas → tarea → requisito → proyecto → actor. Partirlo exigiría
  transacciones distribuidas o consistencia eventual entre entidades que se consultan juntas todo
  el tiempo
- Los reportes jerárquicos de 4 niveles se volverían agregaciones cross-service

**Por qué se descartó:** desproporcionado para un producto interno con un equipo. El costo de
coordinación superaba ampliamente el beneficio.

## Referencias

- Arquitectura: [`docs/prd/architecture.md`](../prd/architecture.md)
- Servicios: [`docs/architectures/api/`](../architectures/api/), [`docs/architectures/core/`](../architectures/core/)
- Esquema: [`docs/db-schemas/jiku.md`](../db-schemas/jiku.md)
- ADRs relacionados: [ADR-002](ADR-002-comandos-nats-sin-jetstream.md), [ADR-003](ADR-003-transaccion-del-despachador.md), [ADR-005](ADR-005-modelos-compartidos.md)
