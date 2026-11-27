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
                'cancelado',
                'en_revision'
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
  }
};
