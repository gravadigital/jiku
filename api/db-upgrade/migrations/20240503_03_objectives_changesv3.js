'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return Promise.all([
        queryInterface.addColumn(
          'objectives',
          'project_id',
          {
            type: Sequelize.DataTypes.INTEGER
          },
          {transaction}
        ),
        queryInterface.dropTable(
          'projects_objectives',
          {transaction}
        ),
        queryInterface.changeColumn(
          'projects',
          'status',
          {
            type: Sequelize.DataTypes.ENUM([
              'analisis',
              'planificado',
              'mantenido',
              'activo',
              'inactivo',
              'finalizado',
              'cancelado'
            ])
          },
          {transaction}
        )
      ]);
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return Promise.all([
        queryInterface.removeColumn(
          'objectives',
          'project_id',
          {transaction}
        ),
        queryInterface.createTable(
          'projects_objectives',
          {
            project_id: Sequelize.DataTypes.INTEGER,
            objective_id: Sequelize.DataTypes.INTEGER,
            created_at: Sequelize.DataTypes.DATE,
            updated_at: Sequelize.DataTypes.DATE
          },
          {transaction}
        ),
        queryInterface.changeColumn(
          'projects',
          'status',
          {
            type: Sequelize.DataTypes.ENUM([
              'creado',
              'planificado',
              'activo',
              'inactivo',
              'finalizado'
            ])
          },
          {transaction}
        )
      ]);
    });
  }
};
