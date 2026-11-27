'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.addColumn(
        'projects',
        'created_by',
        {
          type: Sequelize.DataTypes.STRING,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        { transaction }
      )
        .then(() => {
          return queryInterface.sequelize.query('UPDATE projects SET created_by = \'system-sub\' WHERE created_by IS NULL;',
            { transaction });
        })
        .then(() => {
          return queryInterface.changeColumn(
            'projects',
            'created_by',
            {
              type: Sequelize.DataTypes.STRING,
              allowNull: false,
              references: {
                model: 'users',
                key: 'id'
              },
              onUpdate: 'CASCADE',
              onDelete: 'SET NULL'
            },
            { transaction }
          );
        });
    });
  },
  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.removeColumn(
        'projects',
        'created_by',
        { transaction });

    });
  }
};
