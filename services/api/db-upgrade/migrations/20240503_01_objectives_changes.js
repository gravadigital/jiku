'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return Promise.all([
        queryInterface.removeColumn(
          'objectives',
          'date',
          {transaction}
        ),
        queryInterface.removeColumn(
          'objectives',
          'external_date',
          {transaction}
        ),
        queryInterface.removeColumn(
          'objectives',
          'external',
          {transaction}
        )
      ]);
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return Promise.all([
        queryInterface.addColumn(
          'objectives',
          'date',
          {type: Sequelize.DataType.DATE},
          {transaction}
        ),
        queryInterface.addColumn(
          'objectives',
          'external_date',
          {type: Sequelize.DataType.DATE},
          {transaction}
        ),
        queryInterface.addColumn(
          'objectives',
          'external',
          {type: Sequelize.DataType.BOOLEAN},
          {transaction}
        )
      ]);
    });
  }
};
