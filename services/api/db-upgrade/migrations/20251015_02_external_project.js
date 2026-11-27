'use strict';

/**
 * Migration: Create external_project table
 *
 * This table maps external projects (Jira projects, GitHub repos, etc.)
 * to local Projects.
 */
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.createTable(
        'external_project',
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
            type: Sequelize.DataTypes.STRING(255),
            allowNull: false,
          },
          external_project_key: {
            type: Sequelize.DataTypes.STRING(100),
            allowNull: false,
          },
          name: {
            type: Sequelize.DataTypes.STRING(500),
            allowNull: false,
          },
          local_project_id: {
            type: Sequelize.DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'projects', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
          config: {
            type: Sequelize.DataTypes.JSONB,
            allowNull: true,
          },
          created_at: {
            type: Sequelize.DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
          updated_at: {
            type: Sequelize.DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
        },
        { transaction }
      );
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.dropTable('external_project', { transaction });
    });
  }
};
