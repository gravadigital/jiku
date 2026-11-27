'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.addColumn('requirements', 'scheduled_at', {
        type: Sequelize.DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      }, { transaction })
        .then(() => queryInterface.addColumn('requirements', 'in_progress_at', {
          type: Sequelize.DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
        }, { transaction }))
        .then(() => queryInterface.addColumn('requirements', 'in_review_at', {
          type: Sequelize.DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
        }, { transaction }))
        .then(() => queryInterface.addColumn('requirements', 'finished_at', {
          type: Sequelize.DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
        }, { transaction }));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.removeColumn('requirements', 'scheduled_at', { transaction })
        .then(() => queryInterface.removeColumn('requirements', 'in_progress_at', { transaction }))
        .then(() => queryInterface.removeColumn('requirements', 'in_review_at', { transaction }))
        .then(() => queryInterface.removeColumn('requirements', 'finished_at', { transaction }));
    });
  },
};
