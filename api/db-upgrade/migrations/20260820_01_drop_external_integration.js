'use strict';

/**
 * Da de baja la integración con sistemas externos (Jira): el esquema que se preparó y para el
 * que nunca se escribió código.
 *
 * Se eliminan:
 *   - El índice único parcial `uk_objective_activity_external_comment`.
 *   - Las 3 columnas de la integración en `objective_activity`.
 *   - Las 6 columnas de la integración en `objectives`, incluida `last_synced_at`, que es la
 *     única SIN el prefijo `external_` y por eso una búsqueda por patrón no la encuentra.
 *   - Las 3 tablas `external_sync_event`, `external_project` y `external_integration_config`,
 *     con sus secuencias, constraints e índices.
 *
 * NO SE TOCAN `clients` ni `projects`: las FK que desaparecen son las SALIENTES de las tablas
 * borradas. Ninguna fila de `objectives` ni de `objective_activity` se pierde: es DROP COLUMN,
 * no DELETE.
 *
 * EL ORDEN DEL `up` NO ES COSMÉTICO. El `DROP COLUMN` de `objectives.external_project_id` se
 * lleva su propia constraint de FK, y eso es lo que habilita el `DROP TABLE external_project`
 * de más abajo. Por eso NO se usa `CASCADE`: si quedara una dependencia que nadie relevó, la
 * migración falla y no borra nada, en lugar de arrastrarla en silencio.
 *
 * NO ES REVERSIBLE EN CUANTO A DATOS. El `down` recrea la estructura VACÍA para poder volver
 * atrás el esquema, pero los valores que se hayan cargado a mano no se recuperan. No hay
 * respaldo previo, y es una decisión tomada (RF-6), no un olvido.
 */
module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `
        DROP INDEX IF EXISTS uk_objective_activity_external_comment;

        ALTER TABLE objective_activity
          DROP COLUMN IF EXISTS external_reference_url,
          DROP COLUMN IF EXISTS external_user_name,
          DROP COLUMN IF EXISTS external_user_id;

        -- Va sola y antes: se lleva la constraint de FK hacia external_project, y eso es lo
        -- que permite borrar esa tabla más abajo sin propagar el borrado.
        ALTER TABLE objectives DROP COLUMN IF EXISTS external_project_id;

        ALTER TABLE objectives
          DROP COLUMN IF EXISTS external_issue_id,
          DROP COLUMN IF EXISTS external_issue_key,
          DROP COLUMN IF EXISTS external_url,
          DROP COLUMN IF EXISTS external_raw_data,
          DROP COLUMN IF EXISTS last_synced_at;   -- sin prefijo external_, y se va igual

        -- De la hoja a la raíz: external_sync_event referencia a las otras dos, y
        -- external_project referencia a external_integration_config.
        DROP TABLE IF EXISTS external_sync_event;
        DROP TABLE IF EXISTS external_project;
        DROP TABLE IF EXISTS external_integration_config;
        `,
        { transaction }
      );
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `
        -- Orden inverso al del up: las FK obligan a crear primero la tabla referenciada.
        -- El DDL es el de 20251015_01, _02, _03, _04, _05, _06 y _07, copiado y no reinventado.
        CREATE TABLE external_integration_config (
          id SERIAL PRIMARY KEY,
          client_id integer NOT NULL REFERENCES clients(id) ON UPDATE CASCADE ON DELETE CASCADE,
          system_type varchar(50) NOT NULL,
          base_url varchar(500) NOT NULL,
          auth_email varchar(255) NOT NULL,
          auth_token_encrypted text NOT NULL,
          enabled boolean NOT NULL DEFAULT true,
          config jsonb,
          created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE external_project (
          id SERIAL PRIMARY KEY,
          integration_id integer NOT NULL REFERENCES external_integration_config(id) ON UPDATE CASCADE ON DELETE CASCADE,
          external_project_id varchar(255) NOT NULL,
          external_project_key varchar(100) NOT NULL,
          name varchar(500) NOT NULL,
          local_project_id integer REFERENCES projects(id) ON UPDATE CASCADE ON DELETE SET NULL,
          config jsonb,
          created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- OJO: prefix NO viene de 20251015_02 sino de 20251015_07, y ESA la agrega con un
        -- ALTER TABLE. Se replica igual —y no como columna inline— para que quede en la
        -- misma posición ordinal que en el esquema original. Los tres índices de abajo
        -- también son de _07, y sin esta columna fallarían.
        ALTER TABLE external_project ADD COLUMN prefix varchar(50) NULL;

        COMMENT ON COLUMN external_project.prefix IS
        'Optional prefix filter for Jira issue titles. NULL = sync all issues. Example: [VIS], [RIMS]';

        CREATE INDEX idx_external_project_prefix
          ON external_project(prefix)
          WHERE prefix IS NOT NULL;

        CREATE INDEX idx_external_project_integration_project
          ON external_project(integration_id, external_project_id);

        CREATE UNIQUE INDEX idx_external_project_unique_prefix
          ON external_project(integration_id, external_project_id, prefix);

        -- timestamps: false en el modelo original: usa started_at / finished_at propios y
        -- NO tiene created_at / updated_at.
        CREATE TABLE external_sync_event (
          id SERIAL PRIMARY KEY,
          integration_id integer NOT NULL REFERENCES external_integration_config(id) ON UPDATE CASCADE ON DELETE CASCADE,
          external_project_id integer REFERENCES external_project(id) ON UPDATE CASCADE ON DELETE SET NULL,
          started_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
          finished_at timestamp with time zone,
          status varchar(20) NOT NULL,
          issues_created integer NOT NULL DEFAULT 0,
          issues_updated integer NOT NULL DEFAULT 0,
          issues_failed integer NOT NULL DEFAULT 0,
          errors jsonb,
          metadata jsonb
        );

        ALTER TABLE objectives
          ADD COLUMN external_project_id integer REFERENCES external_project(id) ON UPDATE CASCADE ON DELETE SET NULL,
          ADD COLUMN external_issue_id varchar(255),
          ADD COLUMN external_issue_key varchar(100),
          ADD COLUMN external_url text,
          ADD COLUMN external_raw_data jsonb,
          ADD COLUMN last_synced_at timestamp with time zone;

        ALTER TABLE objective_activity
          ADD COLUMN external_reference_url text,
          ADD COLUMN external_user_name varchar(255),
          ADD COLUMN external_user_id varchar(128);

        CREATE UNIQUE INDEX uk_objective_activity_external_comment
            ON objective_activity(external_reference_url)
            WHERE type_of_activity = 'comment'
              AND external_reference_url IS NOT NULL;

        COMMENT ON INDEX uk_objective_activity_external_comment IS
            'Ensures each Jira comment (external_reference_url) is synced only once. Partial index for comment activities with non-null URLs.';
        `,
        { transaction }
      );
    });
  }
};
