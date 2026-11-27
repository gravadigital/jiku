'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.renameTable('objective_changes', 'objective_activity', { transaction })
        .then(() => {
          return queryInterface.changeColumn(
            'objective_activity',
            'type_of_change',
            {
              type: Sequelize.DataTypes.STRING
            },
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.sequelize.query(
            'DROP TYPE IF EXISTS "enum_objective_activity_type_of_change";',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.renameColumn(
            'objective_activity',
            'type_of_change',
            'type_of_activity',
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
              allowNull: false,
            },
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.changeColumn(
            'objective_activity',
            'previous_value',
            {
              type: Sequelize.DataTypes.TEXT
            },
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.changeColumn(
            'objective_activity',
            'new_value',
            {
              type: Sequelize.DataTypes.TEXT
            },
            { transaction }
          );
        });
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.renameTable('objective_activity', 'objective_changes', { transaction })
        .then(() => {
          return queryInterface.changeColumn(
            'objective_changes',
            'type_of_activity',
            {
              type: Sequelize.DataTypes.STRING
            },
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.sequelize.query(
            'DROP TYPE IF EXISTS "enum_objective_changes_type_of_activity";',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.renameColumn(
            'objective_changes',
            'type_of_activity',
            'type_of_change',
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.changeColumn(
            'objective_changes',
            'type_of_change',
            {
              type: Sequelize.ENUM(
                'title',
                'state',
                'area',
                'description',
                'person',
                'priority',
                'finish_date'
              ),
              allowNull: false,
            },
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.changeColumn(
            'objective_changes',
            'previous_value',
            {
              type: Sequelize.DataTypes.STRING
            },
            { transaction }
          );
        })
        .then(() => {
          return queryInterface.changeColumn(
            'objective_changes',
            'new_value',
            {
              type: Sequelize.DataTypes.STRING
            },
            { transaction }
          );
        });
    });
  }
};
