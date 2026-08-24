---
created: 2026-08-18
last_updated: 2026-08-18
status: Draft - Importado desde código existente
---

# Requerimientos

> Documento generado por `/product-consolidate-services` desde el código de los cuatro servicios.
> **Todo lo listado acá está implementado**, salvo lo marcado explícitamente. Cada regla de
> negocio indica **dónde se valida**, porque en este producto eso importa: una regla que solo
> vive en el frontend no es una regla del producto.
>
> Convención de la columna "Se valida en":
> - `api` — regla autoritativa, en la única puerta HTTP
> - `core` — regla autoritativa, en el único escritor
> - `web` / `opus-web` — **solo UI**: no hay defensa del lado del servidor
> - `base` — constraint de PostgreSQL

## Entidades del Dominio

### Actor (`clients` en la base y en el bus)
- **Atributos clave:** `name` (string, req), `description` (text, opt, markdown)
- **Relaciones:** has_many Proyecto
- **Notas:** El estado activo/inactivo **no se almacena**: `web` lo deriva de si el actor tiene
  algún proyecto en `activo` o `analisis`. No hay borrado de actores.

### Persona (`people`)
- **Atributos clave:** `firstName` (string, req), `lastName` (string, req), `enabled` (bool, req,
  default true), `initDate` (timestamp, req), `endDate` (timestamp, opt),
  `mustChargeWorkedTime` (bool, req, default true)
- **Relaciones:** belongs_to Usuario (opt), has_many HoraTrabajada, has_many Ausencia,
  has_many AsignacionSemanal, many_to_many Proyecto, many_to_many Tarea (con `isLeader`,
  `active`), many_to_many Requisito (con `isLeader`)
- **Notas:** Es distinta de Usuario: **una persona puede no tener usuario**, y las horas se
  imputan a la persona, no al usuario. `mustChargeWorkedTime` decide si aparece en la grilla de
  asignación semanal y en los reportes de carga. **El producto no da de alta personas** por
  ninguna interfaz.

### Usuario (`users`)
- **Atributos clave:** `id` (string, PK — es el `sub` de Zitadel), `name`, `username`, `email`,
  `roles` (lista de strings, req, default `[]` — REQ-005), `identityType`
  (enum: person/service, req, default `person` — REQ-005)
- **Relaciones:** has_one Persona (opt), has_many PermisoDeProyecto
- **Notas:** Espejo del proveedor de identidad. **Desde REQ-005 el producto SÍ la escribe**, pero
  solo por un camino: `core` consume el evento `{instance}.events.auth` que emite el auth-callout
  en cada autenticación del bus, y crea o actualiza la fila espejando `name`, `username`, `email`,
  `roles` e `identityType`. El alta es automática y sin aprobación. **La limitación subsiste para
  quien nunca conecta al bus:** una persona que solo usa `web` u `opus-web` autentica por HTTP
  contra la api, no dispara el callout, y sigue recibiendo 401 `user_not_found` en todas las
  rutas — su alta queda pendiente de FG-1.
  - `roles` guarda el array del token **tal cual viene**, sin filtrar ni validar. Puede contener
    roles de producto (`admin`, `user`, `external-user`) y roles de bus (`internal-app`, `core`,
    `external-publisher`, `bus-observer`), o estar vacío.
  - **Dos planos de autorización sobre la misma entidad.** La autorización HTTP sigue saliendo del
    claim del token que la api valida contra Zitadel (no consulta esta columna). La autorización de
    los callers del bus distintos de la api —conectores externos y personas que llamen a `core` por
    NATS— se resuelve con `Usuario.roles` persistido: sin fila no hay roles, y sin roles no hay
    autorización.
  - `identityType` distingue a las personas de los service users, que a partir de REQ-005 también
    tienen fila. Una fila con `identityType: "service"` **no tiene Persona vinculada y no
    representa a nadie del equipo**: todo listado o selector que asuma que un Usuario es una
    persona tiene que filtrarla.
  - La entrega del evento **no es durable** (NATS sin JetStream): un evento perdido no se reintenta
    ni se reconcilia, y la fila se corrige en la próxima autenticación de esa identidad.
  - **Desde REQ-006 `roles` es el control de acceso efectivo de toda la superficie de lectura del
    bus**, y deja de ser un dato solo informativo del espejo de identidad. De la columna sale una
    **clase de caller** con tres valores —`internal-app` → **conector**, `user` → **interno**,
    `external-user` → **externo**—, y con varios roles **gana el más restrictivo**
    (`external-user` → `user` → `internal-app`). La clase se resuelve **una sola vez, en el
    despachador de consultas**, y viaja en el contexto de la consulta: ningún módulo de recurso
    vuelve a resolverla.
  - Una identidad **sin fila, con `roles` vacío o con roles desconocidos** no puede leer nada por
    el bus: la respuesta es `unknown_caller`, **nunca una colección vacía**. **Sin excepciones por
    identidad**, incluido el service user de la api. Como la fila la crea un evento de entrega no
    durable, la disponibilidad de la lectura por el bus **queda acoplada a la sincronización de
    `users`**.

### Proyecto (`projects`)
- **Atributos clave:** `code` (string), `name` (string), `type` (enum: interno/comercial/
  investigacion/propuesta, req), `description` (text), `status` (enum: analisis/activo/inactivo/
  finalizado/cancelado, req), `initDate` (timestamp, req), `endDate` (timestamp, opt),
  `priority` (int, default 0), `keyValuePairs` (json, opt), `ticketSlug` (string, opt, UNIQUE)
- **Relaciones:** belongs_to Actor (opt), belongs_to Usuario (creador), many_to_many Persona,
  has_many Requisito, has_many Tarea, has_many AsignacionSemanal
- **Notas:** `keyValuePairs` guarda cuatro claves conocidas — `documentacion`, `diseño`,
  `board_de_tareas` (validadas como URI) y `mattermost_group_name` — más propiedades dinámicas.
  En el bus este campo se llama `properties` y viaja como lista `{code, value}`.
  `type === 'interno'` deriva `AsignacionSemanal.internal`.
  `ticketSlug` **no se expone ni se acepta como filtro en el contrato de consultas del bus**
  (REQ-006): la columna está marcada para eliminarse (FG-6) y el contrato nace sin ella para que
  el saneamiento no tenga que romper un contrato recién publicado.

### Requisito (`requirements`)
- **Atributos clave:** `title` (string 255, req), `description` (text, req), `type` (enum:
  funcionalidad/mejora/incidencia/otro, opt), `priority` (enum: sin_prioridad/baja/media/alta/
  urgente, req, default sin_prioridad), `state` (enum: analisis/planificacion/en_cola/desarrollo/
  revision/resuelto/cancelado, req, default analisis), `estimatedFinishDate` (date, opt),
  `tags` (jsonb `[{key, value}]`, opt), `visibilityLevel` (enum: public/internal, req, default
  public), `scope` (text, opt), `technicalSolution` (text, opt), `acceptanceCriteria` (text, opt),
  `resolutionType` (enum: error_interno/fuera_de_alcance/error_externo/discutible/otro, opt),
  `resolutionConclusion` (text, opt), `resolutionComment` (text, opt)
- **Relaciones:** belongs_to Proyecto (req), belongs_to Usuario (creador), many_to_many Persona
  (con `isLeader`), has_many ActividadDeRequisito, has_many Suscriptor, has_many HoraTrabajada
- **Notas:** Cuatro marcas temporales (`scheduledAt`, `inProgressAt`, `inReviewAt`, `finishedAt`)
  las mantiene un hook `@BeforeUpdate` del modelo. Los tags se consultan con contains de `jsonb`.
  Es la **única entidad que un cliente externo puede crear**. `visibilityLevel: 'public'` significa
  **"visible para usuarios externos autenticados"** y nada más: desde REQ-002 no habilita acceso
  anónimo a los adjuntos de la entidad. Desde REQ-006 ese significado gana un **segundo punto de
  aplicación**: el recorte del modo externo del servicio de consultas exige
  `visibilityLevel = 'public'` **además** del permiso de proyecto, y lo aplica **antes** del filtro
  del caller.

