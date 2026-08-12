'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.addColumn(
        'objectives',
        'description',
        {
          type: Sequelize.DataTypes.STRING,
          allowNull: true,
        },
        { transaction }
      )
        .then(() => {
          return queryInterface.changeColumn(
            'objectives',
            'title',
            {
              type: Sequelize.DataTypes.STRING,
              allowNull: false,
            },
            { transaction }
          );
        });
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.removeColumn(
        'objectives',
        'description',
        { transaction }
      )
        .then(() => {
          return queryInterface.changeColumn(
            'objectives',
            'title',
            {
              type: Sequelize.DataTypes.STRING,
              allowNull: true,
            },
            { transaction }
          );
        });
    });
  }
};
