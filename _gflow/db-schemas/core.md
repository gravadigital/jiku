# Base de datos de core

## Base

| Aspecto | Valor |
|---|---|
| Servicio dueño | `core`: único escritor de datos de dominio, con la conexión del dueño (`POSTGRESQL_USER`). Sus consultas por el bus (`core.queries`) usan una segunda conexión con el rol de solo lectura (`POSTGRESQL_READ_USER`), sin modelos |
| Motor | PostgreSQL 15.4 (imagen `postgres:15.4-alpine3.18` en los tres compose) |
| Otros servicios que la usan | `api`: lee con el rol de solo lectura (`POSTGRESQL_USER` de la api) y corre las migraciones al arrancar con credenciales del dueño (`POSTGRESQL_MIGRATION_USER` / `_PASSWORD`, con caída a las de la api si faltan) |
| Migraciones | `api/db-upgrade/migrations/` (108 archivos JavaScript, `sequelize-cli`, configuración en `api/db-upgrade/config.js`, tabla de control `sequelize_meta`). Corren con `npm run upgrade-db` en cada arranque de la api (`built-start`); core no corre migraciones |
| Esquema de producción | Dump histórico cargado antes del primer arranque (`DUMP_FILE` en `deploy/.env`) más las migraciones posteriores. Las migraciones no construyen el esquema desde cero: la primera ya altera `objectives`, y ninguna crea `projects`, `objectives`, `people`, `people_objectives`, `projects_persons`, `worked_times`, `week_assigned_times`, `objective_activity`, `origins`, `resources` ni `project_status_updates` |
| Esquema de tests y `development` | `sequelize.sync()` de los modelos de `@jiku/models` (api y core, con `NODE_ENV` `testing` o `development`); no corre migraciones. Difiere del de producción: ver la última sección |
| Zona horaria | No se fija en la base. Las columnas de instante son `timestamptz` salvo `edited_at`; las fechas de horas y asignaciones se escriben como `YYYY-MM-DD` sobre columnas `timestamptz` |

Este documento describe el esquema de producción: el resultado de cargar el dump histórico (`local/dump.sql`, PostgreSQL 15.4, con migraciones hasta `20260729_01`) y aplicar las 14 migraciones restantes hasta `20260923_02`.

### Convenciones del esquema existente

| Aspecto | Cómo es |
|---|---|
| Nombres | Inglés, `snake_case`; tablas en plural salvo `requirement_activity` y `objective_activity`; las tablas de tareas se llaman `objectives` (en el bus, `tasks`) |
| Clave primaria | `integer` autoincremental (secuencia); `users.id` es `varchar(100)` con el `sub` de Zitadel; `notification_outbox.id` es `bigint`; las tablas intermedias usan PK compuesta. No hay UUID |
| Texto | `varchar(255)` (el `STRING` de Sequelize) o `varchar(n)`; `text` para descripciones y valores largos |
| Enums | Tipos nativos con valores en español (son los que viajan al front); nombres heredados de Sequelize (`enum_{tabla}_{columna}`) o explícitos de migración (`enum_requirement_*`, `file_byte_status`, `identity_type`, `retention_status`, `attachment_entity_type`). `notification_outbox.status` y `type` son `varchar` a propósito |
| Auditoría | `created_at` / `updated_at` `timestamptz` en todas las tablas salvo `notification_outbox` (solo `created_at`); los mantiene Sequelize, sin trigger. Su obligatoriedad y default varían por tabla |
| Referencias a usuario | `varchar(100)` (algunas `varchar(255)`) contra `users.id` |
| JSON | `jsonb`, salvo `projects.key_value_pairs` (`json`) |
| Claves foráneas | `ON UPDATE CASCADE` y acciones `ON DELETE` mezcladas (cascade, set null, restrict o ninguna), detalladas en cada `Ref` |
| Datos personales | Marcados en este documento; las migraciones no escriben `COMMENT ON COLUMN` |
| Lógica en la base | Ninguna función ni trigger. La lógica tipo trigger son hooks de Sequelize (`@BeforeUpdate` de `requirements` y `objectives`, `@BeforeDestroy` de `attachments`) que solo corren al escribir con el ORM, es decir, en core |
| Extensiones | `pg_trgm` (creada por la migración `20260923_02` con `IF NOT EXISTS`) |

## Decisiones del esquema

| Decisión | Valor |
|---|---|
| Concurrencia | No aplica: no hay columna `version` ni bloqueos de fila en los comandos; aislamiento READ COMMITTED (default). El único bloqueo explícito es `FOR UPDATE SKIP LOCKED` al tomar el lote de `notification_outbox` |
| Multi-tenancy | No aplica: una sola organización. El aislamiento de los clientes en el portal es por `user_project_permissions` |
| Historial | Actividad de requisito y Actividad de tarea (`requirement_activity`, `objective_activity`): cambios de campos y comentarios, escritos por core en la misma transacción que el cambio. Nada más: sin auditoría por trigger ni log de eventos en la base |
| Borrado | No aplica `deleted_at` en uso: el borrado es físico. `attachments.deleted_at`/`deleted_by` y `files.deleted_at`/`deleted_by`/`retention_status` existen pero ningún proceso los escribe |
| Moneda | No aplica: no hay atributos de dinero |
| Tokens reentregados | No aplica: no se guardan tokens; las URLs firmadas de subida y descarga se generan a demanda y no se persisten |

## Esquema