### Tarea (`objectives` en la base, `task` en el bus)
- **Atributos clave:** `title` (string, req), `description` (text, opt), `estimatedFinishDate`
  (**varchar, no date**, opt), `state` (enum: backlog/activo/en_revision/finalizado/cancelado,
  req, default backlog), `area` (enum: diseño/desarrollo/gestion/investigacion, req),
  `priority` (**int 0-5**, req), `visibilityLevel` (enum: public/internal, req, default public)
- **Relaciones:** belongs_to Proyecto (req), belongs_to Requisito (opt, **sin constraint**),
  belongs_to Usuario (creador), many_to_many Persona (con `isLeader`, `active`),
  has_many ActividadDeTarea, has_many HoraTrabajada
- **Notas:** `finishedAt` lo mantiene un hook al entrar y salir de `finalizado`. `priority` es
  entero en la base y enum de nombres en el bus: la api traduce en ambos sentidos y core usa un
  escape transitorio (`priorityValue`) para no perder el valor 5. Desde REQ-006 ese escape **se
  formaliza en el contrato de lectura del bus**: la consulta devuelve `priority` como nombre de
  enum **y** `priorityValue` con el entero crudo, y acepta filtrar por las dos formas — deja de ser
  un escape y pasa a ser parte del contrato. `visibilityLevel: 'public'` significa
  **"visible para usuarios externos autenticados"**: desde REQ-002 no habilita acceso anónimo a
  los adjuntos de la tarea, y desde REQ-006 el recorte del modo externo de las consultas lo exige
  además del permiso de proyecto.

### HoraTrabajada (`worked_times`)
- **Atributos clave:** `date` (timestamp), `minutes` (int)
- **Relaciones:** belongs_to Proyecto, belongs_to Persona, belongs_to Tarea (opt),
  belongs_to Requisito (opt)
- **Notas:** `objectiveId` y `requirementId` son **mutuamente excluyentes** — una hora se imputa
  a una tarea **o** a un requisito, nunca a ambos. La exclusión **no tiene constraint en la
  base**: la validan la api (Joi `.oxor`) y core.

### Ausencia (`unworked_times`)
- **Atributos clave:** `date` (date, req), `minutes` (int, req), `reason` (enum: tramite/
  corte_servicios/vacaciones/dia_no_laborable/personal/medico/estudio/enfermedad/otro, req)
- **Relaciones:** belongs_to Persona
- **Notas:** Comparte el tope diario de 1440 minutos con HoraTrabajada: la suma de ambas por
  persona y día no puede superarlo.

### AsignacionSemanal (`week_assigned_times`)
- **Atributos clave:** `dateFrom` (timestamp, lunes), `dateTo` (timestamp, lunes + 4),
  `internal` (bool, derivado de `Proyecto.type === 'interno'`), `minutes` (int)
- **Relaciones:** belongs_to Proyecto, belongs_to Persona
- **Notas:** Es la única entidad que se **reemplaza por semana completa** (borrar + recrear en
  una transacción). Las asignaciones con `minutes: 0` se descartan.

### Actividad (`objective_activity` / `requirement_activity`)
- **Atributos clave:** `typeOfActivity` (enum, req), `previousValue` (text, req), `newValue`
  (text, req), `visibilityLevel` (enum: public/internal, req, default internal)
- **Relaciones:** belongs_to Tarea **o** Requisito, belongs_to Usuario (autor)
- **Notas:** Un mismo registro sirve para **cambios de campo y comentarios**: un comentario es
  una actividad con `typeOfActivity: 'comment'`. Es lo que permite el feed cronológico unificado.
  La visibilidad de los cambios de campo **la decide el sistema, no el usuario**.
  `visibilityLevel: 'public'` significa **"visible para usuarios externos autenticados"**: desde
  REQ-002 no habilita acceso anónimo a los adjuntos del comentario, y desde REQ-006 el recorte del
  modo externo del servicio de consultas lo exige además del permiso de proyecto.

### Suscriptor (`requirement_subscriptors` / `objectives_subscriptors`)
- **Atributos clave:** `userId` (string, req)
- **Relaciones:** belongs_to Requisito **o** Tarea, belongs_to Usuario
- **Notas:** **Registra interés y nada más: no hay canal de notificación en el producto.**
  Sin unique compuesto en la base; `already_subscribed` lo valida core.

### PermisoDeProyecto (`user_project_permissions`)
- **Atributos clave:** `userId` (string, req), `projectId` (int)
- **Relaciones:** belongs_to Usuario, belongs_to Proyecto
- **Notas:** **La tabla que sostiene todo el aislamiento del portal de clientes.** Un
  `external-user` solo ve los proyectos con una fila acá. **No se administra desde ninguna
  interfaz del producto:** se inserta a mano. **Desde REQ-006 gana un segundo punto de
  aplicación:** hasta ahora el aislamiento lo aplicaba la api con `validateProjectPermissions`
  antes de leer Postgres; el servicio de consultas la consulta por su cuenta para recortar a los
  callers en modo externo, **antes** del filtro del caller y sin forma de desactivarlo por
  payload.

### Archivo (`files`)
- **Atributos clave:** `fileName` (string 255, req — el nombre original, **no** es la clave),
  `fileSize` (int, req), `mimeType` (string 100, req), `storageKey` (string 500, req, UNIQUE — la
  construye `core`, **no** depende de la entidad), `storageBucket` (string 100, req),
  `storageRegion` (string 50, req), `checksum` (sha256, opt — declarado por el cliente y **no
  verificado**), `byteStatus` (enum: pending/uploaded, req, default pending), `uploadedBy`
  (string 100, req), `retentionStatus` (enum: active/scheduled_for_deletion/deleted, req,
  default active)
- **Relaciones:** has_many Adjunto (**0..N** — un archivo puede no estar vinculado a nada).
  belongs_to Usuario (`uploadedBy`)
- **Notas:** **La identidad del archivo, independiente de a qué se vincule.** Un archivo sin
  vínculo es un estado válido, no una anomalía. Es la entidad contra la cual se valida la
  **titularidad**: solo quien subió un archivo puede vincularlo, sin excepción por rol.
  `byteStatus` registra si el byte llegó al storage; **nadie lo verifica** — el error aparece al
  descargar, no al vincular. Los archivos con `byteStatus: pending` abandonados son
  **identificables pero no se limpian**: el barrido quedó fuera de alcance (REQ-001).
  **El acceso a un archivo exige sesión en todos los casos** (REQ-002): eliminado el endpoint
  público, no queda ninguna vía anónima y la visibilidad de la entidad vinculada ya no habilita
  acceso sin autenticar. **Desde REQ-006 los tres atributos de ubicación física (`storageKey`,
  `storageBucket`, `storageRegion`) son explícitamente no exponibles** en el contrato de lectura
  del bus, que además **no mintea URLs**: obtener los bytes sigue siendo el comando
  `files.{fileId}.request-download`. `checksum` se expone solo bajo pedido (`include`) y con la
  advertencia de que nadie lo verifica.

### Adjunto (`attachments`)
- **Atributos clave:** `entityType` (string, req), `entityId` (int, **req**), `fileId` (int, req)
- **Relaciones:** vinculación **polimórfica** por `(entityType, entityId)` — sin FK.
  belongs_to Archivo (`fileId`, **FK real**)
- **Notas:** **Es solo el vínculo archivo ↔ entidad.** Los atributos del archivo viven en
  Archivo. `entityId` es NOT NULL: el vínculo se crea cuando la entidad ya existe, y por eso
  **no hay tipos de entidad borrador** (`*_draft` desaparecieron). Desvincular es **borrar el
  Adjunto**; el archivo se retiene, porque con 0..N vínculos marcarlo rompería los otros. Los
  `id` **ya no son contrato externo** (REQ-002): al eliminarse el endpoint público desapareció la
  única razón por la que D-06 los preservaba, y esa restricción **queda derogada**. No se
  renumeran ni cambia la PK, pero dejan de condicionar el saneamiento del modelo (FG-6). La FK
  polimórfica hacia la entidad **sigue siendo imposible**: apunta a cinco tablas distintas.

