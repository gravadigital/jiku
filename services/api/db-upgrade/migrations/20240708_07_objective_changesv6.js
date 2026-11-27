'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn(
      'objectives',
      'state',
      {
        type: Sequelize.DataTypes.STRING
      },
    )
      .then(() => {
        return Promise.all([
          queryInterface.sequelize.query('UPDATE objectives SET state = \'previsto\' WHERE state = \'pending\''),
          queryInterface.sequelize.query('UPDATE objectives SET state = \'activo\' WHERE state = \'in_progress\''),
          queryInterface.sequelize.query('UPDATE objectives SET state = \'finalizado\' WHERE state = \'finished\''),
          queryInterface.sequelize.query('UPDATE objectives SET state = \'finalizado\' WHERE state = \'finished_late\''),
        ]);
      })
      .then(() => {
        return queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_objectives_state";');
      })
      .then(() => {
        return queryInterface.changeColumn(
          'objectives',
          'state',
          {
            type: Sequelize.ENUM([
              'previsto',
              'activo',
              'finalizado',
              'cancelado',
            ])
          },
        );
      });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn(
      'objectives',
      'state',
      {
        type: Sequelize.DataTypes.STRING
      },
    )
      .then(() => {
        return Promise.all([
          queryInterface.sequelize.query('UPDATE objectives SET state = \'pending\' WHERE state = \'previsto\''),
          queryInterface.sequelize.query('UPDATE objectives SET state = \'in_progress\' WHERE state = \'activo\''),
          queryInterface.sequelize.query('UPDATE objectives SET state = \'finished\' WHERE state = \'finalizado\''),
          queryInterface.sequelize.query('UPDATE objectives SET state = \'finidhed_late\' WHERE state = \'finalizado\''),
        ]);
      })
      .then(() => {
        return queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_objectives_state";');
      })
      .then(() => {
        return queryInterface.changeColumn(
          'objectives',
          'state',
          {
            type: Sequelize.ENUM([
              'pending',
              'in_progress',
              'finished',
              'finished_late',
            ])
          },
        );
      });
  }
};
