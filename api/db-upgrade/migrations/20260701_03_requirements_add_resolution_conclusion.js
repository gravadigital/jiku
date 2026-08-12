'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.query(
      `ALTER TABLE requirements ADD COLUMN resolution_conclusion enum_requirement_resolution NULL;`
    );
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.query(
      `ALTER TABLE requirements DROP COLUMN resolution_conclusion;`
    );
  },
};