### AjusteDelSistema (`system_settings`)
- **Atributos clave:** `key` (string 255, UNIQUE), `value` (**text**)
- **Notas:** Se lee en caliente y **se cambia por SQL**: no hay interfaz de escritura. Usos:
  `hours-per-day` (semáforo de carga de horas) y los cinco parámetros de subida de archivos —
  `upload-url-ttl-seconds`, `download-url-ttl-seconds`, `file-max-size-bytes`,
  `file-allowed-extensions`, `file-allowed-mime-types`. **Cada clave tiene un default en el
  código**, así que el sistema funciona sin valor cargado. `value` es `TEXT` y no
  `VARCHAR(255)` porque la lista de tipos MIME permitidos no entra en 255 caracteres.
  **Desde REQ-006 la entidad deja de ser opaca para los consumidores:** `settings.list` la expone
  en lectura por el bus, pero **solo por lista blanca de claves** (`hours-per-day` y las cinco de
  archivos). Una clave no declarada **no existe** para esa API, aunque exista en la tabla. La
  escritura sigue siendo solo por SQL.

---

## Features Principales

### F-01: Gestión de Actores

**Descripción:** Un actor es la organización o contraparte para la que se trabaja. Es la raíz de
la jerarquía: los proyectos cuelgan de un actor y los permisos del portal se derivan de ahí.

**Historia de Usuario:**
Como miembro del equipo,
quiero registrar y consultar los actores con su cartera de proyectos,
para saber para quién estamos trabajando y en qué estado está cada relación.

**Capacidades:**

| ID | Capacidad | Actor | Entidad | Operación | Campos clave | Reglas de negocio | Se valida en |
|---|---|---|---|---|---|---|---|
| C-01 | Listar actores con sus proyectos | U-01, U-02 | Actor | READ | filtros: búsqueda (string), estado (activo/inactivo), orden (5 criterios) | Los filtros se reflejan en la URL. Paginación por "Ver más" calculada según el alto disponible | api (datos) · web (filtros) |
| C-02 | Derivar el estado del actor | U-01, U-02 | Actor | READ | — | Un actor está `activo` si tiene **algún** proyecto en `activo` o `analisis`; si no, `inactivo`. **No se almacena** | **web (solo UI)** |
| C-03 | Crear actor | U-01, U-02 | Actor | CREATE | `name` (string, req), `description` (text, opt, markdown) | Se ejecuta vía comando `clients.new` | api → core |
| C-04 | Editar actor | U-01, U-02 | Actor | UPDATE | `name` (opt), `description` (opt) | Semántica de edición parcial: ausente = no se toca · valor = reemplaza · `null` = vacía | core |
| C-05 | Ver detalle del actor con sus proyectos | U-01, U-02 | Actor | READ | — | La descripción se renderiza como markdown | api |

**Criterios de Aceptación:**
- DADO un actor "Cliente Norte" con un proyecto en `finalizado` y otro en `analisis`,
  CUANDO se lista en la pantalla de actores,
  ENTONCES se muestra como **activo** (porque `analisis` cuenta).
- DADO un actor sin ningún proyecto,
  CUANDO se lista,
  ENTONCES se muestra como **inactivo**.
- DADO un `PATCH` de actor que envía solo `name`,
  CUANDO core lo procesa,
  ENTONCES `description` conserva su valor anterior.

**Prioridad:** Alta · **Dependencias:** Ninguna

---

### F-02: Gestión de Proyectos

**Descripción:** El proyecto es la unidad de trabajo y de permiso. Todo —requisitos, tareas,
horas y asignación— cuelga de un proyecto, y es la entidad sobre la que se concede acceso a un
cliente externo.

**Historia de Usuario:**
Como miembro del equipo,
quiero gestionar los proyectos con sus personas, propiedades y enlaces a herramientas externas,
para tener un índice único de dónde está todo lo de cada trabajo.

**Capacidades:**

| ID | Capacidad | Actor | Entidad | Operación | Campos clave | Reglas de negocio | Se valida en |
|---|---|---|---|---|---|---|---|
| C-06 | Listar proyectos | U-01, U-02 | Proyecto | READ | filtros: búsqueda, tipo, estado, orden | Grilla de cards | api · web |
| C-07 | Crear proyecto | U-01, U-02 | Proyecto | CREATE | `name` (req), `type` (enum, req), `status` (enum, req), `initDate` (req), `endDate` (opt), `clientId` (opt), `description` (opt), `properties` (lista `{code,value}`) | El actor, si viene, debe existir (`client_not_found`). `documentacion`, `diseño` y `board_de_tareas` se validan como URI | api (URI) · core (actor) |
| C-08 | Editar proyecto | U-01, U-02 | Proyecto | UPDATE | todos opcionales | **Un campo ausente no se toca.** Corrige un bug previo de la api, que vaciaba `endDate` al no enviarla | core |
| C-09 | Gestionar propiedades extensibles | U-01, U-02 | Proyecto | UPDATE | `properties`: 3 claves fijas + dinámicas que el usuario agrega y borra | El contrato del bus las llama `properties` (lista); la base las guarda como `key_value_pairs` (objeto) | core (traducción) |
| C-10 | Ver detalle del proyecto | U-01, U-02 | Proyecto | READ | — | Dos columnas: descripción + secciones de requisitos y tareas (tabs por estado, paginación, contadores) e info general, propiedades y adjuntos | api · web |
| C-11 | Asignar personas al proyecto | U-01, U-02 | Proyecto | UPDATE | `personIds` (int[]) | — | core |
| C-12 | Consultar resumen de tareas por proyecto | U-01, U-02 | Proyecto | READ | — | `GET /projects/objectives-summary` | api |

**Criterios de Aceptación:**
- DADO un proyecto con `endDate: 2026-12-31`,
  CUANDO se edita enviando solo `name`,
  ENTONCES `endDate` sigue siendo `2026-12-31`.
- DADO un proyecto con `type: 'interno'`,
  CUANDO se le asigna capacidad semanal,
  ENTONCES la asignación se marca con `internal: true`.
- DADO un `properties` con clave `documentacion` y valor `"no-es-una-url"`,
  CUANDO se crea el proyecto,
  ENTONCES la api rechaza con error de validación.

**Prioridad:** Alta · **Dependencias:** F-01

---

### F-03: Gestión de Requisitos

**Descripción:** El requisito es lo que pide el cliente. Es la entidad central del producto: la
única que cruza las dos superficies (equipo y cliente), la que tiene workflow explícito, y contra
la que se pueden imputar horas directamente.

**Historia de Usuario:**
Como miembro del equipo,
quiero registrar cada pedido como un requisito con estado, tipo, prioridad y responsables,
para que el pedido tenga trazabilidad desde que entra hasta que se cierra.

**Capacidades:**

