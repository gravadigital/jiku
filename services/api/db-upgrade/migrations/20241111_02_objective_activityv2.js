'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.changeColumn(
        'objective_activity',
        'type_of_activity',
        {
          type: Sequelize.DataTypes.STRING
        },
        { transaction }
      )
        .then(() => {
          return queryInterface.sequelize.query(
            'UPDATE objective_activity SET type_of_activity = \'estimatedFinishDate\' WHERE type_of_activity = \'finish_date\';',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.sequelize.query(
            'DROP TYPE IF EXISTS "enum_objective_activity_type_of_activity";',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.changeColumn(
            'objective_activity',
            'type_of_activity',
            {
              type: Sequelize.ENUM(
                'title',
                'state',
                'area',
                'comment',
                'description',
                'person',
                'priority',
                'estimatedFinishDate'
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
        'objective_activity',
        'type_of_activity',
        {
          type: Sequelize.DataTypes.STRING
        },
        { transaction }
      )
        .then(() => {
          return queryInterface.sequelize.query(
            'UPDATE objective_activity SET type_of_activity = \'finish_date\' WHERE type_of_activity = \'estimatedFinishDate\';',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.sequelize.query(
            'DROP TYPE IF EXISTS "enum_objective_activity_type_of_activity";',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.changeColumn(
            'objective_activity',
            'type_of_activity',
            {
              type: Sequelize.ENUM(
                'title',
                'state',
                'area',
                'comment',
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
