'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        "ALTER TYPE attachment_entity_type ADD VALUE IF NOT EXISTS 'objective_comment';",
        { transaction }
      ).then(() =>
        queryInterface.sequelize.query(
          "ALTER TYPE attachment_entity_type ADD VALUE IF NOT EXISTS 'requirement_comment';",
          { transaction }
        )
      ).then(() =>
        queryInterface.sequelize.query(
          "ALTER TYPE attachment_entity_type ADD VALUE IF NOT EXISTS 'objective_comment_draft';",
          { transaction }
        )
      ).then(() =>
        queryInterface.sequelize.query(
          "ALTER TYPE attachment_entity_type ADD VALUE IF NOT EXISTS 'requirement_comment_draft';",
          { transaction }
        )
      );
    });
  },
  down: () => {
    // NOT REVERSIBLE: PostgreSQL does not support removing ENUM values without recreating the type
    return Promise.resolve();
  }
};