| ID | Capacidad | Actor | Entidad | Operación | Campos clave | Reglas de negocio | Se valida en |
|---|---|---|---|---|---|---|---|
| C-13 | Listar requisitos | U-01, U-02 | Requisito | READ | paginación 15/20/25, filtros y orden | Tooltip de responsables múltiples | api · web |
| C-14 | Crear requisito | U-01, U-02 | Requisito | CREATE | `title` (req), `description` (req), `projectId` (req), `type` (opt), `priority` (opt, default `sin_prioridad`), `responsiblePersonIds` (opt), `tags` (opt) | Nace en `analisis`. **El primero de `responsiblePersonIds` queda como líder: el orden es información** | core |
| C-15 | Avanzar el workflow de estados | U-01, U-02 | Requisito | ACTION | `state` (enum, 7 valores) | Secuencia: `analisis → planificacion → en_cola → desarrollo → revision`. **Una `incidencia` saltea `en_cola`** | **web (solo UI)** — ver NFR-S07 |
| C-16 | Editar campos de estado en acordeón | U-01, U-02 | Requisito | UPDATE | `scope`, `technicalSolution`, `acceptanceCriteria`, `estimatedFinishDate` | Los campos se abren según el estado: `analisis`→alcance, `planificacion`→propuesta y criterios, `en_cola`→cierre estimado | web (solo UI) |
| C-17 | Resolver o cancelar un requisito | U-01, U-02 | Requisito | ACTION | `state` (`resuelto`/`cancelado`), `resolutionType` (opt), `resolutionConclusion` (opt) | **Es un comando propio (`requirements.{id}.resolve`)**, no parte del edit: la transición no puede ocurrir por accidente. **Una incidencia no se resuelve sin tipo y conclusión** | api (tipo+conclusión) · core (conclusión) |
| C-18 | Etiquetar con clave:valor | U-01, U-02 | Requisito | UPDATE | `tags` (lista `{key,value}`) | Sugerencias desde `GET /requirements/tags/suggestions`, consultadas con contains de `jsonb` | api |
| C-19 | Comentar un requisito | U-01, U-02, U-03 | Actividad | CREATE | `comment` (text, req), `visibilityLevel` (enum, opt) | **Solo los comentarios permiten elegir visibilidad.** Desde el portal se crean siempre `public` | core · opus-web (fuerza public) |
| C-20 | Ver el feed de actividad | U-01, U-02, U-03 | Actividad | READ | — | Mezcla comentarios y cambios de campo en orden cronológico. **U-03 solo ve los `public`** | api (filtro) |
| C-21 | Registrar cambios automáticamente | sistema | Actividad | CREATE | — | Lo calcula el hook `@BeforeUpdate` del modelo. **Visibilidad automática:** `state`, `title` y `description` → `public`; el resto → `internal` | api · core |
| C-22 | Suscribirse a un requisito | U-03 | Suscriptor | CREATE | `userId` | **No dispara ninguna notificación: no hay canal.** `already_subscribed` si ya existe | core |
| C-23 | Desuscribirse | U-03 | Suscriptor | DELETE | `userId` | — | core |
| C-24 | Reportar requisitos con export | U-01, U-02 | Requisito | READ | filtros | `GET /requirements/report` + export **CSV generado en el cliente** | api · web |

**Criterios de Aceptación:**
- DADO un requisito de tipo `incidencia` en estado `planificacion`,
  CUANDO se avanza el stepper,
  ENTONCES pasa a `desarrollo` (saltea `en_cola`).
- DADO un requisito de tipo `incidencia` sin `resolutionConclusion`,
  CUANDO se intenta resolver,
  ENTONCES falla con `resolution_required` y **no se escribe nada** (rollback del despachador).
- DADO un requisito creado con `responsiblePersonIds: [7, 3, 9]`,
  CUANDO se guarda,
  ENTONCES la persona 7 queda marcada como líder.
- DADO un cambio de `priority` de `baja` a `alta`,
  CUANDO se registra la actividad,
  ENTONCES queda con `visibilityLevel: 'internal'` y el cliente **no la ve** en el portal.
- DADO un cambio de `state`,
  ENTONCES queda `public` y **sí** aparece en el portal.

**Prioridad:** Alta · **Dependencias:** F-02

---

### F-04: Gestión de Tareas

**Descripción:** La tarea es la unidad de ejecución del equipo. Descompone el requisito en
trabajo concreto con área, responsables y estimación, y es el destino más frecuente de las horas
imputadas.

**Historia de Usuario:**
Como miembro del equipo,
quiero descomponer el trabajo en tareas con área y responsables,
para saber quién hace qué y poder imputar el tiempo contra algo concreto.

**Capacidades:**

| ID | Capacidad | Actor | Entidad | Operación | Campos clave | Reglas de negocio | Se valida en |
|---|---|---|---|---|---|---|---|
| C-25 | Listar tareas con filtros | U-01, U-02 | Tarea | READ | 7 filtros: búsqueda, estado (múltiple), proyecto, responsable, área, orden | Tabla paginada | api · web |
| C-26 | Crear varias tareas en un submit | U-01, U-02 | Tarea | CREATE | `title` (req), `area` (enum, req), `projectId` (req), `priority` (int 0-5), `requirementId` (opt), `responsiblePersonIds` (opt), `estimatedFinishDate` (opt) | El formulario se clona y se borra para crear varias. **Si viene `requirementId`, el requisito debe pertenecer al proyecto** (`requirement_project_mismatch`) | core |
| C-27 | Editar tarea | U-01, U-02 | Tarea | UPDATE | todos opcionales | Reemplazo total de responsables: **`tasks` preserva el `createdAt`** de las asignaciones que se mantienen | core |
| C-28 | Cambiar estado inline | U-01, U-02 | Tarea | UPDATE | `state` (enum, 5 valores) | Desde el tag de la tabla o de la card. Un hook setea y limpia `finishedAt` al entrar/salir de `finalizado` | core · base (hook) |
| C-29 | Ver tareas agrupadas por proyecto | U-01, U-02 | Tarea | READ | — | Incluye horas del mes por proyecto y scroll al ancla | api · web |
| C-30 | Ver tareas agrupadas por responsable | U-01, U-02 | Tarea | READ | — | Ordenadas por fecha estimada | api · web |
| C-31 | Ver historial de cambios | U-01, U-02 | Actividad | READ | — | **Seis campos rastreados**: `title`, `estimatedFinishDate`, `state`, `area`, `priority`, `description`. El paso a vacío no se registra, **salvo `estimatedFinishDate`** | core |
| C-32 | Comentar una tarea | U-01, U-02 | Actividad | CREATE | `comment` (req), `visibilityLevel` (opt) | **La tarea debe existir** (`objective_not_found`): corrige un bug previo que devolvía 500 por la foreign key | core |
| C-33 | Consultar minutos trabajados por tarea | U-01, U-02 | Tarea | READ | — | Totales, agrupados por persona y detallados | api |

**Criterios de Aceptación:**
- DADO un requisito del proyecto 5,
  CUANDO se crea una tarea en el proyecto 8 referenciando ese requisito,
  ENTONCES falla con `requirement_project_mismatch`.
- DADA una tarea con responsables `[4, 9]` y se edita a `[9, 12]`,
  ENTONCES la asignación de la persona 9 **conserva su `createdAt` original**.
- DADO un comentario sobre una tarea inexistente,
  ENTONCES responde `objective_not_found`, no un 500.
- DADA una tarea que pasa de `activo` a `finalizado`,
  ENTONCES `finishedAt` queda seteado; si vuelve a `activo`, se limpia.

---

### F-05: Planificación de Capacidad Semanal

**Descripción:** Antes de que ocurra el trabajo, la conducción reserva capacidad: cuántas horas
de cada persona van a cada proyecto esta semana. Es el contrapunto de F-06 — lo planeado contra
lo ocurrido.

**Historia de Usuario:**
Como administrador,
quiero asignar horas semanales por persona y proyecto en una grilla,
para reservar capacidad antes de que la semana ocurra y después comparar contra lo real.

**Capacidades:**

| ID | Capacidad | Actor | Entidad | Operación | Campos clave | Reglas de negocio | Se valida en |
|---|---|---|---|---|---|---|---|
| C-34 | Ver la grilla proyecto × persona | U-01 | AsignacionSemanal | READ | `dateFrom` (lunes) | Agrupada en "Comerciales activos", "Internos activos", "En análisis". Solo personas con `mustChargeWorkedTime` | api · web |
| C-35 | Editar y guardar la semana | U-01 | AsignacionSemanal | UPDATE | `dateFrom` (req), lista de `{projectId, personId, minutes}` | **Reemplazo total de la semana** (borrar + recrear en una transacción). Las asignaciones en 0 se descartan. `internal` se deriva de `Proyecto.type` | api |
| C-36 | Impedir modificar semanas pasadas | U-01 | AsignacionSemanal | UPDATE | — | `validateWeekNotPast` | api |
| C-37 | Precargar desde la semana anterior | U-01 | AsignacionSemanal | READ | — | Solo si el usuario es `admin` **y** la semana actual está vacía | **web (solo UI)** |
| C-38 | Restringir la edición a administradores | U-01 | AsignacionSemanal | UPDATE | — | `hasAnyRole(['admin'])` | api |

**Criterios de Aceptación:**
- DADA la semana del 2026-08-03 (pasada) y hoy 2026-08-18,
  CUANDO un admin intenta guardarla,
  ENTONCES la api rechaza la operación.
- DADA una celda que se pone en 0,
  CUANDO se guarda la semana,
  ENTONCES no queda fila para esa combinación proyecto/persona.
