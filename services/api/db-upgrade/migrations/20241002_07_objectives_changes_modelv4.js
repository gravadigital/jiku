'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.changeColumn(
        'objective_changes',
        'type_of_change',
        {
          type: Sequelize.DataTypes.STRING
        },
        { transaction }
      )
        .then(() => {
          return queryInterface.sequelize.query(
            'UPDATE objective_changes SET type_of_change = \'title\' WHERE type_of_change = \'description\';',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.sequelize.query(
            'DROP TYPE IF EXISTS "enum_objective_changes_type_of_change";',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.changeColumn(
            'objective_changes',
            'type_of_change',
            {
              type: Sequelize.ENUM(
                'state',
                'area',
                'title',
                'person',
                'priority',
                'finish_date'
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
        'objective_changes',
        'type_of_change',
        {
          type: Sequelize.DataTypes.STRING
        },
        { transaction }
      )
        .then(() => {
          return queryInterface.sequelize.query(
            'UPDATE objective_changes SET type_of_change = \'description\' WHERE type_of_change = \'title\';',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.sequelize.query(
            'DROP TYPE IF EXISTS "enum_objective_changes_type_of_change";',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.changeColumn(
            'objective_changes',
            'type_of_change',
            {
              type: Sequelize.ENUM(
                'state',
                'area',
                'description',
                'person',
                'priority',
                'finish_date'
              ),
            },
            { transaction }
          );
        });
    });
  }
};
