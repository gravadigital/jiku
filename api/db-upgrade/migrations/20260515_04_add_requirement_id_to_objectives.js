'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.addColumn(
        'objectives',
        'requirement_id',
        {
          type: Sequelize.DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'requirements', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        { transaction }
      )
        .then(() => queryInterface.addIndex('objectives', ['requirement_id'], {
          name: 'idx_objectives_requirement_id',
          transaction,
        }));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((transaction) => {
      return queryInterface.removeIndex('objectives', 'idx_objectives_requirement_id', { transaction })
        .then(() => queryInterface.removeColumn('objectives', 'requirement_id', { transaction }));
    });
  },
};
