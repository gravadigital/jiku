'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.addColumn('projects', 'ticket_slug', {
        type: Sequelize.STRING(255),
        allowNull: true,
      }, { transaction })
        .then(() => queryInterface.addIndex('projects', ['ticket_slug'], {
          unique: true,
          name: 'uk_projects_ticket_slug',
          where: { ticket_slug: { [Sequelize.Op.ne]: null } },
          transaction,
        }));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.removeIndex('projects', 'uk_projects_ticket_slug', { transaction })
        .then(() => queryInterface.removeColumn('projects', 'ticket_slug', { transaction }));
    });
  },
};