- DADO un `user` no admin,
  CUANDO llama a `PUT /api/week-assigned-times`,
  ENTONCES recibe 403.

**Prioridad:** Media · **Dependencias:** F-02

> **Deuda conocida:** esta es la única capacidad de escritura que **no** pasa por `core` — la api
> escribe con el ORM. Ver ADR-002 y NFR-S09.

---

### F-06: Registro de Horas Trabajadas y Ausencias

**Descripción:** El registro diario de lo que efectivamente pasó. Es la operación de mayor
frecuencia del producto y la que alimenta toda la trazabilidad de costo (G-01).

**Historia de Usuario:**
Como miembro del equipo,
quiero cargar mis horas del día contra la tarea o el requisito correspondiente en pocos segundos,
para que el registro exista sin que me cueste tiempo de trabajo real.

**Capacidades:**

| ID | Capacidad | Actor | Entidad | Operación | Campos clave | Reglas de negocio | Se valida en |
|---|---|---|---|---|---|---|---|
| C-39 | Cargar horas del día | U-01, U-02 | HoraTrabajada | CREATE | `date` (req), `minutes` (req), `projectId` (req), `personId` (opt, default = usuario), `objectiveId` **xor** `requirementId` | Botones de horas y minutos, selector agrupado proyecto/requisito/tarea | api · core |
| C-40 | Limitar la ventana de carga | U-01, U-02 | HoraTrabajada | CREATE | `date` | **El día actual y los 10 previos.** Fuera de esa ventana se rechaza | api |
| C-41 | Imputar horas a otra persona | U-01 | HoraTrabajada | CREATE | `personId` | **Solo `admin`.** Un `user` solo carga las propias | api |
| C-42 | Excluir tarea y requisito entre sí | U-01, U-02 | HoraTrabajada | CREATE | `objectiveId`, `requirementId` | Mutuamente excluyentes (`.oxor`). **Sin constraint en la base** | api · core |
| C-43 | Verificar que el requisito sea del proyecto | U-01, U-02 | HoraTrabajada | CREATE | `requirementId`, `projectId` | `requirement_project_mismatch` | core |
| C-44 | Aplicar el tope diario | U-01, U-02 | HoraTrabajada, Ausencia | CREATE | `minutes` | **1440 min/día por persona, sumando horas trabajadas Y ausencias.** El error informa los minutos disponibles | core |
| C-45 | Mostrar el semáforo del día | U-01, U-02 | HoraTrabajada | READ | — | Completo/parcial/vacío contra `GET /settings/hours-per-day` | api · web |
| C-46 | Borrar un registro de horas | U-01, U-02 | HoraTrabajada | DELETE | `id` | Con confirmación | core |
| C-47 | Registrar una ausencia | U-01, U-02 | Ausencia | CREATE | `date` (req), `minutes` (req), `reason` (enum, 9 valores, req) | Modo "Ausente" de la misma pantalla. Comparte el tope diario | api · core |
| C-48 | Borrar una ausencia | U-01, U-02 | Ausencia | DELETE | `id` | Con deadline | api · core |
| C-49 | Reportar horas jerárquicamente | U-01, U-02 | HoraTrabajada | READ | período (esta/pasada semana, este/pasado mes, rango), agrupación (persona/proyecto), tipo de proyecto | **Tabla de 4 niveles: persona → proyecto → requisito → tarea**, más rama de ausencias. 4 cards de resumen | api · web |

**Criterios de Aceptación:**
- DADA una persona con 400 minutos ya cargados hoy y una ausencia de 900,
  CUANDO carga 200 minutos más,
  ENTONCES falla con `daily_limit_exceeded` informando **140 minutos disponibles**.
- DADO hoy 2026-08-18,
  CUANDO se intenta cargar contra el 2026-08-06 (12 días atrás),
  ENTONCES la api rechaza por fuera de ventana.
- DADO un `user` no admin,
  CUANDO envía `personId` de otra persona,
  ENTONCES la api rechaza.
- DADA una carga con `objectiveId: 5` y `requirementId: 9`,
  ENTONCES falla la validación: son excluyentes.

**Prioridad:** Alta · **Dependencias:** F-02, F-03, F-04

---

### F-07: Adjuntos Transversales

**Descripción:** Cualquier entidad del producto puede tener archivos, incluidas las que todavía
no existen: se puede adjuntar mientras se escribe un requisito y el vínculo se resuelve al
guardar.

**Historia de Usuario:**
Como usuario,
quiero adjuntar archivos a proyectos, requisitos, tareas y comentarios —incluso antes de guardar—,
para que el contexto viva junto al trabajo y no en un chat aparte.

**Capacidades:**

| ID | Capacidad | Actor | Entidad | Operación | Campos clave | Reglas de negocio | Se valida en |
|---|---|---|---|---|---|---|---|
| C-50 | Subir hasta 10 archivos | U-01, U-02, U-03 | Adjunto | CREATE | multipart, `entityType` (req), `entityId` (opt) | **Máximo 10 archivos, 10 MB cada uno.** Doble lista blanca: **extensión y MIME type**, 13 extensiones | api |
| C-51 | Calcular checksum | sistema | Adjunto | CREATE | `checksum` | sha256 por archivo. Excluido de las respuestas por default | api |
| C-52 | Revertir una subida parcial | sistema | Adjunto | ACTION | — | Si un archivo falla a mitad, **borra del bucket los ya subidos** | api |
| C-53 | Adjuntar a un borrador sin entidad | U-01, U-02, U-03 | Adjunto | CREATE | `entityType: requirement_draft \| comment_draft`, `entityId: null` | La titularidad se valida por `uploadedBy`. Al guardar, los adjuntos deben ser **drafts propios, vivos y de la entidad correcta**; si uno falla, **se descarta toda la escritura** | api · core |
| C-54 | Previsualizar y descargar | U-01, U-02, U-03 | Adjunto | READ | `id` | Preview inline (imagen y PDF); para archivos grandes **redirige a URL pre-firmada** | api |
| C-55 | Embeber adjuntos en markdown | U-01, U-02, U-03 | Adjunto | READ | placeholders | `placeholder:` y `fileplaceholder:` en `web`; `[attach:N]` y `![attach:N]` en `opus-web`. **`opus-web` parsea los dos formatos** | web · opus-web |
| C-56 | Borrar un adjunto | U-01, U-02, U-03 | Adjunto | DELETE | `id` | Borrado lógico vía `retentionStatus`, con confirmación | api |
| C-57 | Servir un adjunto público sin sesión | U-04 | Adjunto | READ | `id` | **Único endpoint sin autenticación del producto.** Sirve solo adjuntos marcados públicos; 403 en cualquier otro caso. Manda `X-Content-Type-Options: nosniff` y CSP de sandbox | api |
| C-58 | Autorizar adjuntos por entidad | sistema | Adjunto | READ | `entityType`, `entityId` | Resuelve el proyecto desde **9 tipos de entidad** y verifica `user_project_permissions`. Los adjuntos con `entityType: 'stage'` **nunca se autorizan**: la tabla ya no existe | api |

**Criterios de Aceptación:**
- DADA una subida de 3 archivos donde el segundo excede 10 MB,
  ENTONCES la operación falla completa y el primero **se borra del bucket**.
- DADO un archivo `.exe` renombrado a `.pdf`,
  ENTONCES se rechaza: la lista blanca valida extensión **y** MIME type.
- DADO un `external-user` sin permiso sobre el proyecto de un adjunto,
  CUANDO pide su preview,
  ENTONCES recibe 403.
- DADO un adjunto no marcado público,
  CUANDO se pide por el endpoint sin sesión,
  ENTONCES responde 403.

**Prioridad:** Alta · **Dependencias:** F-02, F-03, F-04

---

### F-08: Portal de Clientes (Opus)

**Descripción:** La superficie de cara al cliente. Mismo modelo de datos, subconjunto acotado:
solo los proyectos concedidos y solo la actividad pública.

**Historia de Usuario:**
Como cliente externo,
quiero ver el avance de mis proyectos y pedir cosas nuevas con mi propia identidad,
para no depender de mails y reuniones para saber en qué está lo que pedí.

**Capacidades:**

