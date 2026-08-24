---
created: 2026-08-18
last_updated: 2026-08-18
status: Draft - Importado desde código existente
---

# Objetivos y Contexto

> Documento generado por `/product-consolidate-services` a partir del análisis de los cuatro
> servicios existentes (`web`, `opus-web`, `api`, `core`). Lo que está afirmado acá tiene
> evidencia en el código; lo que es interpretación está marcado como tal.

## Visión General del Producto

### Nombre

**Jiku** — sistema interno de gestión de proyectos, requisitos y tiempo de Grava Digital.

El producto se despliega como cuatro servicios en un monorepo npm: dos frontends (`web` y
`opus-web`, este último con el nombre de marca **Opus** de cara al cliente) y dos backends
(`api` y `core`).

### Problema que Resuelve

Una consultora que trabaja para varios clientes en simultáneo necesita responder tres preguntas
al mismo tiempo, y las herramientas genéricas obligan a elegir dos: **qué pidió cada cliente y
en qué estado está**, **quién está trabajando en qué esta semana**, y **cuánto tiempo real
costó cada cosa**. Un gestor de tareas resuelve la primera, una planilla de asignación la
segunda y un time tracker la tercera; mantener las tres sincronizadas a mano es el trabajo que
nadie hace.

Jiku une las tres sobre un mismo modelo: el requisito que pide un cliente, la tarea en la que
el equipo lo descompone, la asignación semanal que reserva capacidad y las horas efectivamente
imputadas son entidades del mismo sistema, relacionadas entre sí. Un reporte de horas puede
bajar hasta el requisito que las originó porque la relación existe en la base, no porque
alguien la reconstruyó.

El segundo problema es de **canal con el cliente**. El pedido de un cliente que llega por
Mattermost, mail o reunión se pierde o queda sin trazabilidad, y mostrarle el tablero interno
no es opción: ahí están las horas, los costos y los comentarios internos. Jiku resuelve esto
con un portal separado (`opus-web`) sobre la misma base de datos, donde el cliente crea sus
propios requisitos y sigue su avance, pero solo ve los proyectos que le fueron concedidos y
solo la actividad marcada como pública.

### Usuarios Objetivo

- **U-01: Administrador (`admin`)**: Rol de conducción del equipo. Además de todo lo que puede
  hacer un miembro del equipo, planifica la capacidad semanal (grilla proyecto × persona),
  imputa horas en nombre de otra persona cuando alguien no las cargó, y consume los reportes
  de horas por persona y por proyecto. Es quien necesita ver el conjunto, no una tarea.
  *[Evidencia: `hasAnyRole(['admin'])` en `PUT /api/week-assigned-times` y en la validación de
  `personId` de `POST /api/worked-times`; edición de la grilla en `WeeklyAllocationTable`.]*

- **U-02: Miembro del equipo (`user`)**: Quien ejecuta el trabajo. Gestiona proyectos,
  requisitos y tareas, comenta, adjunta archivos y **carga sus propias horas todos los días**.
  Su interacción de mayor frecuencia no es la más compleja: es la carga diaria de horas, que
  ocurre una vez por día y compite con el trabajo real.
  *[Evidencia: rol `user` en el claim de Zitadel; `personId` se resuelve por default desde el
  usuario autenticado en `worked-times-post.ts`.]*

- **U-03: Cliente externo (`external-user`)**: La contraparte del proyecto en la organización
  cliente. Entra al portal Opus con su propia identidad, ve **solo los proyectos que le fueron
  concedidos** vía `user_project_permissions`, crea requisitos, comenta y se suscribe para
  seguir un requisito. Nunca ve horas, comentarios internos ni proyectos de otros clientes.
  *[Evidencia: `validateProjectPermissions` en las rutas `/api/opus/*`; redirección de
  `external-user` a `/unauthorized` en el layout de `web`.]*

- **U-04: Visitante sin sesión**: No es un rol del sistema, pero es un consumidor real: quien
  recibe el link de un adjunto marcado como público puede abrirlo sin autenticarse. Es la única
  superficie no autenticada del producto.
  *[Evidencia: `GET /attachments/:id/:fileName` en `opus-web` → `GET /api/opus/attachments/:id/public`,
  el único endpoint exento de `validateToken`.]*

