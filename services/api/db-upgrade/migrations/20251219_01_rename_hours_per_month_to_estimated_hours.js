'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.renameColumn('stages', 'hours_per_month', 'estimated_hours', { transaction });
    });
  },

  down: async (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.renameColumn('stages', 'estimated_hours', 'hours_per_month', { transaction });
    });
  }
};
