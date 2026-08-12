'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        "CREATE TYPE attachment_entity_type AS ENUM ('objective', 'project', 'stage');",
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          "CREATE TYPE retention_status AS ENUM ('active', 'scheduled_for_deletion', 'deleted');",
          { transaction }
        ))
        .then(() => queryInterface.createTable(
          'attachments',
          {
            id: {
              type: Sequelize.DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            entity_type: {
              type: '"attachment_entity_type"',
              allowNull: false,
            },
            entity_id: {
              type: Sequelize.DataTypes.INTEGER,
              allowNull: false,
            },
            file_name: {
              type: Sequelize.DataTypes.STRING(255),
              allowNull: false,
            },
            file_size: {
              type: Sequelize.DataTypes.INTEGER,
              allowNull: false,
            },
            mime_type: {
              type: Sequelize.DataTypes.STRING(100),
              allowNull: false,
            },
            storage_key: {
              type: Sequelize.DataTypes.STRING(500),
              allowNull: false,
              unique: true,
            },
            storage_bucket: {
              type: Sequelize.DataTypes.STRING(100),
              allowNull: false,
            },
            storage_region: {
              type: Sequelize.DataTypes.STRING(50),
              allowNull: false,
            },
            uploaded_by: {
              type: Sequelize.DataTypes.STRING(100),
              allowNull: false,
              references: { model: 'users', key: 'id' },
              onUpdate: 'CASCADE',
              onDelete: 'RESTRICT',
            },
            description: {
              type: Sequelize.DataTypes.TEXT,
              allowNull: true,
            },
            checksum: {
              type: Sequelize.DataTypes.STRING(64),
              allowNull: true,
            },
            retention_status: {
              type: '"retention_status"',
              allowNull: false,
              defaultValue: 'active',
            },
            deleted_at: {
              type: Sequelize.DataTypes.DATE,
              allowNull: true,
            },
            deleted_by: {
              type: Sequelize.DataTypes.STRING(100),
              allowNull: true,
              references: { model: 'users', key: 'id' },
              onUpdate: 'CASCADE',
              onDelete: 'SET NULL',
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
        ))
        .then(() => queryInterface.addIndex('attachments', ['entity_type', 'entity_id', 'deleted_at'], {
          name: 'idx_attachments_entity',
          transaction,
        }))
        .then(() => queryInterface.addIndex('attachments', ['uploaded_by', 'deleted_at'], {
          name: 'idx_attachments_uploader',
          transaction,
        }))
        .then(() => queryInterface.sequelize.query(
          `ALTER TABLE attachments ADD CONSTRAINT check_attachments_active_status
           CHECK (deleted_at IS NULL AND retention_status = 'active' OR deleted_at IS NOT NULL);`,
          { transaction }
        ));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.dropTable('attachments', { transaction })
        .then(() => queryInterface.sequelize.query(
          'DROP TYPE IF EXISTS "attachment_entity_type";',
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          'DROP TYPE IF EXISTS "retention_status";',
          { transaction }
        ));
    });
  },
};
