'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('objective_mail_threads', 'mattermost_post_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('objective_mail_threads', 'mattermost_post_id');
  },
};
