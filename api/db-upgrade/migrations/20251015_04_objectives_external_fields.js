'use strict';

/**
 * Migration: Add external integration columns to objectives table
 *
 * Adds columns to track external issues (Jira, GitHub, etc.)
 * linked to objectives.
 */
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return Promise.all([
        queryInterface.addColumn(
          'objectives',
          'external_project_id',
          {
            type: Sequelize.DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'external_project', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
          { transaction }
        ),
        queryInterface.addColumn(
          'objectives',
          'external_issue_id',
          {
            type: Sequelize.DataTypes.STRING(255),
            allowNull: true,
          },
          { transaction }
        ),
        queryInterface.addColumn(
          'objectives',
          'external_issue_key',
          {
            type: Sequelize.DataTypes.STRING(100),
            allowNull: true,
          },
          { transaction }
        ),
        queryInterface.addColumn(
          'objectives',
          'external_url',
          {
            type: Sequelize.DataTypes.TEXT,
            allowNull: true,
          },
          { transaction }
        ),
        queryInterface.addColumn(
          'objectives',
          'external_raw_data',
          {
            type: Sequelize.DataTypes.JSONB,
            allowNull: true,
          },
          { transaction }
        ),
        queryInterface.addColumn(
          'objectives',
          'last_synced_at',
          {
            type: Sequelize.DataTypes.DATE,
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
        queryInterface.removeColumn('objectives', 'external_project_id', { transaction }),
        queryInterface.removeColumn('objectives', 'external_issue_id', { transaction }),
        queryInterface.removeColumn('objectives', 'external_issue_key', { transaction }),
        queryInterface.removeColumn('objectives', 'external_url', { transaction }),
        queryInterface.removeColumn('objectives', 'external_raw_data', { transaction }),
        queryInterface.removeColumn('objectives', 'last_synced_at', { transaction }),
      ]);
    });
  }
};
