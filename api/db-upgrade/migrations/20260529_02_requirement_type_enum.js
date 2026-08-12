'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `ALTER TYPE enum_requirement_type RENAME TO enum_requirement_type_old;`,
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `CREATE TYPE enum_requirement_type AS ENUM ('funcionalidad', 'mejora', 'incidencia', 'otro');`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements
            ALTER COLUMN type TYPE enum_requirement_type
            USING (CASE type::text
              WHEN 'funcional'  THEN 'funcionalidad'
              WHEN 'bug'        THEN 'incidencia'
              WHEN 'soporte'    THEN 'otro'
              WHEN 'mejora'     THEN 'mejora'
              ELSE 'otro'
            END)::enum_requirement_type;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE enum_requirement_type_old;`,
          { transaction }
        ));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `ALTER TYPE enum_requirement_type RENAME TO enum_requirement_type_old;`,
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `CREATE TYPE enum_requirement_type AS ENUM ('funcional', 'mejora', 'bug', 'soporte');`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements
            ALTER COLUMN type TYPE enum_requirement_type
            USING (CASE type::text
              WHEN 'funcionalidad' THEN 'funcional'
              WHEN 'incidencia'    THEN 'bug'
              WHEN 'otro'          THEN 'soporte'
              WHEN 'mejora'        THEN 'mejora'
              ELSE 'funcional'
            END)::enum_requirement_type;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE enum_requirement_type_old;`,
          { transaction }
        ));
    });
  },
};
