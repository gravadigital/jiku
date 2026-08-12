'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.addColumn(
        'objective_changes',
        'changed_by',
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
          return queryInterface.sequelize.query(
            'UPDATE objective_changes SET changed_by = \'system-sub\' WHERE changed_by IS NULL;',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.changeColumn(
            'objective_changes',
            'changed_by',
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
        'objective_changes',
        'changed_by',
        { transaction });

    });
  }
};
