'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return Promise.all([
        queryInterface.addColumn('clients', 'description', {
          type: Sequelize.TEXT,
          allowNull: true,
        }, { transaction })
      ]);
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return Promise.all([
        queryInterface.removeColumn('clients', 'description', { transaction })
      ]);
    });
  }
};
