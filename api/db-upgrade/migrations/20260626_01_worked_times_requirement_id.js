module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('worked_times', 'requirement_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'requirements', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('worked_times', ['requirement_id'], {
      name: 'idx_worked_times_requirement_id',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeIndex('worked_times', 'idx_worked_times_requirement_id');
    await queryInterface.removeColumn('worked_times', 'requirement_id');
  },
};
