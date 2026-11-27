'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return Promise.all([
        queryInterface.renameColumn(
          'objectives',
          'finish_date',
          'estimated_finish_date',
          { transaction }
        ),
        queryInterface.addColumn(
          'objectives',
          'finished_at',
          {
            type: Sequelize.DataTypes.DATE,
            allowNull: true,
          },
          { transaction }
        )
      ]);
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return Promise.all([
        queryInterface.renameColumn(
          'objectives',
          'estimated_finish_date',
          'finish_date',
          { transaction }
        ),
        queryInterface.removeColumn(
          'objectives',
          'finished_at',
          { transaction }
        )
      ]);
    });
  }
};
