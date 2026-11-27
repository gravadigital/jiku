'use strict';

/**
 * Migration: Create external_sync_event table
 *
 * This table tracks synchronization events and their results.
 */
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.createTable(
        'external_sync_event',
        {
          id: {
            type: Sequelize.DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          integration_id: {
            type: Sequelize.DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'external_integration_config', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          external_project_id: {
            type: Sequelize.DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'external_project', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
          started_at: {
            type: Sequelize.DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
          finished_at: {
            type: Sequelize.DataTypes.DATE,
            allowNull: true,
          },
          status: {
            type: Sequelize.DataTypes.STRING(20),
            allowNull: false,
          },
          issues_created: {
            type: Sequelize.DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
          issues_updated: {
            type: Sequelize.DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
          issues_failed: {
            type: Sequelize.DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
          errors: {
            type: Sequelize.DataTypes.JSONB,
            allowNull: true,
          },
          metadata: {
            type: Sequelize.DataTypes.JSONB,
            allowNull: true,
          },
        },
        { transaction }
      );
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.dropTable('external_sync_event', { transaction });
    });
  }
};
