'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`ALTER TYPE enum_requirement_type ADD VALUE IF NOT EXISTS 'sin_tipo';`);
  },

  down: async () => {
    // PostgreSQL no soporta DROP VALUE en un enum; revertir 'sin_tipo' requeriria
    // recrear el tipo completo (patron DROP TYPE/CREATE TYPE), no implementado aqui.
  },
};