| ID | Capacidad | Actor | Entidad | Operación | Campos clave | Reglas de negocio | Se valida en |
|---|---|---|---|---|---|---|---|
| C-59 | Listar solo los proyectos concedidos | U-03 | Proyecto | READ | — | Filtrado por `user_project_permissions`. El tipo devuelto es mínimo: `{id, name}` | api |
| C-60 | Ver el tablero de requisitos en tres vistas | U-03 | Requisito | READ | `?view=` | Lista (default desktop), kanban de 7 columnas, y acordeones en mobile (**< 768 px, forzado por JS**) | opus-web |
| C-61 | Paginar por estado de forma independiente | U-03 | Requisito | READ | `state`, `limit` (20), `skip` | **Siete `useInfiniteQuery` en paralelo**, una por estado, con "Ver más" por columna. `resuelto` y `cancelado` arrancan colapsados | opus-web |
| C-62 | Crear un requisito desde el portal | U-03 | Requisito | CREATE | `title` (**único obligatorio**), `description` (opt), `projectId`, `priority` (opt), `type` (opt, default `otro`), suscriptores (opt) | Nace en `analisis` (chip fijo, no editable). Pantalla de éxito de 1,8 s | api · core |
| C-63 | Comentar desde el portal | U-03 | Actividad | CREATE | `comment`, adjuntos | **Siempre se crean como `public`** | opus-web · core |
| C-64 | Ver solo actividad pública | U-03 | Actividad | READ | — | El feed mezcla comentarios y cambios de campo en orden **ascendente**, con fechas relativas en español | api (filtro) |
| C-65 | Elegir suscriptores al crear | U-03 | Suscriptor | CREATE | `userIds` | Contra `GET /api/opus/projects/{id}/users` | api |
| C-66 | Cambiar estado y prioridad inline desde el portal | U-01, U-02 | Requisito | UPDATE | `state`, `priority` | **Solo roles internos** (`user`/`admin`). Un `external-user` ve los mismos pills sin dropdown. **A confirmar si es intencional** | opus-web (UI) · api (rol) |

**Criterios de Aceptación:**
- DADO un `external-user` con permiso sobre el proyecto 3 solamente,
  CUANDO pide la lista de proyectos,
  ENTONCES recibe únicamente el proyecto 3.
- DADO un requisito con un comentario `internal` y uno `public`,
  CUANDO un `external-user` abre su detalle,
  ENTONCES ve solo el `public`.
- DADO un requisito creado desde el portal,
  ENTONCES su estado es `analisis` y su tipo, si no se eligió, es `otro`.

**Prioridad:** Alta · **Dependencias:** F-03, F-09

---

### F-09: Identidad, Roles y Aislamiento

**Descripción:** Quién entra, con qué rol, y a qué datos llega. Es transversal: sostiene la
separación entre las dos superficies y es la única defensa del bus de escritura.

**Historia de Usuario:**
Como responsable del producto,
quiero que la identidad venga del directorio corporativo y que el acceso a datos se decida por
rol y por permiso de proyecto,
para que un cliente no pueda ver lo de otro ni lo interno del equipo.

**Capacidades:**

| ID | Capacidad | Actor | Entidad | Operación | Campos clave | Reglas de negocio | Se valida en |
|---|---|---|---|---|---|---|---|
| C-67 | Autenticar con OIDC | U-01, U-02, U-03 | Usuario | ACTION | — | Authorization Code + PKCE contra Zitadel. Los dos frontends comparten la app OIDC con secretos de sesión distintos | web · opus-web |
| C-68 | Resolver el rol desde el token | sistema | Usuario | READ | claim `urn:zitadel:iam:org:project:{id}:roles` | Tres roles: `admin`, `user`, `external-user` | api |
| C-69 | Proteger por defecto (deny-by-default) | sistema | — | ACTION | — | `validateToken` se instala para **todo path excepto una lista de exenciones**. Un archivo de ruta puede parecer desprotegido y estar cubierto | api |
| C-70 | Autorizar por rol | sistema | — | ACTION | — | `hasAnyRole([...])` por endpoint | api |
| C-71 | Autorizar por entidad | sistema | — | ACTION | `projectId` | `validateProjectPermissions` y `canUserAccessEntity`/`canUserViewEntity`, resolviendo el proyecto desde 9 tipos de entidad | api |
| C-72 | No exponer el access token al navegador | sistema | — | ACTION | — | `web` lo inyecta en Server Actions; `opus-web` en el route handler del proxy. **En ningún caso llega al bundle** | web · opus-web |
| C-73 | Expirar la sesión | sistema | Usuario | ACTION | — | Sesión JWT de 12 h en `web`; el callback rechaza el token vencido. `opus-web` lo valida además en el middleware | web · opus-web |
| C-74 | Autorizar la publicación en el bus | sistema | — | ACTION | subject, inbox | El **auth-callout de Zitadel** mintea los permisos por subject y el inbox `_INBOX.<hash(user-id)>.>`. **Es la única defensa de `core`** | Zitadel · NATS |

**Criterios de Aceptación:**
- DADO un usuario que autentica correctamente pero no tiene fila en `users`,
  ENTONCES recibe 401 `user_not_found` en todas las rutas.
- DADO un `external-user`,
  CUANDO entra a `web`,
  ENTONCES es redirigido a `/unauthorized`.
- DADO un token con el `kid` rotado en Zitadel,
  CUANDO llega a la api,
  ENTONCES el JWKS se resincroniza y el token se valida sin reiniciar el servicio.

**Prioridad:** Alta · **Dependencias:** Ninguna

---

### F-10: Integridad de la Escritura

**Descripción:** No es una feature de usuario: es la garantía transversal de que ninguna
operación deja datos a medias. Está acá porque condiciona cómo se implementa **toda** feature
futura.

**Historia de Usuario:**
Como responsable del producto,
quiero que cada operación de escritura sea atómica y pase por un único punto,
para que ninguna regla de negocio dependa de que cada endpoint se acuerde de aplicarla.

**Capacidades:**

| ID | Capacidad | Actor | Entidad | Operación | Campos clave | Reglas de negocio | Se valida en |
|---|---|---|---|---|---|---|---|
| C-75 | Canalizar toda escritura por comandos | sistema | — | ACTION | 17 comandos en 5 módulos | Subject `{instance}.{user-id}.gestion.v1.{comando}`. **La api no puede escribir**: su conexión es de solo lectura por credenciales | api · core |
| C-76 | Una transacción por comando | sistema | — | ACTION | — | La abre el **despachador**, no el comando. Commit si el reply es `success`, rollback en cualquier otro caso. **Los comandos no tienen acceso a `commit`/`rollback`** | core |
| C-77 | No dejar nunca una request sin respuesta | sistema | — | ACTION | — | Todo error inesperado se traduce a un `Reply` de falla; quedarse sin contestar dejaría a la api colgada hasta el timeout | core |
| C-78 | Traducir el código de error a HTTP | sistema | — | ACTION | `errorCode` | Mapa de 20 códigos en la api. Es lo que sostiene el contrato con los dos frontends | api |
| C-79 | Releer después de escribir | sistema | — | ACTION | `id` | Core devuelve **solo el `id`**; la api relee la base para rearmar el recurso completo con sus relaciones | api |
| C-80 | Aplicar semántica de edición parcial | sistema | — | ACTION | — | ausente = no se toca · valor = reemplaza · `null` = vacía · `null` en obligatorio = falla | core |
| C-81 | Repartir la carga entre réplicas | sistema | — | ACTION | queue group `gestion` | Varias réplicas de core se reparten los mensajes en lugar de procesar cada una lo mismo | core |

**Criterios de Aceptación:**
- DADO un comando que inserta 3 filas y falla en la cuarta validación,
  ENTONCES **ninguna de las 3 queda**: rollback del despachador.
- DADO `core` caído,
  CUANDO se intenta cualquier escritura,
  ENTONCES la api responde **503** tras 5000 ms y **la operación no ocurrió**.
- DADO un `PATCH` con `description: null` sobre un campo opcional,
  ENTONCES el campo queda vacío; si fuera obligatorio, la operación falla.

**Prioridad:** Alta · **Dependencias:** Ninguna

---

## Requerimientos No Funcionales

