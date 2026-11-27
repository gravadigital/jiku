'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return Promise.all([
        queryInterface.removeColumn(
          'objectives',
          'comment',
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
          'comment',
          {type: Sequelize.DataType.STRING},
          {transaction}
        )
      ]);
    });
  }
};
