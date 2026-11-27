'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('requirement_subscriptors', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      requirement_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'requirements', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('now()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('now()'),
      },
    })
      .then(() => queryInterface.addIndex('requirement_subscriptors', ['requirement_id'], {
        name: 'idx_requirement_subscriptors_requirement_id',
      }))
      .then(() => queryInterface.addIndex('requirement_subscriptors', ['user_id'], {
        name: 'idx_requirement_subscriptors_user_id',
      }))
      .then(() => queryInterface.addIndex('requirement_subscriptors', ['requirement_id', 'user_id'], {
        unique: true,
        name: 'idx_requirement_subscriptors_unique',
      }));
  },

  down: (queryInterface) => {
    return queryInterface.dropTable('requirement_subscriptors');
  },
};
