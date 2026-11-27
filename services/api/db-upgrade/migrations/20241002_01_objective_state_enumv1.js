'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.changeColumn(
        'objectives',
        'state',
        {
          type: Sequelize.DataTypes.STRING
        },
        { transaction }
      )
        .then(() => {
          return queryInterface.sequelize.query(
            'UPDATE objectives SET state = \'backlog\' WHERE state = \'previsto\';',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.sequelize.query(
            'DROP TYPE IF EXISTS "enum_objectives_state";',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.changeColumn(
            'objectives',
            'state',
            {
              type: Sequelize.ENUM(
                'backlog',
                'activo',
                'finalizado',
                'cancelado'
              ),
            },
            { transaction }
          );
        });
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.changeColumn(
        'objectives',
        'state',
        {
          type: Sequelize.DataTypes.STRING
        },
        { transaction }
      )
        .then(() => {
          return queryInterface.sequelize.query(
            'UPDATE objectives SET state = \'previsto\' WHERE state = \'backlog\';',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.sequelize.query(
            'DROP TYPE IF EXISTS "enum_objectives_state";',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.changeColumn(
            'objectives',
            'state',
            {
              type: Sequelize.ENUM(
                'previsto',
                'activo',
                'finalizado',
                'cancelado'
              ),
            },
            { transaction }
          );
        });
    });
  }
};
