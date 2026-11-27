'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `ALTER TYPE enum_requirement_state RENAME TO enum_requirement_state_old;`,
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `CREATE TYPE enum_requirement_state AS ENUM (
            'en_espera', 'en_evaluacion', 'en_proyecto', 'en_programacion',
            'en_progreso', 'en_revision', 'finalizado', 'sin_continuidad'
          );`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements
            ALTER COLUMN state TYPE enum_requirement_state
            USING (CASE state::text
              WHEN 'solicitud'    THEN 'en_espera'
              WHEN 'en_revision'  THEN 'en_evaluacion'
              WHEN 'confirmado'   THEN 'en_proyecto'
              WHEN 'programado'   THEN 'en_programacion'
              WHEN 'en_progreso'  THEN 'en_progreso'
              WHEN 'finalizado'   THEN 'finalizado'
              WHEN 'no_aprobado'  THEN 'sin_continuidad'
              ELSE 'en_espera'
            END)::enum_requirement_state;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE enum_requirement_state_old;`,
          { transaction }
        ));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `ALTER TYPE enum_requirement_state RENAME TO enum_requirement_state_old;`,
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `CREATE TYPE enum_requirement_state AS ENUM (
            'solicitud', 'en_revision', 'confirmado', 'programado',
            'en_progreso', 'finalizado', 'no_aprobado'
          );`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements
            ALTER COLUMN state TYPE enum_requirement_state
            USING (CASE state::text
              WHEN 'en_espera'       THEN 'solicitud'
              WHEN 'en_evaluacion'   THEN 'en_revision'
              WHEN 'en_proyecto'     THEN 'confirmado'
              WHEN 'en_programacion' THEN 'programado'
              WHEN 'en_progreso'     THEN 'en_progreso'
              WHEN 'en_revision'     THEN 'en_revision'
              WHEN 'finalizado'      THEN 'finalizado'
              WHEN 'sin_continuidad' THEN 'no_aprobado'
              ELSE 'solicitud'
            END)::enum_requirement_state;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE enum_requirement_state_old;`,
          { transaction }
        ));
    });
  },
};
