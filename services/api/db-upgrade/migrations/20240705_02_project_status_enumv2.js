'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn(
      'projects',
      'status',
      {
        type: Sequelize.DataTypes.STRING
      },
    )
      .then(() => {
        return queryInterface.sequelize.query('UPDATE projects SET status = \'analisis\' WHERE status = \'planificado\'');
      })
      .then(() => {
        return queryInterface.sequelize.query('UPDATE projects SET status = \'analisis\' WHERE status = \'mantenido\'');
      })
      .then(() => {
        return queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_projects_status";');
      })
      .then(() => {
        return queryInterface.changeColumn(
          'projects',
          'status',
          {
            type: Sequelize.ENUM([
              'analisis',
              'activo',
              'inactivo',
              'finalizado',
              'cancelado'
            ])
          },
        );
      });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn(
      'projects',
      'status',
      {
        type: Sequelize.DataTypes.STRING
      },
    )
      .then(() => {
        return queryInterface.sequelize.query('UPDATE projects SET status = \'planificado\' WHERE status = \'analisis\'');
      })
      .then(() => {
        return queryInterface.sequelize.query('UPDATE projects SET status = \'mantenido\' WHERE status = \'analisis\'');
      })
      .then(() => {
        return queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_projects_status";');
      })
      .then(() => {
        return queryInterface.changeColumn(
          'projects',
          'status',
          {
            type: Sequelize.ENUM([
              'analisis',
              'planificado',
              'mantenido',
              'activo',
              'inactivo',
              'finalizado',
              'cancelado'
            ])
          },
        );
      });
  }
};
