'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return Promise.all([
        queryInterface.createTable(
          'objective_changes',
          {
            id: {
              type: Sequelize.DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            type_of_change: {
              type: Sequelize.DataTypes.ENUM([
                'state',
                'description',
                'person',
                'priority',
                'finish_date',
              ]),
              allowNull: false,
            },
            previous_value: {
              type: Sequelize.DataTypes.STRING,
              allowNull: false,
            },
            new_value: {
              type: Sequelize.DataTypes.STRING,
              allowNull: false,
            },
            objective_id: {
              type: Sequelize.DataTypes.INTEGER,
              allowNull: false,
            },
            created_at: Sequelize.DataTypes.DATE,
            updated_at: Sequelize.DataTypes.DATE,
          },
          { transaction },
        ),
      ]);
    });
  },
  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return Promise.all([
        queryInterface.dropTable('objective_changes', { transaction }),
      ]);
    });
  },
};
