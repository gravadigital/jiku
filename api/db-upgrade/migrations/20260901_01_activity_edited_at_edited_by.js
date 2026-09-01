'use strict';

/**
 * Agrega `edited_at` y `edited_by` a `requirement_activity` y `objective_activity`: REQ-011 le
 * suma a `core` los dos comandos de edición de comentario (`requirements.{id}.comment.{cid}.edit`
 * y `tasks.{id}.comment.{cid}.edit`), y necesitan dónde registrar quién editó y cuándo.
 *
 * NULL SIGNIFICA "NUNCA EDITADO", que es el valor correcto para TODA fila preexistente: no hay
 * backfill posible ni deseable, porque ninguna fila existente fue editada por este mecanismo.
 *
 * UN SOLO ALTER POR TABLA CON DOS ADD COLUMN, no cuatro sentencias: es un solo pase sobre el
 * catálogo por tabla. `queryInterface.addColumn` emite un ALTER por llamada y no puede
 * expresarlo; el precedente de SQL crudo es `20260824_01_users_roles_identity_type.js`.
 *
 * SIN DEFAULT: a diferencia de `20260824_01` (que sí necesitaba defaults no volátiles para que
 * un INSERT que no las mencione no fallara contra un NOT NULL), acá las dos columnas son
 * NULLABLE — no hay ningún valor por defecto correcto para "edición", así que la ausencia de
 * edición ES `NULL`, sin necesidad de declarar uno.
 *
 * SIN DOWNTIME: dos columnas nullable y sin default solo tocan el catálogo, PostgreSQL no
 * reescribe la tabla ni toma un lock largo.
 *
 * SIN ÍNDICES NUEVOS: las dos columnas se leen por proyección junto con la fila que ya trae el
 * índice existente sobre `(entidad, type_of_activity, created_at, id)`, y el `UPDATE` que las
 * escribe es siempre por PK.
 *
 * `edited_by VARCHAR(100)` EN LAS DOS TABLAS, a diferencia de `changed_by` (que es
 * `VARCHAR(100)` en `requirement_activity` pero `VARCHAR` sin longitud en `objective_activity`).
 * Esa asimetría es heredada y esta migración no la corrige (queda para FG-6); `edited_by` es una
 * columna nueva y no hereda nada, así que se declara con la longitud correcta desde el inicio,
 * igual que `users.id`.
 *
 * REVERSIBLE: el `down` dropea las cuatro columnas dentro de una transacción. No hay tipos ni
 * índices que revertir en otro orden.
 */
module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        ALTER TABLE requirement_activity
          ADD COLUMN edited_at TIMESTAMP    NULL,
          ADD COLUMN edited_by VARCHAR(100) NULL REFERENCES users(id);
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
        ALTER TABLE objective_activity
          ADD COLUMN edited_at TIMESTAMP    NULL,
          ADD COLUMN edited_by VARCHAR(100) NULL REFERENCES users(id);
        `,
        { transaction }
      );
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        'ALTER TABLE requirement_activity DROP COLUMN edited_at, DROP COLUMN edited_by;',
        { transaction }
      );

      await queryInterface.sequelize.query(
        'ALTER TABLE objective_activity DROP COLUMN edited_at, DROP COLUMN edited_by;',
        { transaction }
      );
    });
  },
};