```dbml
// ---------- Enums (nombres de producción) ----------
// Tipos sin uso que quedan en la base de producción: enum_requirements_type, enum_requirements_priority,
// enum_requirements_state, enum_requirement_activity_type_of_activity, enum_unworked_reason,
// enum_objective_changes_type_of_change (restos de migraciones que crearon un tipo y migraron la columna a otro).

Enum enum_projects_type {
  comercial [note: 'Proyecto.tipo: comercial']
  interno [note: 'Proyecto.tipo: interno']
  investigacion [note: 'Proyecto.tipo: investigación']
  propuesta [note: 'Proyecto.tipo: propuesta']
}

Enum enum_projects_status {
  analisis [note: 'Proyecto.estado: análisis']
  activo [note: 'Proyecto.estado: activo']
  inactivo [note: 'Proyecto.estado: inactivo']
  finalizado [note: 'Proyecto.estado: finalizado']
  cancelado [note: 'Proyecto.estado: cancelado']
}

Enum enum_requirement_type {
  funcionalidad [note: 'Requisito.tipo: funcionalidad']
  mejora [note: 'Requisito.tipo: mejora']
  incidencia [note: 'Requisito.tipo: incidencia']
  otro [note: 'Requisito.tipo: otro']
}

Enum enum_requirement_priority {
  sin_prioridad [note: 'Requisito.prioridad: sin prioridad']
  baja [note: 'Requisito.prioridad: baja']
  media [note: 'Requisito.prioridad: media']
  alta [note: 'Requisito.prioridad: alta']
  urgente [note: 'Requisito.prioridad: urgente']
}

Enum enum_requirement_state {
  analisis [note: 'Requisito.estado: análisis']
  planificacion [note: 'Requisito.estado: planificación']
  desarrollo [note: 'Requisito.estado: desarrollo']
  revision [note: 'Requisito.estado: revisión']
  resuelto [note: 'Requisito.estado: resuelto']
  cancelado [note: 'Requisito.estado: cancelado']
  en_cola [note: 'Requisito.estado: en cola (agregado al final del tipo)']
}

Enum enum_requirement_resolution {
  error_interno [note: 'Requisito.tipo de resolución: error interno']
  fuera_de_alcance [note: 'Requisito.tipo de resolución: fuera de alcance']
  error_externo [note: 'Requisito.tipo de resolución: error externo']
  discutible [note: 'Requisito.tipo de resolución: discutible']
  otro [note: 'Requisito.tipo de resolución: otro']
}

Enum enum_requirements_visibility_level {
  public [note: 'Requisito.visibilidad: pública']
  internal [note: 'Requisito.visibilidad: interna']
}

Enum enum_requirement_activity_type {
  state [note: 'Actividad de requisito: cambio de estado']
  comment [note: 'Actividad de requisito: comentario']
  type [note: 'Actividad de requisito: cambio de tipo']
  priority [note: 'Actividad de requisito: cambio de prioridad']
  estimatedFinishDate [note: 'Actividad de requisito: cambio de fecha estimada']
  tag [note: 'Actividad de requisito: cambio de etiquetas']
  resolution [note: 'Actividad de requisito: resolución']
  title [note: 'Actividad de requisito: cambio de título']
  description [note: 'Actividad de requisito: cambio de descripción']
}

Enum enum_requirement_activity_visibility_level {
  public [note: 'Actividad de requisito.visibilidad: pública']
  internal [note: 'Actividad de requisito.visibilidad: interna']
}

Enum enum_objectives_state {
  backlog [note: 'Tarea.estado: backlog']
  activo [note: 'Tarea.estado: activo']
  finalizado [note: 'Tarea.estado: finalizado']
  cancelado [note: 'Tarea.estado: cancelado']
  en_revision [note: 'Tarea.estado: en revisión']
}

Enum enum_objectives_area {
  "diseño" [note: 'Tarea.área: diseño']
  desarrollo [note: 'Tarea.área: desarrollo']
  gestion [note: 'Tarea.área: gestión']
  investigacion [note: 'Tarea.área: investigación']
}

Enum enum_objectives_visibility_level {
  public [note: 'Tarea.visibilidad: pública']
  internal [note: 'Tarea.visibilidad: interna']
}

Enum enum_objective_activity_type_of_activity {
  title [note: 'Actividad de tarea: cambio de título']
  state [note: 'Actividad de tarea: cambio de estado']
  area [note: 'Actividad de tarea: cambio de área']
  comment [note: 'Actividad de tarea: comentario']
  description [note: 'Actividad de tarea: cambio de descripción']
  person [note: 'Actividad de tarea: cambio de responsables']
  priority [note: 'Actividad de tarea: cambio de prioridad']
  estimatedFinishDate [note: 'Actividad de tarea: cambio de fecha estimada']
  stageId [note: 'Legado: etapa, ya no se escribe']
}

Enum enum_objective_activity_visibility_level {
  public [note: 'Actividad de tarea.visibilidad: pública']
  internal [note: 'Actividad de tarea.visibilidad: interna']
}

Enum enum_unworked_times_reason {
  tramite [note: 'Ausencia.motivo: trámite']
  corte_servicios [note: 'Ausencia.motivo: corte de servicios']
  vacaciones [note: 'Ausencia.motivo: vacaciones']
  dia_no_laborable [note: 'Ausencia.motivo: día no laborable']
  personal [note: 'Ausencia.motivo: personal']
  medico [note: 'Ausencia.motivo: médico']
  estudio [note: 'Ausencia.motivo: estudio']
  enfermedad [note: 'Ausencia.motivo: enfermedad']
  otro [note: 'Ausencia.motivo: otro']
}

Enum file_byte_status {
  pending [note: 'Archivo.estado de los bytes: pendiente']
  uploaded [note: 'Archivo.estado de los bytes: subido']
}

Enum retention_status {
  active [note: 'Archivo.estado de retención: activo']
  scheduled_for_deletion [note: 'Archivo.estado de retención: programado para borrar (sin escritor)']
  deleted [note: 'Archivo.estado de retención: borrado (sin escritor)']
}

Enum attachment_entity_type {
  objective [note: 'Adjunto.tipo de entidad: tarea']
  project [note: 'Adjunto.tipo de entidad: proyecto (sin escritor)']
  stage [note: 'Legado: etapa']
  comment [note: 'Legado: comentario sin separar']
  comment_draft [note: 'Legado: borrador']
  objective_draft [note: 'Legado: borrador']
  requirement_draft [note: 'Legado: borrador']
  requirement [note: 'Adjunto.tipo de entidad: requisito']
  objective_comment [note: 'Adjunto.tipo de entidad: comentario de tarea']
  requirement_comment [note: 'Adjunto.tipo de entidad: comentario de requisito']
  objective_comment_draft [note: 'Legado: borrador']
  requirement_comment_draft [note: 'Legado: borrador']
}

Enum identity_type {
  person [note: 'Usuario.tipo de identidad: persona']
  service [note: 'Usuario.tipo de identidad: servicio']
}

// ---------- core.clients ----------

Table clients {
  id integer [pk, increment]
  name varchar(255) [not null, note: 'nombre']
  description text [note: 'descripción']
  created_at timestamptz [note: 'Técnica: auditoría (nulable)']
  updated_at timestamptz [note: 'Técnica: auditoría (nulable)']
  Note: 'Entidad: Cliente — organización para la que se trabaja ("actor" en la interfaz)'
}

// ---------- core.projects ----------

Table projects {
  id integer [pk, increment]
  code varchar(255) [note: 'código (obligatorio en el alta; nulable en la base)']
  name varchar(255) [note: 'nombre (obligatorio en el alta; nulable en la base)']
  type enum_projects_type [not null, note: 'tipo']
  description text [note: 'descripción']
  status enum_projects_status [note: 'estado (nulable y sin default en la base; core pone analisis)']
  init_date timestamptz [not null, note: 'fecha de inicio']
  end_date timestamptz [note: 'fecha de fin']
  priority integer [default: 0, note: 'prioridad (sin escritor)']
  origin_id integer [note: 'origen: legado, sin FK hacia origins']
  created_at timestamptz [not null, note: 'Técnica: auditoría']
  updated_at timestamptz [not null, note: 'Técnica: auditoría']
  created_by varchar(255) [not null, note: 'creador']
  client_id integer [note: 'cliente']
  key_value_pairs json [note: 'propiedades: lista {code, value}; json, no jsonb']
  ticket_slug varchar(255) [note: 'identificador de tickets (INV-17, índice parcial); sin escritor']
  indexes {
    client_id [name: 'idx_projects_client_id']
    (client_id, name, id) [name: 'idx_projects_client_name_id']
  }
  Note: 'Entidad: Proyecto'
}

Table projects_persons {
  project_id integer [pk, note: 'proyecto']
  person_id integer [pk, note: 'persona del proyecto']
  created_at timestamptz [not null, note: 'Técnica: auditoría']
  updated_at timestamptz [not null, note: 'Técnica: auditoría']
  Note: 'Entidad: Proyecto — personas del proyecto; sin escritor, solo se lee'
}

Table user_project_permissions {
  id integer [pk, increment]
  user_id varchar(100) [not null, note: 'usuario']
  project_id integer [not null, note: 'proyecto']
  created_at timestamptz [not null, default: `CURRENT_TIMESTAMP`, note: 'Técnica: auditoría']
  updated_at timestamptz [not null, default: `CURRENT_TIMESTAMP`, note: 'Técnica: auditoría']
  indexes {
    (user_id, project_id) [unique, name: 'uk_user_project_permissions', note: 'INV-02']
  }
  Note: 'Entidad: Permiso de proyecto — sin escritor en el producto'
}

Ref: projects.client_id > clients.id [update: cascade, delete: set null]
Ref: projects.created_by > users.id [update: cascade, delete: set null] // la FK está duplicada (projects_created_by_fkey y _fkey1)
Ref: projects_persons.project_id > projects.id [update: cascade, delete: cascade]
Ref: projects_persons.person_id > people.id [update: cascade, delete: cascade]
Ref: user_project_permissions.user_id > users.id [update: cascade, delete: cascade]
Ref: user_project_permissions.project_id > projects.id [update: cascade, delete: cascade]

// ---------- core.requirements ----------

Table requirements {
  id integer [pk, increment]
  title varchar(255) [not null, note: 'título']
  description text [not null, note: 'descripción']
  type enum_requirement_type [note: 'tipo']
  priority enum_requirement_priority [not null, default: 'sin_prioridad', note: 'prioridad']
  state enum_requirement_state [not null, note: 'estado (sin default en la base; core pone analisis)']
  estimated_finish_date date [note: 'fecha estimada de finalización']
  tags jsonb [note: 'etiquetas: lista {key, value}']
  created_by varchar(100) [not null, note: 'creador']
  created_at timestamptz [not null, default: `CURRENT_TIMESTAMP`, note: 'Técnica: auditoría']
  updated_at timestamptz [not null, default: `CURRENT_TIMESTAMP`, note: 'Técnica: auditoría']
  project_id integer [not null, note: 'proyecto (INV-01)']
  scheduled_at timestamptz [note: 'planificado en (derivado)']
  in_progress_at timestamptz [note: 'en desarrollo desde (derivado)']
  in_review_at timestamptz [note: 'en revisión desde (derivado)']
  finished_at timestamptz [note: 'resuelto en (derivado)']
  visibility_level enum_requirements_visibility_level [not null, default: 'public', note: 'visibilidad']
  resolution_conclusion text [note: 'conclusión de resolución']
  scope text [note: 'alcance']
  technical_solution text [note: 'solución técnica']
  acceptance_criteria text [note: 'criterios de aceptación']
  resolution_type enum_requirement_resolution [note: 'tipo de resolución']
  resolution_comment text [note: 'comentario de resolución']
  indexes {
    created_by [name: 'idx_requirements_created_by']
    project_id [name: 'idx_requirements_project_id']
    state [name: 'idx_requirements_state']
  }
  Note: 'Entidad: Requisito'
}

Table people_requirements {
  person_id integer [pk, note: 'responsable (INV-10)']
  requirement_id integer [pk, note: 'requisito']
  is_leader boolean [note: 'líder: true en el primero, null en el resto (INV-11)']
  created_at timestamptz [not null, default: `now()`, note: 'Técnica: auditoría']
  updated_at timestamptz [not null, default: `now()`, note: 'Técnica: auditoría']
  indexes {
    (person_id, requirement_id) [name: 'idx_people_requirements_person_requirement']
    requirement_id [name: 'idx_people_requirements_requirement_id']
  }
  Note: 'Entidad: Requisito — responsables'
}

Table requirement_activity {
  id integer [pk, increment]
  type_of_activity enum_requirement_activity_type [not null, note: 'tipo de actividad']
  previous_value text [not null, note: 'valor anterior']
  new_value text [not null, note: 'valor nuevo / texto del comentario']
  visibility_level enum_requirement_activity_visibility_level [not null, default: 'internal', note: 'visibilidad']
  requirement_id integer [not null, note: 'requisito']
  changed_by varchar(100) [not null, note: 'autor']
  created_at timestamptz [not null, default: `CURRENT_TIMESTAMP`, note: 'Técnica: auditoría']
  updated_at timestamptz [not null, default: `CURRENT_TIMESTAMP`, note: 'Técnica: auditoría']
  edited_at timestamp [note: 'editado en (timestamp sin zona)']
  edited_by varchar(100) [note: 'editado por']
  indexes {
    (requirement_id, type_of_activity, created_at, id) [name: 'idx_requirement_activity_entity_type_created_id']
    requirement_id [name: 'idx_requirement_activity_requirement_id']
  }
  Note: 'Entidad: Actividad de requisito — historial y comentarios'
}

Table requirement_subscriptors {
  id integer [pk, increment]
  requirement_id integer [not null, note: 'requisito']
  user_id varchar(100) [not null, note: 'usuario']
  created_at timestamptz [not null, default: `now()`, note: 'Técnica: auditoría']
  updated_at timestamptz [not null, default: `now()`, note: 'Técnica: auditoría']
  indexes {
    requirement_id [name: 'idx_requirement_subscriptors_requirement_id']
    user_id [name: 'idx_requirement_subscriptors_user_id']
    (requirement_id, user_id) [unique, name: 'idx_requirement_subscriptors_unique', note: 'INV-03']
  }
  Note: 'Entidad: Suscripción a requisito'
}

Ref: requirements.project_id > projects.id [update: cascade, delete: restrict]
Ref: requirements.created_by > users.id [update: cascade, delete: restrict]
Ref: people_requirements.person_id > people.id // sin acciones (NO ACTION)
Ref: people_requirements.requirement_id > requirements.id // sin acciones (NO ACTION)
Ref: requirement_activity.requirement_id > requirements.id [update: cascade, delete: cascade]
Ref: requirement_activity.changed_by > users.id [update: cascade, delete: restrict]
Ref: requirement_activity.edited_by > users.id
Ref: requirement_subscriptors.requirement_id > requirements.id [delete: cascade]
Ref: requirement_subscriptors.user_id > users.id [delete: restrict]

// ---------- core.tasks ----------

Table objectives {
  id integer [pk, increment]
  title varchar(255) [not null, note: 'título']
  estimated_finish_date varchar(255) [note: 'fecha estimada de finalización (texto YYYY-MM-DD)']
  state enum_objectives_state [note: 'estado (nulable y sin default en la base; core pone backlog)']
  priority integer [not null, note: 'prioridad 0-5']
  created_at timestamptz [not null, note: 'Técnica: auditoría']
  updated_at timestamptz [not null, note: 'Técnica: auditoría']
  project_id integer [note: 'proyecto (INV-04): nulable y sin FK en producción']
  area enum_objectives_area [not null, note: 'área']
  created_by varchar(255) [not null, note: 'creador']
  description text [note: 'descripción']
  finished_at timestamptz [note: 'finalizada en (derivado)']
  visibility_level enum_objectives_visibility_level [not null, default: 'public', note: 'visibilidad']
  requirement_id integer [note: 'requisito (INV-05)']
  indexes {
    requirement_id [name: 'idx_objectives_requirement_id']
  }
  Note: 'Entidad: Tarea (tasks en el bus)'
}

Table people_objectives {
  is_leader boolean [note: 'líder: true en el primero, false en el resto (INV-11)']
  active boolean [note: 'sin escritor']
  person_id integer [pk, note: 'responsable (INV-10)']
  objective_id integer [pk, note: 'tarea']
  created_at timestamptz [not null, note: 'Técnica: auditoría']
  updated_at timestamptz [not null, note: 'Técnica: auditoría']
  indexes {
    objective_id [name: 'idx_people_objectives_objective_id']
    (person_id, objective_id) [name: 'idx_people_objectives_person_objective']
  }
  Note: 'Entidad: Tarea — responsables. La PK compuesta viene del dump histórico, no de una migración'
}

Table objective_activity {
  id integer [pk, increment]
  type_of_activity enum_objective_activity_type_of_activity [note: 'tipo de actividad (nulable en producción)']
  previous_value text [note: 'valor anterior (nulable en producción)']
  new_value text [note: 'valor nuevo / texto del comentario (nulable en producción)']
  objective_id integer [not null, note: 'tarea: sin FK en producción']
  created_at timestamptz [note: 'Técnica: auditoría (nulable)']
  updated_at timestamptz [note: 'Técnica: auditoría (nulable)']
  changed_by varchar(255) [not null, note: 'autor']
  visibility_level enum_objective_activity_visibility_level [not null, default: 'internal', note: 'visibilidad']
  edited_at timestamp [note: 'editado en (timestamp sin zona)']
  edited_by varchar(100) [note: 'editado por']
  indexes {
    (objective_id, type_of_activity, created_at, id) [name: 'idx_objective_activity_entity_type_created_id']
  }
  Note: 'Entidad: Actividad de tarea — historial y comentarios. La PK se llama objective_changes_pkey (tabla renombrada)'
}

Table objectives_subscriptors {
  id integer [pk, increment]
  objective_id integer [not null, note: 'tarea']
  user_id varchar(100) [not null, note: 'usuario']
  created_at timestamptz [note: 'Técnica: auditoría (nulable)']
  updated_at timestamptz [note: 'Técnica: auditoría (nulable)']
  Note: 'Entidad: Suscripción a tarea — sin escritor, solo se lee'
}

Ref: objectives.created_by > users.id [update: cascade, delete: set null] // duplicada (objectives_created_by_fkey y _fkey1); set null sobre columna NOT NULL
Ref: objectives.requirement_id > requirements.id [update: cascade, delete: set null]
Ref: people_objectives.person_id > people.id [update: cascade, delete: cascade]
Ref: people_objectives.objective_id > objectives.id [update: cascade, delete: cascade]
Ref: objective_activity.changed_by > users.id [update: cascade, delete: set null] // duplicada (objective_changes_changed_by_fkey y _fkey1); set null sobre columna NOT NULL
Ref: objective_activity.edited_by > users.id
Ref: objectives_subscriptors.objective_id > objectives.id [update: cascade, delete: cascade]
Ref: objectives_subscriptors.user_id > users.id [update: cascade, delete: cascade]

// ---------- core.times ----------

Table worked_times {
  id integer [pk, increment]
  date timestamptz [note: 'fecha (se escribe YYYY-MM-DD; nulable en la base)']
  minutes integer [note: 'minutos (INV-08; nulable en la base)']
  project_id integer [note: 'proyecto (nulable en la base)']
  person_id integer [note: 'persona (nulable en la base)']
  created_at timestamptz [not null, note: 'Técnica: auditoría']
  updated_at timestamptz [not null, note: 'Técnica: auditoría']
  objective_id integer [note: 'tarea (INV-07)']
  requirement_id integer [note: 'requisito (INV-06, INV-07)']
  indexes {
    objective_id [name: 'idx_worked_times_objective_id']
    requirement_id [name: 'idx_worked_times_requirement_id']
  }
  Note: 'Entidad: Hora trabajada'
}

Table unworked_times {
  id integer [pk, increment]
  date date [not null, note: 'fecha']
  minutes integer [not null, note: 'minutos (INV-09)']
  reason enum_unworked_times_reason [not null, note: 'motivo · dato personal']
  person_id integer [not null, note: 'persona']
  created_at timestamptz [not null, note: 'Técnica: auditoría; también regla de borrado (diez días)']
  updated_at timestamptz [not null, note: 'Técnica: auditoría']
  indexes {
    (person_id, date) [name: 'idx_unworked_person_date']
    (person_id, date, id) [name: 'idx_unworked_times_person_date_id']
  }
  Note: 'Entidad: Ausencia'
}

Table week_assigned_times {
  id integer [pk, increment]
  date_from timestamptz [note: 'desde: lunes (INV-20; se escribe YYYY-MM-DD)']
  date_to timestamptz [note: 'hasta: viernes (derivado)']
  internal boolean [note: 'interna (derivado del tipo del proyecto)']
  minutes integer [note: 'minutos']
  project_id integer [note: 'proyecto']
  person_id integer [note: 'persona']
  created_at timestamptz [not null, note: 'Técnica: auditoría']
  updated_at timestamptz [not null, note: 'Técnica: auditoría']
  indexes {
    (person_id, date_from, id) [name: 'idx_week_assigned_times_person_datefrom_id']
  }
  Note: 'Entidad: Asignación semanal'
}

Ref: worked_times.project_id > projects.id [update: cascade, delete: cascade]
Ref: worked_times.person_id > people.id [update: cascade, delete: cascade]
Ref: worked_times.objective_id > objectives.id [update: cascade, delete: set null]
Ref: worked_times.requirement_id > requirements.id [delete: set null]
Ref: unworked_times.person_id > people.id [update: cascade, delete: restrict]
Ref: week_assigned_times.project_id > projects.id [update: cascade, delete: cascade]
Ref: week_assigned_times.person_id > people.id [update: cascade, delete: cascade]

// ---------- core.files ----------

Table files {
  id integer [pk, increment]
  file_name varchar(255) [not null, note: 'nombre']
  file_size integer [not null, note: 'tamaño (bytes)']
  mime_type varchar(100) [not null, note: 'tipo MIME']
  storage_key varchar(500) [not null, unique, note: 'clave de almacenamiento (INV-12); constraint files_storage_key_key']
  storage_bucket varchar(100) [not null, note: 'bucket']
  storage_region varchar(50) [not null, note: 'región']
  checksum varchar(64) [note: 'checksum (no se verifica)']
  byte_status file_byte_status [not null, default: 'pending', note: 'estado de los bytes (INV-14)']
  uploaded_by varchar(100) [not null, note: 'subido por (INV-15)']
  retention_status retention_status [not null, default: 'active', note: 'estado de retención']
  deleted_at timestamptz [note: 'borrado en (sin escritor)']
  deleted_by varchar(100) [note: 'borrado por (sin escritor)']
  created_at timestamptz [not null, default: `CURRENT_TIMESTAMP`, note: 'Técnica: auditoría']
  updated_at timestamptz [not null, default: `CURRENT_TIMESTAMP`, note: 'Técnica: auditoría']
  indexes {
    (uploaded_by, byte_status) [name: 'idx_files_uploader_byte_status']
  }
  Note: 'Entidad: Archivo'
}

Table attachments {
  id integer [pk, increment]
  entity_type attachment_entity_type [not null, note: 'tipo de entidad']
  entity_id integer [not null, note: 'entidad (polimórfica, sin FK) (INV-13)']
  deleted_at timestamptz [note: 'vestigial: desvincular borra la fila']
  deleted_by varchar(100) [note: 'vestigial']
  created_at timestamptz [not null, default: `CURRENT_TIMESTAMP`, note: 'Técnica: auditoría']
  updated_at timestamptz [not null, default: `CURRENT_TIMESTAMP`, note: 'Técnica: auditoría']
  file_id integer [not null, note: 'archivo (INV-13, INV-16)']
  indexes {
    (entity_type, entity_id, deleted_at) [name: 'idx_attachments_entity']
    file_id [name: 'idx_attachments_file_id']
  }
  Note: 'Entidad: Adjunto'
}

Ref: files.uploaded_by > users.id [update: cascade, delete: restrict]
Ref: files.deleted_by > users.id [update: cascade, delete: set null]
Ref fk_attachments_file: attachments.file_id > files.id // sin acciones (NO ACTION): un archivo vinculado no se borra
Ref: attachments.deleted_by > users.id [update: cascade, delete: set null]

// ---------- core.identity ----------

Table users {
  id varchar(100) [pk, note: 'identificador: sub de Zitadel (INV-21) · dato personal']
  name varchar(255) [not null, note: 'nombre · dato personal']
  username varchar(255) [not null, note: 'nombre de usuario · dato personal']
  email varchar(255) [note: 'email (nulo para identidades de servicio) · dato personal']
  created_at timestamptz [note: 'Técnica: auditoría (nulable)']
  updated_at timestamptz [note: 'Técnica: auditoría (nulable)']
  roles jsonb [not null, default: `'[]'::jsonb`, note: 'roles: lista de strings']
  identity_type identity_type [not null, default: 'person', note: 'tipo de identidad']
  Note: 'Entidad: Usuario — espejo de las identidades de Zitadel'
}

Table people {
  id integer [pk, increment]
  first_name varchar(255) [not null, note: 'nombre · dato personal']
  last_name varchar(255) [not null, note: 'apellido · dato personal']
  enabled boolean [not null, default: true, note: 'habilitada']
  init_date timestamptz [not null, note: 'fecha de ingreso']
  end_date timestamptz [note: 'fecha de egreso']
  created_at timestamptz [not null, note: 'Técnica: auditoría']
  updated_at timestamptz [not null, note: 'Técnica: auditoría']
  user_id varchar(100) [note: 'usuario']
  must_charge_worked_time boolean [not null, default: true, note: 'debe cargar horas']
  Note: 'Entidad: Persona — sin escritor en el producto'
}

Ref: people.user_id > users.id [update: cascade, delete: set null]

// ---------- core.notifications ----------

Table notification_outbox {
  id bigint [pk, increment]
  type varchar(100) [not null, note: 'tipo']
  channel varchar(20) [not null, default: 'email', note: 'canal']
  recipient_user_id varchar(100) [not null, note: 'destinatario']
  recipient_email varchar(255) [not null, note: 'email del destinatario · dato personal']
  payload jsonb [not null, note: 'contenido (incluye el nombre del actor) · dato personal']
  status varchar(20) [not null, default: 'pending', note: 'estado: pending | sent']
  attempts integer [not null, default: 0, note: 'intentos']
  next_attempt_at timestamptz [not null, default: `now()`, note: 'próximo intento']
  last_error text [note: 'último error']
  created_at timestamptz [not null, default: `now()`, note: 'Técnica: auditoría (solo alta)']
  sent_at timestamptz [note: 'enviada en']
  Note: 'Entidad: Notificación pendiente — cola de salida de mails (INV-19)'
}

Ref: notification_outbox.recipient_user_id > users.id [update: cascade]

// ---------- core.settings ----------

Table system_settings {
  id integer [pk, increment]
  key varchar(255) [not null, unique, note: 'clave (INV-18); constraint system_settings_key_key']
  value text [not null, note: 'valor']
  created_at timestamptz [not null, default: `CURRENT_TIMESTAMP`, note: 'Técnica: auditoría']
  updated_at timestamptz [not null, default: `CURRENT_TIMESTAMP`, note: 'Técnica: auditoría']
  Note: 'Entidad: Ajuste del sistema — filas sembradas por migraciones'
}

// ---------- Legado: tablas sin uso de producto ----------
// origins, resources y project_status_updates tienen modelo en @jiku/models pero ninguna ruta, comando ni
// consulta las usa. projects_objectives y worked_times_absence_migration_backup existen solo en la base de
// producción (vienen del dump histórico), sin modelo ni migración que las cree o las use.

Table origins {
  id integer [pk, increment]
  reference integer
  name varchar(255)
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Note: 'Técnica: legado sin uso; projects.origin_id la nombra sin FK'
}

Table resources {
  id integer [pk, increment]
  key varchar(255)
  value varchar(255)
  project_id integer
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Note: 'Técnica: legado sin uso'
}

Table project_status_updates {
  id integer [pk, increment]
  status varchar(255) [not null]
  update_date timestamptz [not null]
  comment varchar(255) [not null]
  project_id integer
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Note: 'Técnica: legado sin uso'
}

Table projects_objectives {
  project_id integer [pk]
  objective_id integer [pk]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Note: 'Técnica: legado del dump histórico (vínculo tarea-proyecto anterior a objectives.project_id); sin modelo'
}

Table worked_times_absence_migration_backup {
  migration_tag text [pk]
  worked_time_id integer [pk]
  backed_up_at timestamptz [not null, default: `now()`]
  date timestamptz [not null]
  minutes integer [not null]
  project_id integer [not null]
  person_id integer [not null]
  created_at timestamptz
  updated_at timestamptz
  objective_id integer
  Note: 'Técnica: respaldo de una migración de datos anterior, del dump histórico; sin modelo'
}

Ref: resources.project_id > projects.id [update: cascade, delete: cascade]
Ref: project_status_updates.project_id > projects.id [update: cascade]
Ref: projects_objectives.project_id > projects.id [update: cascade, delete: cascade]
Ref: projects_objectives.objective_id > objectives.id [update: cascade, delete: cascade]
```

