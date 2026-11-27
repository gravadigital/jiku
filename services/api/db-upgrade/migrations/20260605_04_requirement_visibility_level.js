module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('requirements', 'visibility_level', {
      type: Sequelize.ENUM('public', 'internal'),
      allowNull: false,
      defaultValue: 'public',
    });
    await queryInterface.sequelize.query(
      `ALTER TYPE attachment_entity_type ADD VALUE IF NOT EXISTS 'requirement';`
    );
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('requirements', 'visibility_level');
    // ADD VALUE is irreversible without DROP+RECREATE
  },
};
