'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        "ALTER TYPE attachment_entity_type ADD VALUE IF NOT EXISTS 'objective_draft';",
        { transaction }
      );
    });
  },
  down: () => {
    // NOT REVERSIBLE: PostgreSQL does not support removing ENUM values without recreating the type
    return Promise.resolve();
  }
};
