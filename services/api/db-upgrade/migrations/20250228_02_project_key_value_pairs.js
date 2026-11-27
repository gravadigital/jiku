'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (transaction) => {

      await queryInterface.addColumn(
        'projects',
        'key_value_pairs',
        {
          type: Sequelize.DataTypes.JSON,
          allowNull: true,
        },
        { transaction }
      );
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.removeColumn(
        'projects',
        'key_value_pairs',
        { transaction }
      );
    });
  }
};

