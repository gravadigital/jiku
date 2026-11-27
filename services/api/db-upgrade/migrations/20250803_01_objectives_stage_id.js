'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const tableDescription = await queryInterface.describeTable('objectives');

      if (!tableDescription.stage_id) {
        return queryInterface.addColumn(
          'objectives',
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
      const tableDescription = await queryInterface.describeTable('objectives');

      if (tableDescription.stage_id) {
        return queryInterface.removeColumn('objectives', 'stage_id', { transaction });
      }
      return Promise.resolve();
    });
  }
};
