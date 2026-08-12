'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.addColumn(
        'objectives',
        'area',
        {
          type: Sequelize.DataTypes.ENUM('diseño', 'desarrollo', 'gestion', 'investigacion'),
          allowNull: true
        },
        { transaction }
      )
        .then(() => {
          return queryInterface.sequelize.query(
            'UPDATE objectives SET area = \'desarrollo\' WHERE area IS NULL;',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.changeColumn(
            'objectives',
            'area',
            {
              type: Sequelize.DataTypes.ENUM('diseño', 'desarrollo', 'gestion', 'investigacion'),
              allowNull: false
            },
            { transaction }
          );
        });
    });
  },
  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.removeColumn('objectives', 'area', { transaction });
    });
  }
};