**Nota sobre la caracterización de audiencias:** el código distingue estos cuatro consumidores
con precisión, pero **no dice quién es cada uno ni con qué frecuencia y en qué contexto usa
cada pantalla**. La caracterización de arriba es interpretación a partir de los permisos y del
flujo, y debe validarse con el equipo antes de tomarse como investigación de usuario.

## Objetivos y Criterios de Éxito

> Los objetivos están **inferidos de lo que el sistema efectivamente hace y de dónde puso
> esfuerzo**. No hay documento de producto previo del cual extraerlos, así que son una
> reconstrucción a validar, no un registro histórico.

### Objetivos Primarios

1. **G-01: Trazabilidad completa del pedido al costo**. Todo pedido de un cliente tiene que
   poder seguirse desde que entra como requisito, pasando por las tareas en que se descompone,
   hasta las horas imputadas contra él. El reporte de horas debe poder bajar hasta el requisito
   que las originó sin reconstrucción manual.
   *[Evidencia: `worked_times` referencia `objective_id` **o** `requirement_id`; el reporte de
   horas tiene 4 niveles jerárquicos persona → proyecto → requisito → tarea.]*

2. **G-02: Un canal formal con el cliente que no exponga lo interno**. El cliente tiene que
   poder pedir, seguir y conversar sobre sus requisitos con su propia identidad, sin acceso a
   horas, costos, comentarios internos ni proyectos ajenos. La separación tiene que ser
   estructural, no una convención de uso.
   *[Evidencia: portal `opus-web` separado, `user_project_permissions`, modelo de visibilidad
   `public`/`internal` aplicado en la api.]*

3. **G-03: Planificación de capacidad separada del registro de lo ocurrido**. El equipo tiene
   que poder reservar capacidad por semana (qué se planea) y registrar horas por día (qué
   pasó), como dos actos distintos que después se comparan.
   *[Evidencia: `week_assigned_times` y `worked_times` son tablas y flujos separados; la
   asignación es semanal y solo de `admin`, la carga es diaria y de cada persona.]*

4. **G-04: Integridad de la escritura garantizada por arquitectura, no por disciplina**. Las
   reglas de negocio no pueden depender de que cada endpoint se acuerde de aplicarlas: tiene
   que haber un único punto por el que pase toda escritura, con una transacción por operación.
   *[Evidencia: api en solo lectura por credenciales; core como único escritor; la transacción
   la abre y cierra el despachador, y los comandos no tienen acceso a `commit`/`rollback`.]*

5. **G-05: Baja fricción en la carga diaria de horas**. La operación de mayor frecuencia del
   producto —cargar las horas del día— tiene que costar segundos, no minutos, o deja de
   hacerse y G-01 se cae.
   *[Evidencia: selector de día con semáforo completo/parcial/vacío contra
   `/settings/hours-per-day`, botones de horas y minutos en vez de campos libres, selector
   agrupado proyecto/requisito/tarea.]*

### Métricas de Éxito

> **Estas métricas son propuestas, no medidas.** El producto no instrumenta ninguna hoy: no hay
> analytics, ni telemetría, ni eventos de producto en ninguno de los cuatro servicios. Se
> proponen como punto de partida para definir qué observar.

| Métrica | Objetivo | Plazo | Valida |
|---|---|---|---|
| Cobertura de carga de horas: % de días laborables con horas cargadas por persona | > 90% | Mensual | G-01, G-05 |
| Tiempo de la carga diaria: desde abrir la pantalla hasta guardar el último registro | < 90 segundos | Por sesión | G-05 |
| Requisitos con horas imputadas: % de requisitos cerrados con al menos una hora asociada | > 80% | Mensual | G-01 |
| Requisitos originados por el cliente en el portal, sobre el total de requisitos nuevos | > 40% | Trimestral | G-02 |
| Desvío de capacidad: diferencia entre horas asignadas y horas cargadas por proyecto y semana | < 20% | Semanal | G-03 |
| Latencia del comando de escritura (publicación NATS → respuesta de core) | p95 < 500 ms | Continuo | G-04 |
| Comandos perdidos por timeout del bus (respuestas 503) | 0 por semana | Semanal | G-04 |

## Contexto

### Sistemas Existentes

- **Zitadel (OIDC)**: Proveedor de identidad de la organización. Es la fuente de verdad de
  **quién** es cada persona y de **qué rol** tiene: los roles viajan en el claim
  `urn:zitadel:iam:org:project:{PROJECT_ID}:roles` del token. No se reemplaza. Además cumple
  un segundo papel crítico y menos obvio: su **auth-callout** es quien mintea los permisos de
  publicación en NATS, y por lo tanto es la única defensa que impide que alguien distinto de
  la api escriba comandos a `core`.