## Restricciones que DBML no expresa

| Nombre | Tabla | Tipo | Definición | Garantía |
|---|---|---|---|---|
| `pg_trgm` | — | extensión | `CREATE EXTENSION IF NOT EXISTS pg_trgm` (migración `20260923_02`) | — |
| `uk_projects_ticket_slug` | `projects` | índice único parcial | `UNIQUE (ticket_slug) WHERE ticket_slug IS NOT NULL` | INV-17 |
| `idx_notification_outbox_pending` | `notification_outbox` | índice parcial | `(next_attempt_at, id) WHERE status = 'pending'` | INV-19 |
| `idx_objectives_title_trgm` | `objectives` | GIN trigram | `USING gin (title gin_trgm_ops)`: búsqueda `ILIKE` de tareas | — |
| `idx_objectives_description_trgm` | `objectives` | GIN trigram | `USING gin (description gin_trgm_ops)` | — |
| `idx_requirements_tags_gin` | `requirements` | GIN | `USING gin (tags)`: filtro `tags @> …` | — |
| `idx_requirements_tags` | `requirements` | GIN | `USING gin (tags)`: duplicado del anterior (migración `20260515_01`) | — |
| `idx_objectives_created_id` | `objectives` | índice con orden | `(created_at DESC, id DESC)` | — |
| `idx_objectives_project_created_id` | `objectives` | índice con orden | `(project_id, created_at DESC, id DESC)` | — |
| `idx_objectives_priority_created_id` | `objectives` | índice con orden | `(priority DESC, created_at DESC, id DESC)` | — |
| `idx_objectives_state_created_id` | `objectives` | índice con orden | `(state, created_at DESC, id DESC)` | — |
| `idx_requirements_project_created_id` | `requirements` | índice con orden | `(project_id, created_at DESC, id DESC)` | — |
| `idx_requirements_state_created_id` | `requirements` | índice con orden | `(state, created_at DESC, id DESC)` | — |
| `idx_worked_times_date_id` | `worked_times` | índice con orden | `("date" DESC, id DESC)` | — |
| `idx_worked_times_person_date_id` | `worked_times` | índice con orden | `(person_id, "date" DESC, id DESC)` | — |
| `idx_worked_times_project_date_id` | `worked_times` | índice con orden | `(project_id, "date" DESC, id DESC)` | — |
| `people_objectives_pkey` | `people_objectives` | clave primaria | `PRIMARY KEY (person_id, objective_id)`: viene del dump histórico, ninguna migración la crea | INV-10 |
| `people_requirements_pkey` | `people_requirements` | clave primaria | `PRIMARY KEY (person_id, requirement_id)` (migración `20260703_01`) | INV-10 |
| `idx_requirement_subscriptors_unique` | `requirement_subscriptors` | índice único | `UNIQUE (requirement_id, user_id)` (migración `20260605_02`) | INV-03 |
| `uk_user_project_permissions` | `user_project_permissions` | índice único | `UNIQUE (user_id, project_id)` (migración `20260529_07`) | INV-02 |
| `fk_attachments_file` | `attachments` | clave foránea | `FOREIGN KEY (file_id) REFERENCES files(id)` sin `ON DELETE` (migración `20260819_05`) | INV-13 |
| Permisos del rol de solo lectura | todas | permiso | la api y las consultas de core conectan con un rol sin `INSERT`/`UPDATE`/`DELETE`; el rol lo crea la instalación, no una migración | — |
| Datos sembrados | `system_settings`, `users` | datos | claves de archivos (`20260819_05`), de notificaciones (`20260917_01`) y `hours_per_day` (`20260206_01`); usuario bot de mail (`20260703_05`) | — |

