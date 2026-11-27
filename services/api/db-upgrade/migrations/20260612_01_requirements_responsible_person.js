module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('requirements', 'responsible_person_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'people', key: 'id' },
    });
    await queryInterface.addIndex('requirements', ['responsible_person_id'], {
      name: 'idx_requirements_responsible_person_id',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeIndex('requirements', 'idx_requirements_responsible_person_id');
    await queryInterface.removeColumn('requirements', 'responsible_person_id');
  },
};
