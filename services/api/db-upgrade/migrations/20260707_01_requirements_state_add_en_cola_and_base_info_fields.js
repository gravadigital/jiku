'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`ALTER TYPE enum_requirement_state ADD VALUE IF NOT EXISTS 'en_cola';`);
    await queryInterface.addColumn('requirements', 'scope', {
      type: Sequelize.DataTypes.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('requirements', 'technical_solution', {
      type: Sequelize.DataTypes.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('requirements', 'acceptance_criteria', {
      type: Sequelize.DataTypes.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('requirements', 'acceptance_criteria');
    await queryInterface.removeColumn('requirements', 'technical_solution');
    await queryInterface.removeColumn('requirements', 'scope');
    // PostgreSQL no soporta DROP VALUE en un enum; revertir 'en_cola' requeriria
    // recrear el tipo completo (patron DROP TYPE/CREATE TYPE), no implementado aqui.
  },
};
