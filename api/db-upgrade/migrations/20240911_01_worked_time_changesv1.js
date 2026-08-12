'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.addColumn(
        'worked_times',
        'objective_id',
        {
          type: Sequelize.DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'objectives',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        { transaction }
      );
    });
  },
  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.removeColumn(
        'worked_times',
        'objective_id',
        { transaction }
      );
    });
  }
};
