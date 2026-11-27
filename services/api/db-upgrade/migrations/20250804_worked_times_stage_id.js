'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const tableDescription = await queryInterface.describeTable('worked_times');

      if (!tableDescription.stage_id) {
        return queryInterface.addColumn(
          'worked_times',
          'stage_id',
          {
            type: Sequelize.DataTypes.INTEGER,
            allowNull: true,
            references: {
              model: 'stages',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          },
          { transaction }
        );
      }
      return Promise.resolve();
    });
  },

  down: async (queryInterface) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const tableDescription = await queryInterface.describeTable('worked_times');

      if (tableDescription.stage_id) {
        return queryInterface.removeColumn('worked_times', 'stage_id', { transaction });
      }
      return Promise.resolve();
    });
  }
};
