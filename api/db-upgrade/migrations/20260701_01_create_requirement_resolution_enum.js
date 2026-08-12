'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.query(
      `CREATE TYPE enum_requirement_resolution AS ENUM (
        'error_interno', 'fuera_de_alcance', 'error_externo', 'discutible', 'otro'
      );`
    );
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.query(
      `DROP TYPE enum_requirement_resolution;`
    );
  },
};