## Atributos derivados

| Entidad | Atributo | Se guarda | Por |
|---|---|---|---|
| Requisito | planificado en (`scheduled_at`) | sí | hook `@BeforeUpdate` del modelo, en core: primera entrada a `planificacion`; se expone en consultas y eventos |
| Requisito | en desarrollo desde (`in_progress_at`) | sí | ídem, primera entrada a `desarrollo` |
| Requisito | en revisión desde (`in_review_at`) | sí | ídem, primera entrada a `revision` |
| Requisito | resuelto en (`finished_at`) | sí | ídem, cada entrada a `resuelto`; va en el evento de resolución |
| Requisito | minutos trabajados | no | subconsulta sobre `worked_times` en la consulta de requisitos (`totalMinutes`) |
| Tarea | finalizada en (`finished_at`) | sí | hook `@BeforeUpdate` del modelo, en core: entrada a `finalizado` la fija, salida la limpia |
| Asignación semanal | hasta (`date_to`) | sí | core al reemplazar la semana: viernes de `date_from` |
| Asignación semanal | interna (`internal`) | sí | core al reemplazar la semana: tipo `interno` del proyecto en ese momento |

## Diferencias con el esquema del ORM (tests y `development`)

`sequelize.sync()` sobre `@jiku/models` genera otro esquema. Los tests de integración corren contra él, así que no ejercitan las restricciones de la columna "Producción".

