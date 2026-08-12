'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.changeColumn(
        'projects',
        'description',
        {
          type: Sequelize.DataTypes.TEXT,
          allowNull: true,
        },
        { transaction }
      );
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.changeColumn(
        'projects',
        'description',
        {
          type: Sequelize.DataTypes.STRING,
          allowNull: true,
        },
        { transaction }
      );
    });
  }
};
