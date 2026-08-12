module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('attachments', 'entity_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('attachments', 'entity_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};
