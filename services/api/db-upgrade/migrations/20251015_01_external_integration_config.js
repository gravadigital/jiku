'use strict';

/**
 * Migration: Create external_integration_config table
 *
 * This table stores integration configurations for external systems
 * (Jira, GitHub, GitLab, Linear, etc.)
 */
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.createTable(
        'external_integration_config',
        {
          id: {
            type: Sequelize.DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          client_id: {
            type: Sequelize.DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'clients', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          system_type: {
            type: Sequelize.DataTypes.STRING(50),
            allowNull: false,
          },
          base_url: {
            type: Sequelize.DataTypes.STRING(500),
            allowNull: false,
          },
          auth_email: {
            type: Sequelize.DataTypes.STRING(255),
            allowNull: false,
          },
          auth_token_encrypted: {
            type: Sequelize.DataTypes.TEXT,
            allowNull: false,
          },
          enabled: {
            type: Sequelize.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
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
      return queryInterface.dropTable('external_integration_config', { transaction });
    });
  }
};
