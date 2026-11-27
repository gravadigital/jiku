# Database: jiku

## Base
| Aspect | Value |
|---|---|
| Owner service | core (el único que escribe, con el rol dueño) |
| Engine | PostgreSQL 15 |
| Other services | api: lee con un rol de solo lectura (SELECT) y corre las migraciones al arrancar con credenciales propias (`POSTGRESQL_MIGRATION_USER`); core también lee por una segunda conexión con el rol de solo lectura (plano de consultas) |
| Migrations | `services/api/db-upgrade`: `baseline.js` aplica `baseline/schema.sql` sobre una base vacía (el esquema tras las migraciones de `baseline/applied-migrations.txt`) y después `sequelize-cli db:migrate` corre las 14 migraciones posteriores; registro en `sequelize_meta` |
| ORM | Sequelize; los modelos están en `packages/models` y los comparten api y core. Varios tipos del modelo difieren de la base (enums nativos declarados como texto en el modelo) |
| Extensions | `pg_trgm` (búsqueda de tareas por título y descripción) |
| Triggers and functions | Ninguno. Las marcas de tiempo de estado y el registro de actividad de requisitos y tareas los hacen hooks del ORM en core |
| Table comments | Ninguno: la base no tiene `COMMENT ON` |

## Schema decisions
| Decision | Value |
|---|---|
| Concurrency | No aplica: no hay columna de versión ni bloqueos de fila en los comandos; solo el envío de notificaciones toma filas con `FOR UPDATE SKIP LOCKED` |
| Multi-tenancy | No aplica: una instalación sirve a una sola organización; el aislamiento de clientes es por `user_project_permissions` |
| History | Actividad por entidad: `requirement_activity` y `objective_activity` (cambios de campo y comentarios). Las marcas de entrada a estados están en `requirements`. Los eventos de dominio salen por el bus, no se guardan |
| Deletion | Física. `files.deleted_at` y `attachments.deleted_at` existen pero ningún comando los escribe |
| Currency | No aplica: no hay dinero |
| Re-delivered tokens | No aplica: la base no guarda tokens |

## Schema

