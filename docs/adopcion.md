# Adopción de jiku flow

> Informe de la adopción del 27 de noviembre de 2026 (requisito #621). Es un registro de ese
> día: no se mantiene al día. Lo que decidas hacer con lo que lista entra como requisito de Jiku
> (`/jflow-spec` + `/jflow-build`) o como cambio directo (`/jflow-fix`).

## Resumen

| | |
|---|---|
| Definición | 14 bloques (260 requisitos, 194 condiciones de falla), 16 entidades, 92 operaciones HTTP + 23 comandos + 23 consultas + 16 eventos, 18 invariantes, 34 garantías, 49 decisiones (16 de producto, 33 técnicas), 13 NFR, 16 flujos |
| Listo para especificar e implementar | Sí: el repositorio cumple el mínimo (M1–M9), verificado |
| Correcciones hechas en la adopción | 10 |
| Cargado en Jiku | 13 incidencias de seguridad (los números se completan al cargarlas) |
| En este informe | 24 bugs, 5 comportamientos a confirmar, 17 defaults sugeridos, 12 otras mejoras |
| Cobertura por ID | 0/505 (los tests anteriores no llevan IDs; los nuevos los van a llevar) |

## Línea de base

Cómo estaba el repositorio antes de la adopción, corriendo sus propios comandos (rama `jflow`,
Node 24.18, Docker 29.10).

| Comando de antes | Resultado |
|---|---|
| `npm ci` | Pasa |
| `./scripts/set-version.sh --check` | Pasa |
| `npm run build` (paquetes, api y core) | Pasa |
| `npm run lint` | Pasa (181 avisos, ningún error) |
| `npm test` | Pasa: nats-protocol 208, api 1460, core 2171, web 2943, opus-web 588. Ningún test fallaba |
| `next build` de web y de opus-web (el CI no lo corría) | Pasa |
| `tsc --noEmit` de opus-web (el CI no lo corría) | Pasa |
| `tsc --noEmit` de web (el CI no lo corría) | Falla: 167 errores, todos en archivos de test (globales de vitest sin tipos) |
| `npm run format:check` (el CI no lo corría) | Falla: 1405 archivos sin el formato de prettier |
| El stack completo (`deploy/local.sh up`) | No se pudo levantar: pide una identidad de NATS, usuarios de servicio de Zitadel y un dump de producción que no están en el repositorio, y la imagen de MinIO que usa ya no existe en Docker Hub |

No había tests end to end ni reportes JUnit.

## Correcciones hechas en la adopción

Lo que la adopción cambió para llegar al mínimo de jiku flow. La lógica del producto no cambió:
ningún test fallaba en la línea de base.

| Mínimo | Qué se hizo | Cómo se comprobó |
|---|---|---|
| M1 | `api`, `core`, `web` y `opus-web` pasaron a `services/{servicio}/` (con su historia). Se actualizaron los workspaces, el lockfile, los cuatro Dockerfiles, los composes de `deploy/`, los workflows, `scripts/set-version.sh`, los scripts de NATS, los tests que leen archivos del repositorio y las guías. El texto histórico (`CHANGELOG.md` y los documentos de la metodología anterior en `docs/`) conserva las rutas viejas | Build, lint y tests con los mismos números que la línea de base |
| M8 | Los contratos pasaron de `docs/apis/` a `_jflow/apis/` (`api.openapi.yaml`, `core.asyncapi.yaml`, `core-queries.asyncapi.yaml`, `core-events.asyncapi.yaml`, `jiku-modules.asyncapi.yaml`), con las extensiones de jiku flow (`operationId`, módulos, requisitos, fallas, credenciales) sin cambiar nada del cable | Los tests de contrato pasan; `jflow.py def-check` |
| M5 | Las migraciones nunca construyeron el esquema desde una base vacía: la primera modifica `objectives`, que ninguna crea, y las instalaciones arrancaban de un dump. Se agregó la base: `services/api/db-upgrade/baseline/schema.sql` (el esquema, sin datos, después de las 94 migraciones que tenía el dump) y `baseline.js`, que `upgrade-db` corre antes de las migraciones: en una base vacía crea ese esquema y registra esas 94; en una base existente no hace nada | Base vacía → 108 migraciones registradas; una segunda corrida no cambia nada; `make up`. `documentation/` y `deploy/.env.dist` dejan de pedir un dump |
| M6 | Los tests de integración de api y core corren sobre el esquema que construyen las migraciones (antes, sobre `sequelize.sync()`; decidido en la adopción), en el servicio `postgres-test` de Compose. Se ajustaron solo tests: orden de limpieza (las FK reales no borran en cascada), datos de prueba válidos para el esquema real (un enum, un índice único) y cinco tests cuya premisa era el esquema de `sync()`, reescritos con la misma intención | `make test-integration`: api 1460 y core 2171 pasan |
| M2, M3 | `Makefile` en la raíz y en cada servicio con todos los objetivos. Reportes JUnit en `reports/junit/{servicio}-{nivel}.xml` | `make check` |
| M4 | `.env.example` con cada variable y valores seguros (las opcionales y de diagnóstico, comentadas); `.gitignore` lo deja entrar. `documentation/configuration.md` suma las variables que no listaba | `jflow.py conformance` |
| M5 | `docker-compose.yml` en la raíz: el producto completo con solo Docker, sin credenciales. La identidad la da un proveedor falso (`deploy/test/fake-idp`) con los mismos endpoints y claims que Zitadel; S3 es MinIO, SMTP es Mailpit; la identidad de NATS y el estado de JetStream los generan los scripts de `deploy/nats/` dentro de contenedores; corre el auth-callout real (1.0.0). Los composes de servidor no cambiaron salvo las rutas | `docker compose down -v` y `make up` desde cero; cada servicio responde |
| M7 | Los jobs de chequeo del CI (`ci.yml` y los de test de `release.yml` y `dev-images.yml`) corren `make lint typecheck` y `make test-unit test-integration` | `jflow.py conformance` |
| M6 | `make typecheck` de web usa `tsconfig.typecheck.json`, con los tipos de vitest: los 167 errores de los tests pasan a 0. Un test se tipó mejor (`useDocsSearchHooks.test.tsx`, mismos valores) | `make typecheck` |
| M9 | Un test end to end por entrada, contra `make up` y con identidad real: api por HTTP (escribe por el bus y lee), core por NATS (a través del auth-callout), el documento compartido (un visitante abre un link válido y ve el documento), el gestor interno y el portal con Playwright. jiku-docs, que vive en otro repositorio, se reemplaza en local por un módulo falso (`deploy/test/fake-docs`) que se registra en el bus como el real | `make test-e2e` |

## Cargado en Jiku

| # | Título | Por qué |
|---|---|---|
| — | La api acepta tokens de cualquier proyecto de la instancia de Zitadel | Valida la firma sin emisor ni audiencia y toma los roles del claim general: un usuario de otro proyecto u organización con un rol del mismo nombre entra con ese rol (ACC-16) |
| — | Lecturas de la api sin chequeo de rol | Clientes, proyectos, objetivos, personas y ausencias con su reporte (con motivos de salud) los lee cualquier token válido, incluso un usuario de cliente o uno sin rol (CLI-09, PRY-05, PER-01, TAR-28, AUS-07, AUS-08) |
| — | El cliente ve adjuntos, comentarios y tareas internos | El chequeo de permiso por entidad ignora la visibilidad (ARC-21) |
| — | El cliente escribe por las rutas internas | Comenta requisitos internos y crea requisitos con cualquier estado y visibilidad por las rutas del gestor (REQ-35, REQ-36) |
| — | El access token llega al JavaScript del navegador | En web y en el portal, contra ADR-009: un XSS puede robarlo (ACC-17) |
| — | Subida de archivos sin tope real, con SVG e inline | La URL firmada no limita el tamaño real, se aceptan `.svg` y las descargas se sirven inline: un SVG con script se ejecuta al abrirlo (ARC-05) |
| — | Inyección SQL en el filtro por etiqueta de requisitos | `GET /api/requirements?tag=` arma SQL con el valor sin escapar la comilla (REQ-E16) |
| — | `LOG_ACCESS_TOKEN` imprime el token completo | Variable de depuración marcada «Sacar antes de mergear» que deja el token en los logs de web |
| — | Parámetros de ruta sin codificar en los handlers de Next | Un id con `..` codificado podría llevar el token del usuario a otra ruta de la api (sin verificar en ejecución) |
| — | Descarga de claves por pedido con un `kid` desconocido | Cada token con `kid` desconocido dispara hasta `KEY_SYNC_ATTEMPS` descargas del JWKS: amplificación sin autenticarse |
| — | Documento público del portal sin chequeo de proyecto | Abrir un documento público o su adjunto por id no verifica el permiso sobre el proyecto (DOC-19). A confirmar si es a propósito |
| — | `deploy/bus-inspect.sh` pasa el token por la línea de comandos | `--token "$TOKEN"` deja el bearer visible en `ps` y en el historial de la shell |
| — | Cerrar sesión no termina la sesión en el proveedor de identidad | El próximo ingreso es automático con la sesión que quedó viva en Zitadel. A confirmar si es a propósito |

## Bugs sospechados

No son de seguridad, así que no se cargaron en Jiku. La definición los documenta tal como funcionan hoy.

### B-01 Los adjuntos de proyecto nunca quedan vinculados

- **Qué pasa:** el uploader del detalle de proyecto crea el archivo, pero ningún comando vincula archivos de tipo `project`: nunca aparecen.
- **Por qué parece un error:** la pantalla ofrece subirlos.
- **Dónde:** ARC-15; `services/web/.../ProjectAttachmentsSection.tsx`.
- **Gravedad sugerida:** media: una función visible que no funciona.

### B-02 Las tareas con `stageId` no se pueden guardar

- **Qué pasa:** `POST`/`PATCH /objectives` reenvían `stageId` y core lo rechaza por campo no permitido.
- **Por qué parece un error:** las etapas se eliminaron (migración `20260808_01_remove_stages`) y la api quedó mandándolas.
- **Dónde:** TAR-E2.
- **Gravedad sugerida:** media.

### B-03 Los enlaces libres del proyecto siempre fallan

- **Qué pasa:** los pares clave/valor libres del formulario de proyecto los rechaza la api (400) al crear y core (`invalid_fields`) al editar.
- **Por qué parece un error:** el formulario los ofrece.
- **Dónde:** PRY.
- **Gravedad sugerida:** baja.

### B-04 Quitar el cliente de un proyecto no lo desvincula

- **Qué pasa:** en la edición de proyecto, vaciar el cliente no cambia nada.
- **Dónde:** PRY.
- **Gravedad sugerida:** baja.

### B-05 Las horas aceptan una tarea de otro proyecto

- **Qué pasa:** al cargar horas trabajadas no se valida que la tarea pertenezca al proyecto (se confirmó como error en la adopción).
- **Dónde:** HOR; `services/core/src/commands/times/worked-times.ts`.
- **Gravedad sugerida:** media: ensucia los reportes de horas.

### B-06 El tope diario de minutos se puede superar con cargas simultáneas

- **Qué pasa:** el tope de 1440 minutos por día se chequea y se inserta en la misma transacción, sin lock: dos cargas en paralelo lo superan.
- **Dónde:** GAR-03, GAR-04; `worked-times.ts:163-179`, `unworked-times.ts:66-91`.
- **Gravedad sugerida:** baja.

### B-07 El selector de días de horas ofrece días que no se pueden cargar

- **Qué pasa:** muestra los últimos 8 días hábiles; los lunes y martes el más viejo queda fuera de la ventana de 10 días y la carga falla.
- **Dónde:** HOR.
- **Gravedad sugerida:** baja.

### B-08 La ventana de borrado de ausencias usa otra hora que la de horas

- **Qué pasa:** el plazo de 10 días para borrar una ausencia cuenta desde su creación en la hora local del servidor; el de horas trabajadas cuenta desde la fecha del registro en UTC.
- **Dónde:** AUS, HOR.
- **Gravedad sugerida:** baja.

### B-09 El orden de los resueltos en el portal nunca se aplica

- **Qué pasa:** el portal manda `state[]`, así que el orden por fecha de resolución que la api aplica a los resueltos no se activa.
- **Dónde:** POR-06.
- **Gravedad sugerida:** baja.

### B-10 La api responde 500 con un `sort` inválido en el portal

- **Qué pasa:** `GET /opus/projects/{projid}/requirements` valida el cuerpo en vez de la query: `sort` llega sin validar al orden (un nombre de columna inexistente da 500) y `limit` no tiene tope.
- **Dónde:** POR; `opus-projects-projid-requirements-get.ts`.
- **Gravedad sugerida:** baja.

### B-11 Filtros de objetivos que no hacen lo que dicen

- **Qué pasa:** en `GET /objectives`, un `limit` mayor a 30 devuelve hasta 200 filas (a confirmar, ver abajo), `count=false` devuelve igual el total y el filtro `visibilityLevel` se acepta pero no se aplica.
- **Dónde:** TAR.
- **Gravedad sugerida:** baja.

### B-12 Las rutas desconocidas responden HTML

- **Qué pasa:** el manejador JSON de 404 de la api tiene la aridad equivocada y nunca corre: una ruta desconocida da el 404 HTML de Express. Un `:id` no numérico llega a la base y da 500.
- **Dónde:** `services/api/app.ts`.
- **Gravedad sugerida:** baja.

### B-13 Escrituras confirmadas que responden 500

- **Qué pasa:** los handlers que releen después de un comando exitoso no atrapan errores: si la lectura falla, el usuario ve un 500 aunque la escritura ya se hizo, y puede reintentarla y duplicarla. Además los comandos no son idempotentes y la respuesta espera la publicación en JetStream, que puede pasar el timeout de 5 s de la api.
- **Dónde:** CON; `services/core/src/bus/dispatcher.ts`.
- **Gravedad sugerida:** media.

### B-14 Core queda sordo después de un corte de NATS

- **Qué pasa:** el cliente de NATS usa 10 reintentos de reconexión y no maneja el cierre: tras un corte de unos 20 s el proceso sigue vivo pero ya no atiende.
- **Dónde:** `services/core/src/bus/host.ts`.
- **Gravedad sugerida:** media.

### B-15 Core no arranca con los composes de servidor

- **Qué pasa:** la imagen corre con `NODE_ENV=production`, el logger exige `LOGGER_*_PATH` y `deploy/docker-compose.yml` y `.dev.yml` no las pasan.
- **Dónde:** `deploy/docker-compose.yml`, `services/core/src/logger`.
- **Gravedad sugerida:** alta si se despliega con esos composes tal como están.

### B-16 Sin `KEY_SYNC_ATTEMPS` la api rechaza todos los tokens

- **Qué pasa:** la variable no tiene default en el código; vacía, ningún token valida (la documentación dice que solo apaga el reintento). Y el camino de error de `getKey` puede colgarse si la lista de claves no llega.
- **Dónde:** `services/api/lib/utils/auth-helper.ts`.
- **Gravedad sugerida:** baja (la imagen trae el default en `.env.defaults`).

### B-17 Composes y versiones fijadas que no funcionan

- **Qué pasa:** `deploy/.env.dist` fija `AUTH_CALLOUT_VERSION=0.1.0`, que rechaza el `rules.yaml` del repositorio (pide un campo `type`); `docker-compose.local.yml` usa una imagen de MinIO que ya no existe; `docker-compose.dev.yml` no arranca como se documenta (modo `mock` que api y core no pueden usar, sin creds ni MinIO); `NATS_EVENTS_VERSION` no llega a ningún contenedor; `services/api/run-ci-tests.sh` construye con el contexto equivocado.
- **Dónde:** `deploy/`.
- **Gravedad sugerida:** media.

### B-18 web: los errores del formulario de requisito no se muestran

- **Qué pasa:** los mensajes de validación se calculan y se descartan (`const [, setErrors]`).
- **Dónde:** `services/web`, formulario de requisitos.
- **Gravedad sugerida:** media.

### B-19 web: un 401 de la api no lleva al login

- **Qué pasa:** la redirección está en código que solo corre en el servidor; en el navegador la sesión vencida no lleva a `/login` (contra ADR-009).
- **Dónde:** `services/web/src/lib/axios.ts:54-59`.
- **Gravedad sugerida:** media.

### B-20 web y portal: errores tragados o cargas infinitas

- **Qué pasa:** `/projects/[id]` y `/clients/edit/[id]` quedan cargando para siempre si falla la api; las vistas de objetivos por proyecto y por responsable muestran una página vacía ante un error; el tablero del portal muestra columnas vacías ante 403/5xx sin aviso; las acciones de servidor de web pierden el código de error en producción.
- **Dónde:** `services/web`, `services/opus-web`.
- **Gravedad sugerida:** baja.

### B-21 Portal: links profundos que se pierden al entrar

- **Qué pasa:** el login no conserva la URL de destino: el link de un mail de notificación no lleva al requisito después de iniciar sesión.
- **Dónde:** ACC, NOT; `services/opus-web`.
- **Gravedad sugerida:** media: afecta a las notificaciones.

### B-22 Portal: detalles de la interfaz

- **Qué pasa:** la tarjeta del kanban oculta estado y prioridad si el requisito no tiene descripción; el nombre y tamaño de un adjunto probablemente se ven como «Archivo adjunto» (el HEAD sigue el 302 al bucket); el modal de alta puede mandar `projectId` 0; «Abrir» dice que abre otra pestaña y navega en la misma; la validación previa de archivos usa otra lista de extensiones (agrega ppt/pptx, saca svg/txt/csv).
- **Dónde:** `services/opus-web`.
- **Gravedad sugerida:** baja.

### B-23 Variables y comentarios que no corresponden al código

- **Qué pasa:** los composes pasan `LAST_WEEK_MISSING_HOURS_ENABLED`, `CURRENT_WEEK_MISSING_HOURS_ENABLED` y `CONSOLIDATED_HOURS_REMINDER_ENABLED`, que ningún código lee; comentarios desactualizados (`protocol.ts:94-111`, `authorize-caller.ts:77` cita `templates/api.yaml`, que no existe; `recipients.ts:69` dice que no hay índice único de suscriptores, y lo hay); `services/core/README.md` dice 20 comandos y 6 consultas (son 23 y 23); la documentación dice 95 migraciones (son 108); `docs/flows/adjuntos.md` describe una subida que ya no existe.
- **Dónde:** varios.
- **Gravedad sugerida:** baja.

### B-24 web: la barra de filtros de Proyectos se corta a 1280 px

- **Qué pasa:** en `/projects` del gestor, con una ventana de 1280 px de ancho, la fila de búsqueda y filtros desborda en horizontal y el botón «Nuevo proyecto» queda cortado en el borde.
- **Dónde:** PRY; `services/web`, página de proyectos (lo mostró la captura del test end to end).
- **Gravedad sugerida:** baja.

## Comportamientos a confirmar

Comportamientos que pueden ser intencionales o no, y que quedaron sin respuesta en la adopción. La
definición los documenta tal cual, sin decisión. Al especificar algo que los toque, conviene decidirlos.

| Comportamiento | Duda | IDs |
|---|---|---|
| En la lista de objetivos, un límite mayor a 30 devuelve hasta 200 filas | Si es un tope buscado o un error de `parseGetParams` (se respondió «No sé») | TAR |
| Un archivo se marca «subido» al vincularlo, sin comprobar que el objeto exista, y nada limpia los que nunca se vinculan | Si alcanza con confiar en el cliente (se respondió «No sé») | ARC |
| Un miembro del equipo (`user`) lee las horas trabajadas de cualquier persona | Si el equipo debe ver las horas de todos | HOR-07 |
| En el portal, suscribir acepta a cualquier usuario con permiso en el proyecto, no solo a uno mismo | Si el cliente puede suscribir a sus compañeros | POR-15 |
| El autor de un comentario recibe la notificación de su propio comentario por el canal directo | El código lo tolera con un comentario; no hay decisión registrada | NOT |

## Defaults de jiku flow que el producto no sigue

Los productos nuevos los siguen desde el inicio; este los sigue desde ahora en lo nuevo. Adecuar lo
existente es opcional: si se decide mantener uno a propósito, queda como decisión técnica al especificarlo.

| Default | Hoy | Cambio sugerido | Esfuerzo |
|---|---|---|---|
| Errores RFC 9457 (`application/problem+json`, `code` y `detail`) | `{ code, message }` propio, y algunos handlers `{ error }` | Un formato único de error en la api | Medio |
| Validación de la entrada en el borde, `400 validation_failed` con `errors` | Joi por ruta, con mensajes y códigos propios; algunas rutas validan el lugar equivocado | Error de validación con todos los campos | Medio |
| Configuración validada al arrancar | Parcial (`IDENTITY_URL`, `JIKU_PUBLIC_URL`, `CORE_TRUSTED_PUBLISHER_ID`, `OPUS_URL`) | Validar todas las variables obligatorias | Bajo |
| `GET /health` y `GET /health/ready` | No existen; las imágenes no tienen `HEALTHCHECK` | Agregarlos en api, core, web y opus-web | Bajo |
| OpenTelemetry (trazas, métricas, logs JSON con `trace_id`) | winston en texto, a archivos en producción | Instrumentar con el SDK oficial | Medio |
| Apagado ordenado ante `SIGTERM` | Solo core | Agregarlo en la api | Bajo |
| Rate limit en autenticación | Solo `/p/docs` | Límite en las rutas autenticadas | Bajo |
| Escáner de secretos y auditoría de dependencias en el CI | No hay | gitleaks y `npm audit` en `ci.yml` | Bajo |
| Contenedores sin root | api y core corren como root | Usuario sin privilegios en las imágenes | Bajo |
| CORS acotado | `*` en `/api` | Orígenes de los dos frontends | Bajo |
| Contrato validado por los tests | Los tests de contrato leen el texto del YAML; las respuestas no se validan contra el esquema | Validar respuestas contra OpenAPI/AsyncAPI en integración | Medio |
| OpenAPI 3.1 y AsyncAPI 3 | OpenAPI 3.0.3; tres contratos en AsyncAPI 2.6 (`def-check` no los lee) | Migrar los contratos | Medio |
| Identificadores UUIDv7 | Enteros secuenciales (`users.id` es el `sub` del proveedor) | Solo en entidades nuevas | — |
| Listas con cursor (`limit` + `cursor` → `{ items, nextCursor }`) | `limit` + `skip` y respuestas sin envoltorio en muchas rutas | Solo en operaciones nuevas | — |
| Convenciones del esquema (`text` + CHECK, `timestamptz`, `{nombre}_minutes`, enums `{tabla}_{columna}` en inglés, `[pii]` en comentarios, `updated_at` por trigger, FK indexadas) | `varchar(n)`, algunas fechas sin zona y como texto, enums con nombre de Sequelize y valores en castellano, sin comentarios, FK duplicadas y sin índice | Solo en tablas nuevas; limpiar FK e índices duplicados | Medio |
| Formato del código (`make fmt`) | 1405 archivos sin el formato de prettier | Correr `make fmt` una vez, en un commit aparte | Bajo |
| Nombres de tests con el ID que prueban | Ningún test lleva IDs (cobertura 0/505) | Agregarlos a medida que el trabajo nuevo los toque | — |

## Otras mejoras sugeridas

| Mejora | Por qué | Esfuerzo |
|---|---|---|
| Limpiar el esquema heredado: tablas `origins`, `resources`, `projects_objectives`, `worked_times_absence_migration_backup`, `project_status_updates`, `objectives_subscriptors`; seis enums sin uso; FK e índices duplicados; `objective_activity.changed_by` NOT NULL con FK `ON DELETE SET NULL` | Peso muerto que confunde y reglas contradictorias en la base | Medio |
| FK faltantes: `objectives.project_id`, `objective_activity.objective_id`, `projects.origin_id` | La integridad depende solo del código | Bajo |
| Escribir personas, personas de proyecto y permisos de proyecto desde el producto | Hoy se cargan a mano en la base | Alto |
| Limpieza de archivos que nunca se vincularon | Se acumulan en el bucket | Bajo |
| Tests para `packages/models` y `packages/zitadel-auth` | No tienen | Bajo |
| Tests del gestor para clientes, asignación de tiempo y `lib`; del portal para `middleware.ts` y los hooks de requisitos | Son las partes sin cobertura que ya señalaba ADR-013 | Medio |
| Un `actor` y un índice de búsqueda para las ausencias (`unworked_times.reason`) | Son datos de salud: hoy no hay registro de quién los lee | Medio |
| Reintentos del envío de notificaciones por fila | Un error de base en un lote reenvía el lote entero y las filas que llegan al máximo se borran sin rastro | Bajo |
| Pool de escritura de core separado del de notificaciones | El ciclo de notificaciones mantiene una transacción abierta mientras manda mails | Bajo |
| Limpiar los datos que dejan los tests end to end | Cada corrida agrega clientes, proyectos y permisos a la base de `make up`; con el tiempo el portal lista varios proyectos «Portal e2e …» | Bajo |
| Credenciales locales de `local/*-su.json` con permisos 600, y revocar la del rol `bus-observer` que ya no existe | Son claves reales en la máquina de desarrollo | Bajo |
| Documentación vieja de `docs/` (metodología anterior) | La definición pasó a `_jflow/`; `docs/` conserva rutas y datos desactualizados | Bajo |

## Contradicciones

- **ADR-009 contra el código:** la decisión dice que el token no sale del servidor; en web y en el
  portal llega al navegador (SEC-5). La definición registra lo que hace el código.
- **ADR-006 y ADR-008 contra el código:** describen tres capas de aislamiento (ruta, rol, entidad); el
  chequeo por entidad ignora la visibilidad (SEC-3), las lecturas de tareas no chequean rol (TAR-28)
  y el documento público del portal no chequea proyecto (DOC-19).
- **ADR-007 contra el código:** descartó que core tome al autor del subject; hoy core toma la autoría
  del caller del subject (CON-07).
- **ADR-013 reemplazado:** los tests ya no usan `sequelize.sync()`; corren sobre las migraciones
  (DEC-T28).
- **Mismo error, dos respuestas:** `requirement_not_found` de core se traduce a 400, pero la
  verificación previa de la api responde 404 antes; `objective_not_found` es 400 en todos lados.
