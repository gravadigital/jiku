'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.sequelize.query(
        `CREATE TYPE enum_requirement_activity_type AS ENUM ('state', 'comment', 'type', 'priority', 'closeDate', 'project', 'tag');`,
        { transaction }
      )
        .then(() => queryInterface.createTable(
          'requirement_activity',
          {
            id: {
              type: Sequelize.DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            type_of_activity: {
              type: Sequelize.DataTypes.ENUM('state', 'comment', 'type', 'priority', 'closeDate', 'project', 'tag'),
              allowNull: false,
            },
            previous_value: {
              type: Sequelize.DataTypes.TEXT,
              allowNull: false,
            },
            new_value: {
              type: Sequelize.DataTypes.TEXT,
              allowNull: false,
            },
            visibility_level: {
              type: Sequelize.DataTypes.ENUM('public', 'internal'),
              allowNull: false,
              defaultValue: 'internal',
            },
            requirement_id: {
              type: Sequelize.DataTypes.INTEGER,
              allowNull: false,
              references: { model: 'requirements', key: 'id' },
              onUpdate: 'CASCADE',
              onDelete: 'CASCADE',
            },
            changed_by: {
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
        .then(() => queryInterface.addIndex('requirement_activity', ['requirement_id'], {
          name: 'idx_requirement_activity_requirement_id',
          transaction,
        }));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.dropTable('requirement_activity', { transaction })
        .then(() => queryInterface.sequelize.query(
          `DROP TYPE IF EXISTS enum_requirement_activity_type;`,
          { transaction }
        ));
    });
  },
};
