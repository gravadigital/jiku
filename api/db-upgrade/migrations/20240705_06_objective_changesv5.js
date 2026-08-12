'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn(
      'objective_changes',
      'type_of_change',
      {
        type: Sequelize.ENUM([
          'state',
          'area',
          'description',
          'person',
          'priority',
          'finish_date',
        ])
      },
    );
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn(
      'objective_changes',
      'type_of_change',
      {
        type: Sequelize.ENUM([
          'state',
          'description',
          'person',
          'priority',
          'finish_date',
        ])
      },
    );
  }
};
