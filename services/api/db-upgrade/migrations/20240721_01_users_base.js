'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.createTable(
        'users',
        {
          id: {
            type: Sequelize.DataTypes.STRING(100),
            primaryKey: true,
          },
          name: {
            type: Sequelize.DataTypes.STRING,
            allowNull: false,
          },
          username: {
            type: Sequelize.DataTypes.STRING,
            allowNull: false,
          },
          email: {
            type: Sequelize.DataTypes.STRING,
            allowNull: false,
          },
          created_at: Sequelize.DataTypes.DATE,
          updated_at: Sequelize.DataTypes.DATE,
        },
      ),
    ]);
  },
  down: (queryInterface) => {
    return Promise.all([
      queryInterface.dropTable('users'),
    ]);
  },
};