```dbml
// ---------- Enums ----------
Enum enum_projects_type {
  comercial [note: 'Proyecto: tipo comercial']
  interno [note: 'tipo interno']
  investigacion [note: 'tipo investigación']
  propuesta [note: 'tipo propuesta']
}
Enum enum_projects_status {
  analisis [note: 'estado analisis']
  activo [note: 'estado activo']
  inactivo [note: 'estado inactivo']
  finalizado [note: 'estado finalizado']
  cancelado [note: 'estado cancelado']
}
Enum enum_requirement_type {
  funcionalidad [note: 'Requisito: tipo funcionalidad']
  mejora [note: 'tipo mejora']
  incidencia [note: 'tipo incidencia']
  otro [note: 'tipo otro']
}
Enum enum_requirement_priority {
  sin_prioridad [note: 'Requisito: prioridad sin_prioridad']
  baja
  media
  alta
  urgente
}
Enum enum_requirement_state {
  analisis [note: 'Requisito: estado analisis']
  planificacion
  desarrollo
  revision
  resuelto
  cancelado
  en_cola
}
Enum enum_requirement_resolution {
  error_interno [note: 'Requisito: tipo de resolución']
  fuera_de_alcance
  error_externo
  discutible
  otro
}
Enum enum_requirements_visibility_level {
  public [note: 'Requisito: visibilidad pública']
  internal [note: 'visibilidad interna']
}
Enum enum_requirement_activity_type {
  state [note: 'Actividad de requisito: cambio de estado']
  comment [note: 'comentario']
  type [note: 'no lo escribe ningún comando']
  priority [note: 'no lo escribe ningún comando']
  estimatedFinishDate [note: 'no lo escribe ningún comando']
  tag [note: 'no lo escribe ningún comando']
  resolution [note: 'no lo escribe ningún comando']
  title [note: 'cambio de título']
  description [note: 'cambio de descripción']
}
Enum enum_requirement_activity_visibility_level {
  public
  internal
}
Enum enum_objectives_state {
  backlog [note: 'Tarea: estado backlog']
  activo
  finalizado
  cancelado
  en_revision
}
Enum enum_objectives_area {
  "diseño" [note: 'Tarea: área']
  desarrollo
  gestion
  investigacion
}
Enum enum_objectives_visibility_level {
  public
  internal
}
Enum enum_objective_activity_type_of_activity {
  title [note: 'Actividad de tarea: cambio de título']
  state
  area
  comment [note: 'comentario']
  description
  person [note: 'no lo escribe ningún comando']
  priority
  estimatedFinishDate
  stageId [note: 'legado de las etapas eliminadas']
}
Enum enum_objective_activity_visibility_level {
  public
  internal
}
Enum enum_unworked_times_reason {
  tramite [note: 'Ausencia: motivo']
  corte_servicios
  vacaciones
  dia_no_laborable
  personal
  medico
  estudio
  enfermedad
  otro
}
Enum identity_type {
  person [note: 'Usuario: identidad de persona']
  service [note: 'identidad de servicio']
}
Enum file_byte_status {
  pending [note: 'Archivo: estado del contenido pending']
  uploaded [note: 'uploaded']
}
Enum retention_status {
  active [note: 'Archivo: retención active']
  scheduled_for_deletion [note: 'ningún comando lo escribe']
  deleted [note: 'ningún comando lo escribe']
}
Enum attachment_entity_type {
  objective [note: 'Adjunto: tarea']
  project [note: 'proyecto']
  requirement [note: 'requisito']
  objective_comment [note: 'comentario de tarea']
  requirement_comment [note: 'comentario de requisito']
  stage [note: 'legado; ninguna fila']
  comment [note: 'legado; ninguna fila']
  comment_draft [note: 'legado; ninguna fila']
  objective_draft [note: 'legado; ninguna fila']
  requirement_draft [note: 'legado; ninguna fila']
  objective_comment_draft [note: 'legado; ninguna fila']
  requirement_comment_draft [note: 'legado; ninguna fila']
}
// Tipos sin ninguna columna que los use (legado): enum_objective_changes_type_of_change,
// enum_requirement_activity_type_of_activity, enum_requirements_priority, enum_requirements_state,
// enum_requirements_type, enum_unworked_reason.

// ---------- core.clients ----------
Table clients {
  id integer [pk, increment]
  name varchar(255) [not null, note: 'nombre']
  description text [note: 'descripción']
  created_at timestamptz
  updated_at timestamptz
  Note: 'Entity: Cliente — organización para la que trabaja el equipo'
}

// ---------- core.projects ----------
Table projects {
  id integer [pk, increment]
  code varchar(255) [note: 'código; obligatorio al crear, nulo en filas heredadas']
  name varchar(255) [note: 'nombre; obligatorio al crear, nulo en filas heredadas']
  type enum_projects_type [not null, note: 'tipo']
  description text [note: 'descripción']
  status enum_projects_status [note: 'estado']
  init_date timestamptz [not null, note: 'fecha de inicio']
  end_date timestamptz [note: 'fecha de fin']
  priority integer [default: 0, note: 'prioridad; ningún comando la escribe']
  origin_id integer [note: 'origen; referencia a origins SIN clave foránea']
  client_id integer [ref: > clients.id, note: 'cliente; ON UPDATE CASCADE ON DELETE SET NULL']
  key_value_pairs json [note: 'propiedades: objeto código→valor']
  ticket_slug varchar(255) [note: 'slug de tickets; legado, ningún comando lo escribe']
  created_by varchar(255) [not null, ref: > users.id, note: 'creado por; DOS FK idénticas (projects_created_by_fkey y _fkey1) ON UPDATE CASCADE ON DELETE SET NULL sobre una columna NOT NULL']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Indexes {
    client_id [name: 'idx_projects_client_id']
    (client_id, name, id) [name: 'idx_projects_client_name_id']
  }
  Note: 'Entity: Proyecto — trabajo del equipo para un cliente o para sí mismo'
}

Table projects_persons {
  project_id integer [pk, ref: > projects.id, note: 'ON UPDATE CASCADE ON DELETE CASCADE']
  person_id integer [pk, ref: > people.id, note: 'ON UPDATE CASCADE ON DELETE CASCADE']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Note: 'Entity: Proyecto — personas del proyecto; se lee, ningún comando la escribe'
}

Table project_status_updates {
  id integer [pk, increment]
  status varchar(255) [not null]
  update_date timestamptz [not null]
  comment varchar(255) [not null]
  project_id integer [ref: > projects.id, note: 'ON UPDATE CASCADE, ON DELETE NO ACTION']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Note: 'Entity: Proyecto — actualizaciones de estado; tabla legada que nada lee ni escribe'
}

Table user_project_permissions {
  id integer [pk, increment]
  user_id varchar(100) [not null, ref: > users.id, note: 'usuario; ON UPDATE CASCADE ON DELETE CASCADE']
  project_id integer [not null, ref: > projects.id, note: 'proyecto; ON UPDATE CASCADE ON DELETE CASCADE']
  created_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
  updated_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
  Indexes {
    (user_id, project_id) [unique, name: 'uk_user_project_permissions']
  }
  Note: 'Entity: Permiso de proyecto — habilitación de un usuario sobre un proyecto; se carga por fuera del producto'
}

Table origins {
  id integer [pk, increment]
  reference integer
  name varchar(255)
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Note: 'Technical: tabla legada; la consulta de proyectos la incluye como «origin» por projects.origin_id; nada la escribe'
}

Table resources {
  id integer [pk, increment]
  key varchar(255)
  value varchar(255)
  project_id integer [ref: > projects.id, note: 'ON UPDATE CASCADE ON DELETE CASCADE']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Note: 'Technical: tabla legada; tiene modelo pero nada la lee ni la escribe'
}

Table projects_objectives {
  project_id integer [pk, ref: > projects.id, note: 'ON UPDATE CASCADE ON DELETE CASCADE']
  objective_id integer [pk, ref: > objectives.id, note: 'ON UPDATE CASCADE ON DELETE CASCADE']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Note: 'Technical: tabla legada; sin modelo, nada la lee ni la escribe'
}

// ---------- core.people ----------
Table people {
  id integer [pk, increment]
  first_name varchar(255) [not null, note: 'nombre · dato personal']
  last_name varchar(255) [not null, note: 'apellido · dato personal']
  enabled boolean [not null, default: true, note: 'habilitada']
  init_date timestamptz [not null, note: 'fecha de ingreso']
  end_date timestamptz [note: 'fecha de egreso']
  must_charge_worked_time boolean [not null, default: true, note: 'debe cargar horas']
  user_id varchar(100) [ref: > users.id, note: 'usuario; ON UPDATE CASCADE ON DELETE SET NULL']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Note: 'Entity: Persona — integrante del equipo; se carga por fuera del producto'
}

// ---------- core.identity ----------
Table users {
  id varchar(100) [pk, note: 'identificador: el sub del proveedor de identidad']
  name varchar(255) [not null, note: 'nombre · dato personal']
  username varchar(255) [not null, note: 'nombre de usuario · dato personal']
  email varchar(255) [note: 'email · dato personal; nulo solo para identidades de servicio (regla de core, no de la base)']
  roles jsonb [not null, default: `'[]'::jsonb`, note: 'roles: lista de textos']
  identity_type identity_type [not null, default: 'person', note: 'tipo de identidad']
  created_at timestamptz
  updated_at timestamptz
  Note: 'Entity: Usuario — espejo de una identidad del proveedor de identidad'
}

// ---------- core.requirements ----------
Table requirements {
  id integer [pk, increment]
  title varchar(255) [not null, note: 'título']
  description text [not null, note: 'descripción']
  type enum_requirement_type [note: 'tipo de requisito; nulo = sin tipo']
  priority enum_requirement_priority [not null, default: 'sin_prioridad', note: 'prioridad']
  state enum_requirement_state [not null, note: 'estado; sin default en la base (analisis lo pone el modelo)']
  estimated_finish_date date [note: 'fecha estimada de finalización']
  tags jsonb [note: 'etiquetas: lista de {key, value}']
  created_by varchar(100) [not null, ref: > users.id, note: 'creado por; ON UPDATE CASCADE ON DELETE RESTRICT']
  project_id integer [not null, ref: > projects.id, note: 'proyecto; ON UPDATE CASCADE ON DELETE RESTRICT']
  scheduled_at timestamptz [note: 'fecha de planificación']
  in_progress_at timestamptz [note: 'fecha de inicio de desarrollo']
  in_review_at timestamptz [note: 'fecha de entrada a revisión']
  finished_at timestamptz [note: 'fecha de resolución']
  visibility_level enum_requirements_visibility_level [not null, default: 'public', note: 'visibilidad']
  scope text [note: 'alcance']
  technical_solution text [note: 'solución técnica']
  acceptance_criteria text [note: 'criterios de aceptación']
  resolution_type enum_requirement_resolution [note: 'tipo de resolución']
  resolution_conclusion text [note: 'conclusión de la resolución']
  resolution_comment text [note: 'comentario de la resolución']
  created_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
  updated_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
  Indexes {
    created_by [name: 'idx_requirements_created_by']
    project_id [name: 'idx_requirements_project_id']
    (project_id, created_at, id) [name: 'idx_requirements_project_created_id', note: 'created_at DESC, id DESC']
    state [name: 'idx_requirements_state']
    (state, created_at, id) [name: 'idx_requirements_state_created_id', note: 'created_at DESC, id DESC']
    tags [type: gin, name: 'idx_requirements_tags']
    tags [type: gin, name: 'idx_requirements_tags_gin', note: 'duplicado de idx_requirements_tags']
  }
  Note: 'Entity: Requisito — pedido sobre un proyecto con su ciclo de estados'
}

Table people_requirements {
  person_id integer [pk, ref: > people.id, note: 'responsable; sin acciones (NO ACTION)']
  requirement_id integer [pk, ref: > requirements.id, note: 'sin acciones (NO ACTION)']
  is_leader boolean [note: 'líder: true para el primero, NULL para el resto']
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]
  Indexes {
    (person_id, requirement_id) [name: 'idx_people_requirements_person_requirement', note: 'repite la PK']
    requirement_id [name: 'idx_people_requirements_requirement_id']
  }
  Note: 'Entity: Requisito — responsables'
}

Table requirement_subscriptors {
  id integer [pk, increment]
  requirement_id integer [not null, ref: > requirements.id, note: 'ON DELETE CASCADE']
  user_id varchar(100) [not null, ref: > users.id, note: 'suscriptor; ON DELETE RESTRICT']
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]
  Indexes {
    (requirement_id, user_id) [unique, name: 'idx_requirement_subscriptors_unique']
    requirement_id [name: 'idx_requirement_subscriptors_requirement_id']
    user_id [name: 'idx_requirement_subscriptors_user_id']
  }
  Note: 'Entity: Requisito — suscriptores'
}

Table requirement_activity {
  id integer [pk, increment]
  type_of_activity enum_requirement_activity_type [not null, note: 'tipo de actividad']
  previous_value text [not null, note: 'valor anterior']
  new_value text [not null, note: 'valor nuevo / texto del comentario']
  visibility_level enum_requirement_activity_visibility_level [not null, default: 'internal', note: 'visibilidad']
  requirement_id integer [not null, ref: > requirements.id, note: 'requisito; ON UPDATE CASCADE ON DELETE CASCADE']
  changed_by varchar(100) [not null, ref: > users.id, note: 'autor; ON UPDATE CASCADE ON DELETE RESTRICT']
  edited_at timestamp [note: 'fecha de edición; sin zona horaria']
  edited_by varchar(100) [ref: > users.id, note: 'editado por; sin acciones (NO ACTION)']
  created_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
  updated_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
  Indexes {
    (requirement_id, type_of_activity, created_at, id) [name: 'idx_requirement_activity_entity_type_created_id']
    requirement_id [name: 'idx_requirement_activity_requirement_id']
  }
  Note: 'Entity: Actividad de requisito — cambio de campo o comentario de un requisito'
}

// ---------- core.tasks ----------
Table objectives {
  id integer [pk, increment]
  title varchar(255) [not null, note: 'título']
  description text [note: 'descripción']
  estimated_finish_date varchar(255) [note: 'fecha estimada de finalización, como texto AAAA-MM-DD']
  state enum_objectives_state [note: 'estado; nullable y sin default en la base (backlog lo pone el comando)']
  priority integer [not null, note: 'prioridad 0..5']
  area enum_objectives_area [not null, note: 'área']
  visibility_level enum_objectives_visibility_level [not null, default: 'public', note: 'visibilidad']
  project_id integer [note: 'proyecto; SIN clave foránea y nullable en la base']
  requirement_id integer [ref: > requirements.id, note: 'requisito; ON UPDATE CASCADE ON DELETE SET NULL']
  created_by varchar(255) [not null, ref: > users.id, note: 'creado por; DOS FK idénticas (objectives_created_by_fkey y _fkey1) ON UPDATE CASCADE ON DELETE SET NULL sobre una columna NOT NULL']
  finished_at timestamptz [note: 'fecha de finalización']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Indexes {
    (created_at, id) [name: 'idx_objectives_created_id', note: 'DESC, DESC']
    (priority, created_at, id) [name: 'idx_objectives_priority_created_id', note: 'DESC, DESC, DESC']
    (project_id, created_at, id) [name: 'idx_objectives_project_created_id', note: 'created_at DESC, id DESC']
    (state, created_at, id) [name: 'idx_objectives_state_created_id', note: 'created_at DESC, id DESC']
    requirement_id [name: 'idx_objectives_requirement_id']
    title [type: gin, name: 'idx_objectives_title_trgm', note: 'gin_trgm_ops']
    description [type: gin, name: 'idx_objectives_description_trgm', note: 'gin_trgm_ops']
  }
  Note: 'Entity: Tarea — unidad de trabajo dentro de un proyecto'
}

Table people_objectives {
  person_id integer [pk, ref: > people.id, note: 'responsable; ON UPDATE CASCADE ON DELETE CASCADE']
  objective_id integer [pk, ref: > objectives.id, note: 'ON UPDATE CASCADE ON DELETE CASCADE']
  is_leader boolean [note: 'líder: true para el primero, false para el resto']
  active boolean [note: 'columna muerta: ningún comando la escribe (NULL en las filas de core)']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Indexes {
    objective_id [name: 'idx_people_objectives_objective_id']
    (person_id, objective_id) [name: 'idx_people_objectives_person_objective', note: 'repite la PK']
  }
  Note: 'Entity: Tarea — responsables'
}

Table objectives_subscriptors {
  id integer [pk, increment]
  objective_id integer [not null, ref: > objectives.id, note: 'ON UPDATE CASCADE ON DELETE CASCADE']
  user_id varchar(100) [not null, ref: > users.id, note: 'ON UPDATE CASCADE ON DELETE CASCADE']
  created_at timestamptz
  updated_at timestamptz
  Note: 'Entity: Tarea — suscriptores; legado, nada la escribe'
}

Table objective_activity {
  id integer [pk, increment, note: 'secuencia objective_changes_id_seq; PK objective_changes_pkey (nombre heredado de objective_changes)']
  type_of_activity enum_objective_activity_type_of_activity [note: 'tipo de actividad; nullable en la base']
  previous_value text [note: 'valor anterior']
  new_value text [note: 'valor nuevo / texto del comentario']
  objective_id integer [not null, note: 'tarea; SIN clave foránea']
  changed_by varchar(255) [not null, ref: > users.id, note: 'autor; DOS FK idénticas (objective_changes_changed_by_fkey y _fkey1) ON UPDATE CASCADE ON DELETE SET NULL sobre una columna NOT NULL']
  visibility_level enum_objective_activity_visibility_level [not null, default: 'internal', note: 'visibilidad']
  edited_at timestamp [note: 'fecha de edición; sin zona horaria']
  edited_by varchar(100) [ref: > users.id, note: 'editado por; sin acciones (NO ACTION)']
  created_at timestamptz
  updated_at timestamptz
  Indexes {
    (objective_id, type_of_activity, created_at, id) [name: 'idx_objective_activity_entity_type_created_id']
  }
  Note: 'Entity: Actividad de tarea — cambio de campo o comentario de una tarea'
}

// ---------- core.times ----------
Table worked_times {
  id integer [pk, increment]
  date timestamptz [note: 'fecha (medianoche UTC del día)']
  minutes integer [note: 'minutos']
  project_id integer [ref: > projects.id, note: 'proyecto; ON UPDATE CASCADE ON DELETE CASCADE']
  person_id integer [ref: > people.id, note: 'persona; ON UPDATE CASCADE ON DELETE CASCADE']
  objective_id integer [ref: > objectives.id, note: 'tarea; ON UPDATE CASCADE ON DELETE SET NULL']
  requirement_id integer [ref: > requirements.id, note: 'requisito; ON DELETE SET NULL']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Indexes {
    (date, id) [name: 'idx_worked_times_date_id', note: 'DESC, DESC']
    objective_id [name: 'idx_worked_times_objective_id']
    (person_id, date, id) [name: 'idx_worked_times_person_date_id', note: 'date DESC, id DESC']
    (project_id, date, id) [name: 'idx_worked_times_project_date_id', note: 'date DESC, id DESC']
    requirement_id [name: 'idx_worked_times_requirement_id']
  }
  Note: 'Entity: Horas trabajadas — minutos de una persona en un proyecto un día'
}

Table unworked_times {
  id integer [pk, increment]
  date date [not null, note: 'fecha']
  minutes integer [not null, note: 'minutos']
  reason enum_unworked_times_reason [not null, note: 'motivo · dato personal (salud)']
  person_id integer [not null, ref: > people.id, note: 'persona; ON UPDATE CASCADE ON DELETE RESTRICT']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Indexes {
    (person_id, date) [name: 'idx_unworked_person_date']
    (person_id, date, id) [name: 'idx_unworked_times_person_date_id']
  }
  Note: 'Entity: Ausencia — minutos no trabajados de una persona un día, con motivo'
}

Table week_assigned_times {
  id integer [pk, increment]
  date_from timestamptz [note: 'semana desde (lunes, medianoche)']
  date_to timestamptz [note: 'semana hasta (viernes)']
  internal boolean [note: 'interna']
  minutes integer [note: 'minutos']
  project_id integer [ref: > projects.id, note: 'proyecto; ON UPDATE CASCADE ON DELETE CASCADE']
  person_id integer [ref: > people.id, note: 'persona; ON UPDATE CASCADE ON DELETE CASCADE']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Indexes {
    (person_id, date_from, id) [name: 'idx_week_assigned_times_person_datefrom_id']
  }
  Note: 'Entity: Asignación semanal — minutos planificados de una persona en un proyecto en una semana'
}

Table worked_times_absence_migration_backup {
  migration_tag text [pk]
  worked_time_id integer [pk]
  backed_up_at timestamptz [not null, default: `now()`]
  date timestamptz [not null]
  minutes integer [not null]
  project_id integer [not null]
  person_id integer [not null]
  objective_id integer
  created_at timestamptz
  updated_at timestamptz
  Note: 'Technical: respaldo de una migración de datos anterior al baseline (horas pasadas a ausencias); nada la lee ni la escribe'
}

// ---------- core.files ----------
Table files {
  id integer [pk, increment]
  file_name varchar(255) [not null, note: 'nombre del archivo']
  file_size integer [not null, note: 'tamaño en bytes']
  mime_type varchar(100) [not null, note: 'tipo MIME']
  storage_key varchar(500) [not null, unique, note: 'clave de almacenamiento (files_storage_key_key)']
  storage_bucket varchar(100) [not null, note: 'bucket']
  storage_region varchar(50) [not null, note: 'región']
  checksum varchar(64) [note: 'checksum']
  byte_status file_byte_status [not null, default: 'pending', note: 'estado del contenido']
  uploaded_by varchar(100) [not null, ref: > users.id, note: 'subido por; ON UPDATE CASCADE ON DELETE RESTRICT']
  retention_status retention_status [not null, default: 'active', note: 'estado de retención']
  deleted_at timestamptz [note: 'fecha de baja; no se escribe']
  deleted_by varchar(100) [ref: > users.id, note: 'dado de baja por; ON UPDATE CASCADE ON DELETE SET NULL; no se escribe']
  created_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
  updated_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
  Indexes {
    (uploaded_by, byte_status) [name: 'idx_files_uploader_byte_status']
  }
  Note: 'Entity: Archivo — archivo subido al almacenamiento de objetos'
}

Table attachments {
  id integer [pk, increment]
  entity_type attachment_entity_type [not null, note: 'tipo de entidad']
  entity_id integer [not null, note: 'entidad; polimórfica, sin clave foránea']
  file_id integer [not null, ref: > files.id, note: 'archivo; FK fk_attachments_file, sin acciones (NO ACTION)']
  deleted_at timestamptz [note: 'fecha de baja; no se escribe']
  deleted_by varchar(100) [ref: > users.id, note: 'dado de baja por; ON UPDATE CASCADE ON DELETE SET NULL; no se escribe']
  created_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
  updated_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
  Indexes {
    (entity_type, entity_id, deleted_at) [name: 'idx_attachments_entity']
    file_id [name: 'idx_attachments_file_id']
  }
  Note: 'Entity: Adjunto — vínculo entre un archivo y una entidad'
}

// ---------- core.notifications ----------
Table notification_outbox {
  id bigint [pk, increment]
  type varchar(100) [not null, note: 'tipo']
  channel varchar(20) [not null, default: 'email', note: 'canal']
  recipient_user_id varchar(100) [not null, ref: > users.id, note: 'destinatario; ON UPDATE CASCADE, ON DELETE NO ACTION']
  recipient_email varchar(255) [not null, note: 'email del destinatario · dato personal']
  payload jsonb [not null, note: 'contenido · dato personal (nombres y textos)']
  status varchar(20) [not null, default: 'pending', note: 'estado: pending | sent']
  attempts integer [not null, default: 0, note: 'intentos']
  next_attempt_at timestamptz [not null, default: `now()`, note: 'próximo intento']
  last_error text [note: 'último error']
  created_at timestamptz [not null, default: `now()`]
  sent_at timestamptz [note: 'fecha de envío']
  Note: 'Entity: Notificación pendiente — email por enviar (outbox transaccional)'
}

// ---------- core.settings ----------
Table system_settings {
  id integer [pk, increment]
  key varchar(255) [not null, unique, note: 'clave (system_settings_key_key)']
  value text [not null, note: 'valor']
  created_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
  updated_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
  Note: 'Entity: Configuración del sistema — valor de configuración editable en caliente'
}

// ---------- migraciones ----------
Table sequelize_meta {
  name varchar(255) [pk]
  Note: 'Technical: migraciones aplicadas (sequelize-cli)'
}
```

