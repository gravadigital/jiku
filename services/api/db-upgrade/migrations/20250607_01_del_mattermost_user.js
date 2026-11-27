'use strict';

module.exports = {
  up: async (queryInterface) => {
    return queryInterface.removeColumn(
      'people',
      'mattermost_username'
    );
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'people',
      'mattermost_username',
      {
        type: Sequelize.DataTypes.STRING,
        allowNull: true,
      }
    );
  }
};
