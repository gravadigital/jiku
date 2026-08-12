'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `ALTER TABLE requirements ALTER COLUMN type DROP NOT NULL;`,
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `ALTER TYPE enum_requirement_type RENAME TO enum_requirement_type_old;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `CREATE TYPE enum_requirement_type AS ENUM ('funcionalidad', 'mejora', 'incidencia', 'otro');`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements
            ALTER COLUMN type TYPE enum_requirement_type
            USING (CASE type::text
              WHEN 'sin_tipo' THEN NULL
              ELSE type::text
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
          `CREATE TYPE enum_requirement_type AS ENUM ('funcionalidad', 'mejora', 'incidencia', 'otro', 'sin_tipo');`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements
            ALTER COLUMN type TYPE enum_requirement_type
            USING (CASE WHEN type IS NULL THEN 'sin_tipo' ELSE type::text END)::enum_requirement_type;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE enum_requirement_type_old;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements ALTER COLUMN type SET NOT NULL;`,
          { transaction }
        ));
    });
  },
};
