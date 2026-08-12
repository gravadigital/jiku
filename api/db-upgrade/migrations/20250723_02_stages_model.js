'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('stages', 'hours_per_month', { type: Sequelize.INTEGER });
    await queryInterface.changeColumn('stages', 'estimated_completion_date', { type: Sequelize.DATE });
    await queryInterface.changeColumn('stages', 'scope', { type: Sequelize.TEXT });

  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('stages', 'hours_per_month', { type: Sequelize.INTEGER, allowNull: false });
    await queryInterface.changeColumn('stages', 'estimated_completion_date', { type: Sequelize.DATE, allowNull: false });
    await queryInterface.changeColumn('stages', 'scope', { type: Sequelize.TEXT, allowNull: false });
  }
};
