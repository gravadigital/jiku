'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `ALTER TYPE enum_requirement_priority RENAME TO enum_requirement_priority_old;`,
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `CREATE TYPE enum_requirement_priority AS ENUM ('sin_prioridad', 'baja', 'media', 'alta', 'urgente');`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements
            ALTER COLUMN priority TYPE enum_requirement_priority
            USING priority::text::enum_requirement_priority;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements ALTER COLUMN priority SET DEFAULT 'sin_prioridad';`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE enum_requirement_priority_old;`,
          { transaction }
        ));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `ALTER TABLE requirements ALTER COLUMN priority DROP DEFAULT;`,
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `UPDATE requirements SET priority = 'baja' WHERE priority = 'sin_prioridad';`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TYPE enum_requirement_priority RENAME TO enum_requirement_priority_old;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `CREATE TYPE enum_requirement_priority AS ENUM ('baja', 'media', 'alta', 'urgente');`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirements
            ALTER COLUMN priority TYPE enum_requirement_priority
            USING priority::text::enum_requirement_priority;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE enum_requirement_priority_old;`,
          { transaction }
        ));
    });
  },
};