## Constraints DBML does not express
| Name | Table | Type | Definition | Guarantee |
|---|---|---|---|---|
| uk_projects_ticket_slug | projects | partial unique index | `UNIQUE (ticket_slug) WHERE ticket_slug IS NOT NULL` | — |
| idx_notification_outbox_pending | notification_outbox | partial index | `(next_attempt_at, id) WHERE status = 'pending'` | — |
| idx_objectives_title_trgm | objectives | trigram index | `GIN (title gin_trgm_ops)` | — |
| idx_objectives_description_trgm | objectives | trigram index | `GIN (description gin_trgm_ops)` | — |
| pg_trgm | — | extension | `CREATE EXTENSION IF NOT EXISTS pg_trgm` | — |

No hay restricciones CHECK, de exclusión ni funciones. Las reglas siguientes las hace cumplir core, no la base: tarea xor requisito en `worked_times`; minutos mayores que cero; tope diario de 1440 minutos; email obligatorio para identidades de tipo persona; `notification_outbox.status` limitado a pending y sent; requisito de la tarea del mismo proyecto.

## Derived attributes
| Entity | Attribute | Stored | By |
|---|---|---|---|
| Asignación semanal | semana hasta | sí (`week_assigned_times.date_to`) | core, al reemplazar la semana: semana desde más 4 días |
| Asignación semanal | interna | sí (`week_assigned_times.internal`) | core, al reemplazar la semana: tipo del proyecto igual a interno |
| Requisito | fecha de planificación, de inicio de desarrollo, de entrada a revisión, de resolución | sí (`requirements.scheduled_at`, `in_progress_at`, `in_review_at`, `finished_at`) | hook del modelo en core al cambiar el estado |
| Tarea | fecha de finalización | sí (`objectives.finished_at`) | hook del modelo en core al entrar y salir de finalizado |
