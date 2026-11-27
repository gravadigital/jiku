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
        return queryInterface.sequelize.query('UPDATE projects SET status = \'analisis\' WHERE status = \'creado\'');
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
        return queryInterface.sequelize.query('UPDATE projects SET status = \'creado\' WHERE status = \'analisis\'');
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
              'creado',
              'planificado',
              'activo',
              'inactivo',
              'finalizado'
            ])
          },
        );
      });
  }
};