> Los NFR marcados **[implementado]** describen el comportamiento actual verificado en código.
> Los marcados **[propuesto]** son objetivos a definir: hoy no se miden ni se garantizan.

### Rendimiento

| ID | Requerimiento | Objetivo | Medición | Estado |
|---|---|---|---|---|
| NFR-P01 | Timeout del comando de escritura | 5000 ms (`NATS_REQUEST_TIMEOUT_MS`), luego 503 | Config verificable en `api/lib/utils/bus/` | **[implementado]** |
| NFR-P02 | Cache de lecturas en el cliente | `staleTime` 30 s, `gcTime` 5 min, `retry` 1 en queries y 0 en mutations | Config de TanStack Query | **[implementado]** |
| NFR-P03 | Reintento de conexión a la base | 5 intentos con 1 s de espera antes de abortar (`core`) | Código de arranque de `core` | **[implementado]** |
| NFR-P04 | Resincronización de JWKS | Reintentar `KEY_SYNC_ATTEMPS` veces ante un `kid` desconocido, sin reiniciar | `auth-helper.ts` | **[implementado]** |
| NFR-P05 | Latencia de escritura punta a punta | p95 < 500 ms | Sin instrumentación hoy | **[propuesto]** |
| NFR-P06 | Carga del tablero del portal | El tablero monta **7 queries en paralelo** y su `isLoading` es un `some`: espera a la más lenta | Medición pendiente | **[propuesto — deuda conocida]** |
| NFR-P07 | Paginación de listados | Requisitos 15/20/25; portal 20 por estado con scroll infinito | Verificable en UI | **[implementado]** |

### Seguridad

| ID | Requerimiento | Objetivo | Medición | Estado |
|---|---|---|---|---|
| NFR-S01 | Autenticación | OIDC Authorization Code + PKCE contra Zitadel, obligatorio | Config de NextAuth en ambos frontends | **[implementado]** |
| NFR-S02 | Protección de rutas | Deny-by-default: `validateToken` sobre todo path salvo lista de exenciones | `api/lib/config/public.ts` | **[implementado]** |
| NFR-S03 | Superficie no autenticada | **Exactamente un endpoint**: adjuntos marcados públicos. 403 en cualquier otro caso, con `nosniff` y CSP de sandbox | Test del endpoint | **[implementado]** |
| NFR-S04 | Access token fuera del navegador | El token **nunca** llega al bundle: se inyecta en el servidor en ambos frontends | Inspección del bundle | **[implementado]** |
| NFR-S05 | Vida de la sesión | 12 h (`web`); token vencido fuerza re-login en ambos | Config de NextAuth | **[implementado]** |
| NFR-S06 | Aislamiento entre clientes | Un `external-user` accede **solo** a proyectos con fila en `user_project_permissions`, resuelto desde 9 tipos de entidad | Tests de autorización | **[implementado]** |
| NFR-S07 | Reglas de workflow del lado del servidor | Las transiciones de estado de requisito (incluido el salteo de `en_cola` para incidencias) **hoy solo se validan en `web`** | Revisión de código | **[hueco conocido]** |
| NFR-S08 | Allowlist del proxy del portal | El proxy catch-all de `opus-web` **no filtra paths ni métodos**: expone toda la superficie de `/api/opus/*` a cualquier usuario logueado | Revisión de código | **[hueco conocido — mitigado por NFR-S06]** |
| NFR-S09 | Escritura solo desde `core` | La api conecta en solo lectura por credenciales. **Dos excepciones**: la fila de `attachments` y `PUT /api/week-assigned-times` | Permisos de PostgreSQL | **[implementado con excepciones]** |
| NFR-S10 | Defensa del bus | La política del auth-callout es la **única** defensa: core confía en el `creator`/`author`/`editor` del cuerpo sin verificar | Config de Zitadel + NATS | **[implementado — sin segunda línea]** |
| NFR-S11 | Bypass de autenticación en desarrollo | Opt-in explícito, **prohibido con `NODE_ENV=production`** (el arranque falla), exige `DEV_USER_ID` | Test de arranque | **[implementado]** |
| NFR-S12 | Validación de archivos subidos | Doble lista blanca (extensión **y** MIME), 13 extensiones, 10 MB, 10 archivos, checksum sha256 | Tests de subida | **[implementado]** |
| NFR-S13 | Auditoría de acciones | Solo hay historial de cambios de tarea y requisito. **No hay audit log** de acceso, permisos ni borrados | — | **[ausente]** |
| NFR-S14 | Rate limiting | No implementado en ninguna capa | — | **[ausente]** |
| NFR-S15 | TLS | `nginx-proxy` + Let's Encrypt en producción | Config de deploy | **[implementado]** |

### Confiabilidad

| ID | Requerimiento | Objetivo | Medición | Estado |
|---|---|---|---|---|
| NFR-R01 | Atomicidad de la escritura | Una transacción por comando, commit/rollback decidido por el despachador | 136 tests de core, entrando por el despachador | **[implementado]** |
| NFR-R02 | Durabilidad del comando | **Ninguna.** Sin JetStream: sin cola, reintento, persistencia ni idempotencia. Core caído = la operación no ocurrió | — | **[limitación asumida]** |
| NFR-R03 | Disponibilidad de escritura | Igual a la de `core`. Sin degradación elegante ni reconciliación posterior | — | **[limitación asumida]** |
| NFR-R04 | Respuesta garantizada | El despachador **nunca lanza**: todo error se traduce a un `Reply` de falla, con una última red en el consumer | Tests de core | **[implementado]** |
| NFR-R05 | Healthchecks | No hay healthcheck en ningún servicio del compose | — | **[ausente]** |
| NFR-R06 | Logs en producción | Winston con dos transports a archivo, pero **`LOGGER_*` no está definido en el compose**: quedan con `filename: undefined` | Revisión de deploy | **[roto]** |
| NFR-R07 | Fuente única del esquema | **Dos fuentes**: producción se construye con las 103 migraciones de la api, desarrollo con `sequelize.sync()` de core | — | **[hueco conocido]** |
| NFR-R08 | Instalación desde cero | **No soportada.** Ninguna migración crea `objectives`; requiere un dump previo | — | **[limitación asumida]** |

### Usabilidad

| ID | Requerimiento | Objetivo | Medición | Estado |
|---|---|---|---|---|
| NFR-U01 | Idioma de la interfaz | Enteramente español | Revisión de UI | **[implementado con excepciones]** |
| NFR-U02 | Idioma de los mensajes de error | Los errores de api y core llegan al usuario tal cual y están **mezclados entre inglés y español**, a veces en el mismo archivo | Revisión de código | **[roto]** |
| NFR-U03 | Responsive del gestor interno (`web`) | **Sin tratamiento coherente.** De 4 breakpoints declarados solo `mobile` se usa (6 veces en 5 archivos, uno de ellos código muerto); en paralelo hay 14 `@media` crudas con 8 valores distintos. La sidebar es de 290 px fija | Relevamiento UX | **[hueco conocido]** |
| NFR-U04 | Responsive del portal (`opus-web`) | Corte real en 768 px. **Bajo ese ancho no hay navegación**: el `Sidebar` desaparece y no se monta reemplazo — no se puede cambiar de proyecto ni cerrar sesión | Relevamiento UX | **[roto]** |
| NFR-U05 | Accesibilidad | Elementos clickeables que no son botones (sin `role`/`tabIndex`/teclado), ningún modal atrapa el foco, tabla hecha con `div` + grid sin roles ARIA | Relevamiento UX | **[hueco conocido]** |
| NFR-U06 | Estados de UI | El portal carece de estados de error y vacío en pantallas clave, y no tiene `error.tsx` ni `not-found.tsx` en ninguna ruta | `docs/ux/gaps-as-is.md` | **[hueco conocido]** |
| NFR-U07 | Consistencia del tuteo | Mezcla de "tú" y "vos" en el mismo producto | Relevamiento UX | **[roto]** |
| NFR-U08 | Tiempo de la carga diaria de horas | < 90 s por sesión | Sin medición | **[propuesto]** |

### Escalabilidad

