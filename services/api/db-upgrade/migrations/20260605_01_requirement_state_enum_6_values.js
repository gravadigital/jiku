'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `ALTER TABLE requirements ALTER COLUMN state TYPE varchar(50);`,
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE enum_requirement_state;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `CREATE TYPE enum_requirement_state AS ENUM (
            'analisis', 'programado', 'desarrollo', 'revision', 'finalizado', 'cancelado'
          );`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements ALTER COLUMN state TYPE enum_requirement_state
            USING CASE state
              WHEN 'en_espera'       THEN 'analisis'::enum_requirement_state
              WHEN 'en_evaluacion'   THEN 'analisis'::enum_requirement_state
              WHEN 'en_proyecto'     THEN 'programado'::enum_requirement_state
              WHEN 'en_programacion' THEN 'programado'::enum_requirement_state
              WHEN 'en_progreso'     THEN 'desarrollo'::enum_requirement_state
              WHEN 'en_revision'     THEN 'revision'::enum_requirement_state
              WHEN 'finalizado'      THEN 'finalizado'::enum_requirement_state
              WHEN 'sin_continuidad' THEN 'cancelado'::enum_requirement_state
            END;`,
          { transaction }
        ));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `ALTER TABLE requirements ALTER COLUMN state TYPE varchar(50);`,
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE enum_requirement_state;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `CREATE TYPE enum_requirement_state AS ENUM (
            'en_espera', 'en_evaluacion', 'en_proyecto', 'en_programacion',
            'en_progreso', 'en_revision', 'finalizado', 'sin_continuidad'
          );`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements ALTER COLUMN state TYPE enum_requirement_state
            USING CASE state
              WHEN 'analisis'    THEN 'en_espera'::enum_requirement_state
              WHEN 'programado'  THEN 'en_proyecto'::enum_requirement_state
              WHEN 'desarrollo'  THEN 'en_progreso'::enum_requirement_state
              WHEN 'revision'    THEN 'en_revision'::enum_requirement_state
              WHEN 'finalizado'  THEN 'finalizado'::enum_requirement_state
              WHEN 'cancelado'   THEN 'sin_continuidad'::enum_requirement_state
            END;`,
          { transaction }
        ));
    });
  },
};
