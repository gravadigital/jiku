'use strict';

/**
 * Migration: Add external user tracking columns to objective_activity table
 *
 * Adds columns to track external users (from Jira, GitHub, etc.)
 * who made changes to objectives.
 */
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return Promise.all([
        queryInterface.addColumn(
          'objective_activity',
          'external_reference_url',
          {
            type: Sequelize.DataTypes.TEXT,
            allowNull: true,
          },
          { transaction }
        ),
        queryInterface.addColumn(
          'objective_activity',
          'external_user_name',
          {
            type: Sequelize.DataTypes.STRING(255),
            allowNull: true,
          },
          { transaction }
        ),
        queryInterface.addColumn(
          'objective_activity',
          'external_user_id',
          {
            type: Sequelize.DataTypes.STRING(128),
            allowNull: true,
          },
          { transaction }
        ),
      ]);
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return Promise.all([
        queryInterface.removeColumn('objective_activity', 'external_reference_url', { transaction }),
        queryInterface.removeColumn('objective_activity', 'external_user_name', { transaction }),
        queryInterface.removeColumn('objective_activity', 'external_user_id', { transaction }),
      ]);
    });
  }
};