- **Storage S3-compatible**: Bucket de adjuntos. La instalación elige el proveedor (AWS S3,
  MinIO, DigitalOcean Spaces o Cloudflare R2); el código no asume ninguno y deliberadamente no
  define defaults para bucket ni región.

- **Herramientas externas del equipo (Mattermost, documentación, diseño, board)**: No se
  integran; se **enlazan**. Cada proyecto guarda sus enlaces en `keyValuePairs`
  (`documentacion`, `board_de_tareas`, `diseño`) y la navegación de `web` muestra accesos
  configurados por la variable `EXTERNAL_LINKS`. Jiku es el índice, no el reemplazo.

- **Alta de usuarios: hoy es un sistema externo por omisión.** El producto **no puede crear
  usuarios**: `POST /api/auth/present` es un no-op, y quien autentica correctamente contra
  Zitadel pero no tiene fila en `users` recibe 401 `user_not_found` de todas las rutas. La
  única vía actual es insertar la fila a mano en la base. Es una limitación estructural, no un
  feature pendiente: la api quedó en solo lectura y esa era la última escritura que nunca se
  convirtió en comando.

### Decisiones Clave Ya Tomadas

Estas decisiones están **implementadas y condicionan todo lo que se construya encima**. Cada
una tiene su ADR en `docs/adrs/`.

- **CQRS por credenciales: la `api` lee, `core` escribe.** No es una separación de estilo sino
  de infraestructura: la conexión de la api es de solo lectura por permisos de PostgreSQL, y
  core conecta con el usuario dueño. Ninguna feature nueva puede escribir desde la api.

- **Toda mutación es un comando NATS request/reply, sin JetStream.** No hay cola, reintento,
  persistencia ni idempotencia. Si core está caído, la operación **no ocurrió** y el usuario ve
  un 503. Es una decisión consciente con una consecuencia asumida.

- **Dos frontends separados sobre una misma API.** La superficie del cliente (`/api/opus/*`, 12
  endpoints) está separada de la interna (49 endpoints) a nivel de ruteo y de autorización, no
  solo de UI.

- **Identidad federada en Zitadel, con la misma app OIDC para los dos frontends.** Comparten
  `ZITADEL_CLIENT_ID` con secretos de sesión distintos.

- **Monorepo npm con modelos compartidos.** Los 26 modelos Sequelize viven en `@jiku/models`,
  que **no abre la conexión**, justamente para que api y core usen la misma definición con
  credenciales distintas y no puedan divergir.

- **El vocabulario del producto se separa del de la base, y la base no se toca.** Es criterio
  declarado en el código: los renombres viven en el contrato del bus, no en el esquema.

- **Sin librería de componentes.** Los dos frontends usan Sass + CSS Modules + custom
  properties. No hay Tailwind, MUI ni design system publicado.

## Vocabulario del Producto

El producto llama a las cosas de una manera y el almacenamiento de otra. La traducción está
implementada y es **deuda con dirección decidida**, no ambigüedad:

| Producto / UI | HTTP y base de datos | Bus (comandos a core) | Estado |
|---|---|---|---|
| **Actor** | `client` | `client` | La UI ya usa el nombre nuevo; base y bus no |
| **Tarea** | `objective` | `task` | El bus ya migró; la base sigue en `objectives` |
| **Requisito** | `requirement` | `requirement` | Coincide en las tres capas |
| **Etapa** | `stage` | — | **Eliminada de la base**, pero `web` sigue enviando `stageId` y la api lo reenvía |

Que el bus ya diga `task` y la base siga diciendo `objectives` no es inconsistencia accidental:
es una migración de vocabulario a medio camino, con la dirección definida.

## Alcance

### Dentro del Alcance (implementado hoy)

- **Actores**: alta, edición, listado con búsqueda y filtros, y su cartera de proyectos. El
  estado activo/inactivo se **deriva** de sus proyectos, no se almacena.
- **Proyectos**: CRUD, personas asignadas, propiedades extensibles (`keyValuePairs`) con
  enlaces a herramientas externas, resumen de tareas y adjuntos.
- **Requisitos**: CRUD, workflow de 7 estados con reglas de transición, 4 tipos, 5 prioridades,
  etiquetas clave:valor con sugerencias, resolución con tipo y conclusión para incidencias,
  feed de actividad con comentarios de visibilidad interno/público, y reporte con export CSV.