| Punto | Producción (dump + migraciones) | ORM (`sync`) |
|---|---|---|
| Nombres de enums de requisitos | `enum_requirement_type`, `enum_requirement_priority`, `enum_requirement_state`, `enum_requirement_resolution`, `enum_requirement_activity_type` | `enum_requirements_type`, `enum_requirements_priority`, `enum_requirements_state`, `enum_requirements_resolution_type`, `enum_requirement_activity_type_of_activity` |
| `attachments.entity_type` | enum `attachment_entity_type` | `varchar(255)` |
| `files.byte_status`, `files.retention_status`, `users.identity_type` | enums `file_byte_status`, `retention_status`, `identity_type` | `varchar(255)` |
| `attachments.entity_id`, `attachments.file_id` | `NOT NULL`; FK a `files` sin `ON DELETE` | nulables; FK `ON DELETE SET NULL` |
| `requirements.state` | sin default | default `analisis` |
| `objectives.state` | nulable, sin default | `NOT NULL`, default `backlog` |
| `objectives.project_id` | nulable, sin FK | `NOT NULL`, FK a `projects` |
| `objective_activity.objective_id` | sin FK | FK a `objectives` `ON DELETE CASCADE` |
| `objective_activity.type_of_activity`, `previous_value`, `new_value` | nulables | `NOT NULL` |
| `projects.status` | nulable | `NOT NULL` |
| `user_project_permissions.project_id` | `NOT NULL` | nulable |
| `edited_at` de las dos tablas de actividad | `timestamp` sin zona | `timestamptz` |
| `projects.ticket_slug` | único parcial (`WHERE ticket_slug IS NOT NULL`) | único simple |
| Unicidad de `user_project_permissions (user_id, project_id)` y `requirement_subscriptors (requirement_id, user_id)` | existen | no existen |
| `objectives.requirement_id` | FK a `requirements` `ON DELETE SET NULL` | sin FK |
| FKs a `users` de `projects.created_by`, `objectives.created_by`, `objective_activity.changed_by` | duplicadas, `ON DELETE SET NULL` | una, sin `ON DELETE` |
| `ON DELETE` de `people_requirements`, `requirement_activity`, `requirement_subscriptors`, `objectives_subscriptors`, `user_project_permissions`, `unworked_times`, `files.uploaded_by` | ver los `Ref` del esquema | `NO ACTION`, salvo `people_requirements` (cascade) y `unworked_times` (cascade) |
| Defaults de `created_at` / `updated_at` y nulabilidad en `clients`, `users`, `objectives_subscriptors`, `objective_activity` | defaults `CURRENT_TIMESTAMP` / `now()` en las tablas creadas por migración; nulables en las cuatro nombradas | sin default de base; `NOT NULL` salvo `clients` |
| Índices | los de esta página (keyset, GIN, trigram, parciales) y la extensión `pg_trgm` | solo las PK, los únicos de `files.storage_key`, `system_settings.key`, `projects.ticket_slug` y el parcial `idx_notification_outbox_pending` |
| Tablas | además, `projects_objectives`, `worked_times_absence_migration_backup` y `sequelize_meta`; tipos enum sin uso | solo las de los 24 modelos |
