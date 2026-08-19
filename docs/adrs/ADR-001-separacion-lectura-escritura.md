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

## Consecuencias

### Positivas

- **La garantía es de infraestructura, no de disciplina.** Un intento de escritura desde la api
  falla con un error de permisos de PostgreSQL, no pasa desapercibido en revisión de código.
- **Un único lugar donde auditar las reglas de escritura.** Los 17 comandos de core son la lista
  completa de formas en que los datos pueden cambiar.
- **Las lecturas escalan independientemente del bus.** Si core está caído, el producto sigue
  siendo consultable: solo se pierde la escritura.
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
