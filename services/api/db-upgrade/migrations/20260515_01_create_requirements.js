'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `CREATE TYPE enum_requirement_type AS ENUM ('funcional', 'mejora', 'bug', 'soporte');`,
        { transaction }
      )
        .then(() => queryInterface.sequelize.query(
          `CREATE TYPE enum_requirement_priority AS ENUM ('baja', 'media', 'alta', 'urgente');`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `CREATE TYPE enum_requirement_state AS ENUM ('solicitud', 'en_revision', 'confirmado', 'programado', 'en_progreso', 'finalizado', 'no_aprobado');`,
          { transaction }
        ))
        .then(() => queryInterface.createTable(
          'requirements',
          {
            id: {
              type: Sequelize.DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            title: {
              type: Sequelize.DataTypes.STRING(255),
              allowNull: false,
            },
            description: {
              type: Sequelize.DataTypes.TEXT,
              allowNull: false,
            },
            type: {
              type: Sequelize.DataTypes.ENUM('funcional', 'mejora', 'bug', 'soporte'),
              allowNull: false,
            },
            priority: {
              type: Sequelize.DataTypes.ENUM('baja', 'media', 'alta', 'urgente'),
              allowNull: false,
            },
            state: {
              type: Sequelize.DataTypes.ENUM('solicitud', 'en_revision', 'confirmado', 'programado', 'en_progreso', 'finalizado', 'no_aprobado'),
              allowNull: false,
            },
            close_date: {
              type: Sequelize.DataTypes.DATEONLY,
              allowNull: false,
            },
            tags: {
              type: Sequelize.DataTypes.JSONB,
              allowNull: true,
            },
            created_by: {
              type: Sequelize.DataTypes.STRING(100),
              allowNull: false,
              references: { model: 'users', key: 'id' },
              onUpdate: 'CASCADE',
              onDelete: 'RESTRICT',
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
        .then(() => queryInterface.addIndex('requirements', ['state'], {
          name: 'idx_requirements_state',
          transaction,
        }))
        .then(() => queryInterface.addIndex('requirements', ['created_by'], {
          name: 'idx_requirements_created_by',
          transaction,
        }))
        .then(() => queryInterface.sequelize.query(
          `CREATE INDEX idx_requirements_tags ON requirements USING GIN(tags);`,
          { transaction }
        ));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.dropTable('requirements', { transaction })
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE IF EXISTS enum_requirement_type;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE IF EXISTS enum_requirement_priority;`,
          { transaction }
        ))
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE IF EXISTS enum_requirement_state;`,
          { transaction }
        ));
    });
  },
};
