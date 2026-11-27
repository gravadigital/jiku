'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('inbound_mail_threads', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      requirement_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'requirements', key: 'id' },
        onDelete: 'CASCADE',
      },
      message_id: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('now()'),
      },
    })
      .then(() => queryInterface.addIndex('inbound_mail_threads', ['message_id'], {
        unique: true,
        name: 'uk_inbound_mail_threads_message_id',
      }))
      .then(() => queryInterface.addIndex('inbound_mail_threads', ['requirement_id'], {
        name: 'idx_inbound_mail_threads_requirement_id',
      }));
  },

  down: (queryInterface) => {
    return queryInterface.dropTable('inbound_mail_threads');
  },
};