| ID | Requerimiento | Objetivo | Fase |
|---|---|---|---|
| NFR-SC01 | Réplicas de `core` | Soportado por diseño: queue group `gestion` reparte los mensajes entre réplicas | **[implementado]** |
| NFR-SC02 | Réplicas de la api | Sin estado propio; el límite es la base | **[implementado]** |
| NFR-SC03 | Capacidad esperada | Producto interno: decenas de personas, cientos de proyectos, decenas de miles de registros de horas | Actual |
| NFR-SC04 | Almacenamiento de adjuntos | Externalizado en S3-compatible; no consume disco de los servicios | **[implementado]** |
| NFR-SC05 | Cache distribuida | No existe. La única cache es la del cliente (TanStack Query) | **[ausente]** |
| NFR-SC06 | Límites de recursos en producción | Sin límites de CPU ni memoria en el compose | **[ausente]** |

### Mantenibilidad

| ID | Requerimiento | Objetivo | Medición | Estado |
|---|---|---|---|---|
| NFR-M01 | Cobertura de tests | `web` 644 casos / 73 archivos · `opus-web` 296 / 51 · `core` 136 / 5 · api con base real | Corridas de CI | **[implementado]** |
| NFR-M02 | Tests contra base real | `core` y `api` corren contra PostgreSQL efímero, sin mocks de Sequelize | `tests/setup-env.ts` | **[implementado]** |
| NFR-M03 | Tests de escritura punta a punta | El `FakeBus` de la api **ejecuta core de verdad** contra la misma base: un test verifica comando publicado, traducción a HTTP y escritura efectiva | `api/tests/mocks/bus.ts` | **[implementado]** |
| NFR-M04 | Zona horaria de los tests | `TZ=UTC` fijado en los cuatro servicios | Configs de test | **[implementado]** |
| NFR-M05 | Modelos sin divergencia posible | Los 26 modelos viven en `@jiku/models`, compartido por api y core | Estructura del monorepo | **[implementado]** |
| NFR-M06 | Catálogo de códigos de error | **No existe lista cerrada.** `daily_limit_exceeded` transporta datos **parseando el mensaje con un regex**; 4 códigos declarados no se emiten; `unknown_command` no tiene mapeo HTTP | Revisión de código | **[hueco conocido]** |
| NFR-M07 | Áreas sin cobertura | `web`: `clients`, `time-allocation`, `contexts`, `lib`. `opus-web`: `middleware.ts` (el guard de toda la app), config de NextAuth, interceptores de axios y los 6 hooks de requisitos | Reporte de cobertura | **[hueco conocido]** |
| NFR-M08 | Tipado estricto | `core` con `strict: true` + `noUnusedLocals`/`noUnusedParameters`/`noImplicitReturns`. **La api lo tiene apagado** | `tsconfig.json` | **[desparejo]** |

---

## Restricciones Técnicas

| Categoría | Restricción |
|---|---|
| **Runtime** | Node ≥ 24 (imagen `node:24.12-alpine3.23`), TypeScript 5.9 |
| **Backend** | Express 5 (api) · sin framework HTTP (core) · Sequelize 6 + sequelize-typescript · Joi 18 · Winston |
| **Frontend** | Next.js 16 App Router con `output: 'standalone'` · React 19 · TanStack Query 5 · Sass + CSS Modules · NextAuth v5 beta |
| **Datos** | PostgreSQL, 25 tablas, esquema compartido entre api (RO) y core (RW) |
| **Mensajería** | NATS 2.29 request/reply, **sin JetStream** |
| **Identidad** | Zitadel (OIDC) — obligatorio; su auth-callout autoriza el bus |
| **Storage** | S3-compatible (AWS S3, MinIO, DigitalOcean Spaces o Cloudflare R2). **Sin defaults para bucket y región, a propósito** |
| **Repositorio** | Monorepo npm con workspaces. Los Dockerfiles se construyen **desde la raíz** por los paquetes compartidos |
| **Testing** | Mocha + should + sinon (backends) · Vitest + Testing Library (frontends) |
| **Deploy** | Docker Compose, `nginx-proxy` + Let's Encrypt. Sin healthchecks, sin límites de recursos, sin deploy automático |
| **Regla estructural** | **Toda escritura nueva debe implementarse como comando en `core`.** La api no puede escribir |
| **Regla de vocabulario** | Los renombres viven en el contrato del bus. **La base no se toca** |
| **Compatibilidad** | Navegadores modernos con soporte de custom properties. El gestor interno es de facto **desktop-only** (ver NFR-U03) |

---

## Supuestos

- **Los objetivos y métricas de `goals-and-context.md` son una reconstrucción**, no un registro
  histórico: no había documento de producto previo del cual extraerlos.
- **La caracterización de las audiencias es inferida** de los permisos y del flujo. El código
  distingue tres roles con precisión pero no dice quién es cada uno.
- **El desktop-only del gestor interno se asume deuda, no decisión.** El código no permite
  distinguirlo: hay tratamiento responsive incoherente, no ausencia deliberada de tratamiento.
- **Se asume que el equipo interno entrando al portal de clientes es un efecto colateral**, no
  una capacidad buscada (C-66).
- **Las tres tablas de mail (`objective_mail_threads`, `requirement_mail_threads`,
  `inbound_mail_threads`) se asumen muertas**: quedaron de notificaciones eliminadas y ninguna
  migración las borra, porque una migración destructiva perdería datos.
- Se asume que las instalaciones son pocas y controladas por el mismo equipo, lo que hace
  tolerable que una instalación nueva requiera un dump previo.

---

## Preguntas Abiertas

Ordenadas por impacto en el producto:

1. **¿Se puede dar de alta usuarios desde el producto?** Hoy no: `POST /api/auth/present` es un
   no-op y la única vía es insertar la fila a mano. Es el hueco de alcance más grande y **bloquea
   el onboarding de cualquier cliente nuevo**.
2. **¿La suscripción a un requisito debería notificar?** Existe la capacidad de suscribirse y
   **ningún canal por el que llegue nada**. Un cliente se suscribe y no pasa nada.
3. **¿Las reglas de workflow de requisitos deben ser autoritativas en el servidor?** Hoy la
   secuencia de estados y el salteo de `en_cola` para incidencias **solo viven en `web`**
   (NFR-S07). Cualquier cliente HTTP puede saltar a cualquier estado.
4. **¿Un usuario interno debería poder operar desde el portal de clientes?** Hoy puede cambiar
   estado y prioridad inline desde `opus-web` (C-66).
5. **¿El proxy catch-all de `opus-web` debería tener allowlist?** Su seguridad depende
   enteramente de que la api autorice por rol en cada endpoint de `/api/opus/*` (NFR-S08).
6. **¿El gestor interno debe ser usable en mobile?** Y en el portal, ¿se acepta que hoy sea
   inutilizable bajo 768 px (sin navegación ni logout)?
7. **¿La asimetría en el reemplazo de responsables es intencional?** `tasks` preserva el
   `createdAt` de las asignaciones que se mantienen; `requirements` borra todas y recrea.
8. **¿El tope de 1440 min/día es requisito de producto o guardarraíl técnico?** Está duplicado en
   dos archivos como constante local, no compartida.
9. **¿La visibilidad automática de actividades es la regla definitiva?** Está declarada en el
   código como "reglas de negocio de S-002", una historia que ya no existe.
10. **¿Se cataloga formalmente el `ErrorCode`?** Sin lista cerrada, con un código que transporta
    datos por regex sobre el mensaje y otro sin mapeo a HTTP (NFR-M06).
11. **¿Se unifica el idioma de los mensajes de error?** Llegan al usuario final mezclados
    (NFR-U02).
12. **¿"Actores" y "Tareas" es el vocabulario definitivo?** La migración de `objectives` → `task`
    está a medio camino, con el bus ya migrado y la base no.
13. **¿Se completa la eliminación de `stages`?** La tabla ya no existe pero `web` sigue enviando
    `stageId`, la api lo reenvía, y los adjuntos históricos con `entityType: 'stage'` **nunca se
    autorizan**.
14. **¿Se corrige `PUT /api/week-assigned-times` para pasar por `core`?** Es la única escritura de
    dominio que viola la regla estructural del producto (NFR-S09).
