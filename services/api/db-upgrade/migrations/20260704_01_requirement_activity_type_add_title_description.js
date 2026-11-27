'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `ALTER TYPE enum_requirement_activity_type RENAME TO enum_requirement_activity_type_old;`,
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `CREATE TYPE enum_requirement_activity_type AS ENUM (
            'state', 'comment', 'type', 'priority', 'estimatedFinishDate', 'tag', 'resolution', 'title', 'description'
          );`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirement_activity
            ALTER COLUMN type_of_activity TYPE enum_requirement_activity_type
            USING type_of_activity::text::enum_requirement_activity_type;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE enum_requirement_activity_type_old;`,
          { transaction }
        ));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `DELETE FROM requirement_activity WHERE type_of_activity IN ('title', 'description');`,
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `ALTER TYPE enum_requirement_activity_type RENAME TO enum_requirement_activity_type_old;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `CREATE TYPE enum_requirement_activity_type AS ENUM (
            'state', 'comment', 'type', 'priority', 'estimatedFinishDate', 'tag', 'resolution'
          );`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE requirement_activity
            ALTER COLUMN type_of_activity TYPE enum_requirement_activity_type
            USING type_of_activity::text::enum_requirement_activity_type;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE enum_requirement_activity_type_old;`,
          { transaction }
        ));
    });
  },
};
