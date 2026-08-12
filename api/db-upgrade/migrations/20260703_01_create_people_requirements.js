'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('people_requirements', {
      person_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'people', key: 'id' },
      },
      requirement_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'requirements', key: 'id' },
      },
      is_leader: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
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
      .then(() => queryInterface.addIndex('people_requirements', ['requirement_id'], {
        name: 'idx_people_requirements_requirement_id',
      }));
  },

  down: (queryInterface) => {
    return queryInterface.dropTable('people_requirements');
  },
};
