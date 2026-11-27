'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn(
      'objective_changes',
      'type_of_change',
      {
        type: Sequelize.DataTypes.STRING
      },
    )
      .then(() => {
        return queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_objective_changes_type_of_change";')
          .then(() => {
            return queryInterface.changeColumn(
              'objective_changes',
              'type_of_change',
              {
                type: Sequelize.ENUM([
                  'state',
                  'area',
                  'description',
                  'person',
                  'priority',
                  'finish_date',
                ])
              },
            );
          });
      });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn(
      'objective_changes',
      'type_of_change',
      {
        type: Sequelize.DataTypes.STRING
      },
    )
      .then(() => {
        return queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_objective_changes_type_of_change";')
          .then(() => {
            return queryInterface.changeColumn(
              'objective_changes',
              'type_of_change',
              {
                type: Sequelize.ENUM([
                  'state',
                  'description',
                  'person',
                  'priority',
                  'finish_date',
                ])
              },
            );
          });
      });
  }
};
