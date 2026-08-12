'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.renameColumn(
        'objectives',
        'description',
        'title',
        { transaction }
      )
        .then(() => {
          return queryInterface.changeColumn(
            'objectives',
            'title',
            {
              type: Sequelize.DataTypes.STRING,
              allowNull: true
            },
            { transaction }
          );
        });
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.renameColumn(
        'objectives',
        'title',
        'description',
        { transaction }
      )
        .then(() => {
          return queryInterface.changeColumn(
            'objectives',
            'description',
            {
              type: Sequelize.DataTypes.STRING,
              allowNull: true
            },
            { transaction }
          );
        });
    });
  }
};