- **Tareas**: CRUD, alta múltiple en un solo submit, 5 estados, 4 áreas, historial de cambios
  de 6 campos, comentarios, y dos vistas agregadas (por proyecto y por responsable).
- **Asignación semanal de capacidad**: grilla proyecto × persona en horas, solo `admin`, con
  precarga desde la semana anterior.
- **Horas trabajadas y ausencias**: carga diaria con semáforo, 9 motivos de ausencia, tope
  diario de 24 h por persona, ventana de carga del día actual + 10 previos, y reportes
  jerárquicos por persona y por proyecto.
- **Adjuntos transversales**: hasta 10 archivos de 10 MB, 13 extensiones con doble lista blanca
  (extensión y MIME), checksum sha256, rollback ante fallo parcial, preview y descarga, y
  soporte de borradores sin entidad todavía creada.
- **Portal de clientes (Opus)**: tablero de requisitos con tres vistas (lista, kanban y mobile),
  paginación infinita por estado, alta de requisitos, comentarios con adjuntos, suscripciones,
  y adjuntos públicos por link.
- **Identidad y autorización**: OIDC contra Zitadel, tres roles, autorización por rol y por
  entidad, y permisos de proyecto por usuario externo.

### Fuera del Alcance (hoy no existe)

- **Alta de usuarios desde el producto** — bloqueada por la arquitectura de escritura actual
  (ver Sistemas Existentes). Es el hueco de alcance más grande.
- **Notificaciones** — un cliente puede suscribirse a un requisito, pero **no hay canal de
  notificación**: no hay envío de mails, push ni webhooks. Existen tres tablas huérfanas
  (`objective_mail_threads`, `requirement_mail_threads`, `inbound_mail_threads`) de una
  funcionalidad de mail eliminada que ninguna migración borró. La suscripción registra interés
  y nada más.
- **Instalación desde cero** — las 102 migraciones asumen un esquema preexistente; ninguna crea
  la tabla `objectives`. Una instalación nueva necesita un dump previo.
- **Facturación, costos y tarifas** — el producto registra tiempo, no dinero.
- **Uso en mobile del portal de clientes** — bajo 768 px el `Sidebar` de `opus-web` desaparece
  y no se monta ningún reemplazo: no se puede cambiar de proyecto ni cerrar sesión.
- **Analítica y telemetría de producto** — no hay instrumentación de ningún tipo.
- **Etapas (`stages`)** — eliminadas de la base; quedan restos en el código.
- **Comentarios internos en el portal** — el tipo `visibilityLevel: 'internal'` existe en los
  tipos de `opus-web` y nunca se crea desde ahí.

### Restricciones

- **Tecnología**: Node ≥ 24, TypeScript 5.9, PostgreSQL, NATS sin JetStream, Next.js 16 App
  Router, Express 5. Monorepo npm con workspaces y paquetes compartidos.
- **Identidad**: Zitadel es obligatorio y no reemplazable sin rehacer la autorización del bus.
- **Escritura**: cualquier feature que escriba datos **debe** implementarse como comando en
  `core`. La api no puede escribir (salvo las dos excepciones históricas ya identificadas como
  deuda: la fila de `attachments` y `PUT /api/week-assigned-times`).
- **Disponibilidad**: sin JetStream, la disponibilidad de escritura del producto es exactamente
  la de `core`. No hay degradación elegante ni reconciliación posterior.
- **Idioma**: la interfaz es enteramente en español. Los mensajes de error de api y core llegan
  al usuario tal cual y hoy están mezclados entre inglés y español.
- **Equipo**: producto interno de Grava Digital, desarrollado y operado por el mismo equipo que
  lo usa.

## Stakeholders

| Stakeholder | Rol | Interés |
|---|---|---|
| Equipo de desarrollo de Grava Digital | Constructor **y** usuario del producto | Es el caso poco común de un producto cuyo equipo es su propia audiencia principal: el feedback es inmediato y el sesgo también |
| Conducción del equipo | Usuario U-01 | Planificación de capacidad, reportes de horas, visibilidad del conjunto |
| Clientes de Grava Digital | Usuario U-03 | Canal formal de pedido y seguimiento |
| Operaciones / deploy | Operador | Cuatro imágenes Docker, `nginx-proxy` + Let's Encrypt, sin healthchecks ni límites de recursos hoy |
