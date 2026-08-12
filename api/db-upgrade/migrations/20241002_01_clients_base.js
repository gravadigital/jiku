'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.createTable('clients', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        created_at: Sequelize.DataTypes.DATE,
        updated_at: Sequelize.DataTypes.DATE,
      }, { transaction })
        .then(() => {
          return queryInterface.addColumn('projects', 'client_id', {
            type: Sequelize.INTEGER,
            references: {
              model: 'clients',
              key: 'id',
            },
            allowNull: true,
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          }, { transaction });
        });
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.removeColumn('projects', 'client_id', { transaction })
        .then(() => {
          return queryInterface.dropTable('clients', { transaction });
        });
    });
  }
};
