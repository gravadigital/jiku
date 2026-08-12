'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.query(
      `ALTER TYPE attachment_entity_type ADD VALUE IF NOT EXISTS 'requirement_draft';`
    );
  },

  down: () => {
    // PostgreSQL does not support removing enum values without DROP+RECREATE.
    // To reverse: manually DROP and RECREATE the enum without 'requirement_draft',
    // after ensuring no rows use that value.
    return Promise.resolve();
  },
};
