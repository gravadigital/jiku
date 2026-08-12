'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.addIndex('projects', ['client_id'], {
      name: 'idx_projects_client_id',
    });
  },

  down: (queryInterface) => {
    return queryInterface.removeIndex('projects', 'idx_projects_client_id');
  },
};
